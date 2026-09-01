"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { getAbiItem, type Address } from "viem";
import {
  FACTORY_ADDRESS,
  FACTORY_DEPLOY_BLOCK,
  bondingCurveAbi,
  factoryAbi,
  memeTokenAbi,
} from "@/lib/contracts";
import { toGatewayUrl } from "@/lib/ipfs";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type TokenListItem = {
  token: Address;
  curve: Address;
  creator: Address;
  name: string;
  symbol: string;
  image?: string;
  /** USDC per token, 18-decimals fixed point (matches virtualUSDCReserve/virtualTokenReserve). */
  price: bigint;
  /** price * TOTAL_SUPPLY, i.e. fully-diluted valuation in USDC. */
  fdv: bigint;
  progress: number;
  graduated: boolean;
  /** Seconds since epoch when the token was created. */
  createdAt: number;
};

const tokenCreatedEvent = getAbiItem({ abi: factoryAbi, name: "TokenCreated" });

const READS_PER_TOKEN = [
  { abi: memeTokenAbi, functionName: "name" },
  { abi: memeTokenAbi, functionName: "symbol" },
  { abi: memeTokenAbi, functionName: "tokenURI" },
  { abi: bondingCurveAbi, functionName: "virtualTokenReserve" },
  { abi: bondingCurveAbi, functionName: "virtualUSDCReserve" },
  { abi: bondingCurveAbi, functionName: "realTokenReserve" },
  { abi: bondingCurveAbi, functionName: "INITIAL_TOKEN_RESERVE" },
  { abi: bondingCurveAbi, functionName: "TOTAL_SUPPLY" },
  { abi: bondingCurveAbi, functionName: "amm" },
] as const;

export function useTokenList() {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["tokenList", FACTORY_ADDRESS, publicClient?.chain.id],
    enabled: Boolean(FACTORY_ADDRESS) && Boolean(publicClient),
    staleTime: 15_000,
    queryFn: async (): Promise<TokenListItem[]> => {
      if (!publicClient) return [];

      const logs = await publicClient.getLogs({
        address: FACTORY_ADDRESS,
        event: tokenCreatedEvent,
        fromBlock: FACTORY_DEPLOY_BLOCK,
        toBlock: "latest",
      });

      const created = logs.map((log) => ({
        creator: log.args.creator as Address,
        token: log.args.token as Address,
        curve: log.args.bondingCurve as Address,
        blockNumber: log.blockNumber,
      }));

      if (created.length === 0) return [];

      const uniqueBlockNumbers = [
        ...new Set(created.map(({ blockNumber }) => blockNumber)),
      ];
      const blocks = await Promise.all(
        uniqueBlockNumbers.map((blockNumber) =>
          publicClient.getBlock({ blockNumber })
        )
      );
      const timestampByBlock = new Map(
        blocks.map((block) => [block.number, Number(block.timestamp)])
      );

      const contracts = created.flatMap(({ token, curve }) =>
        READS_PER_TOKEN.map((read) => ({
          address: read.abi === memeTokenAbi ? token : curve,
          abi: read.abi,
          functionName: read.functionName,
        }))
      );

      const results = await Promise.all(
        contracts.map((contract) => publicClient.readContract(contract))
      );

      return (await Promise.all(
        created.map(async (item, i) => {
          const base = i * READS_PER_TOKEN.length;
          const name = results[base] as string;
          const symbol = results[base + 1] as string;
          const tokenUri = results[base + 2] as string;
          const virtualTokenReserve = results[base + 3] as bigint;
          const virtualUSDCReserve = results[base + 4] as bigint;
          const realTokenReserve = results[base + 5] as bigint;
          const initialTokenReserve = results[base + 6] as bigint;
          const totalSupply = results[base + 7] as bigint;
          const amm = results[base + 8] as Address;
          const image = await fetch(toGatewayUrl(tokenUri))
            .then((response) => (response.ok ? response.json() : null))
            .then((metadata: { image?: string } | null) =>
              metadata?.image ? toGatewayUrl(metadata.image) : undefined
            )
            .catch(() => undefined);

          const price =
            virtualTokenReserve > 0n
              ? (virtualUSDCReserve * 10n ** 18n) / virtualTokenReserve
              : 0n;
          const fdv = (price * totalSupply) / 10n ** 18n;
          const progress =
            initialTokenReserve > 0n
              ? Number(initialTokenReserve - realTokenReserve) /
                Number(initialTokenReserve)
              : 0;

          return {
            ...item,
            name,
            symbol,
            image,
            price,
            fdv,
            progress,
            graduated: amm.toLowerCase() !== ZERO_ADDRESS,
            createdAt: timestampByBlock.get(item.blockNumber) ?? 0,
          };
        })
      )).reverse(); // newest first
    },
  });
}
