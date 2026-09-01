"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { formatUnits, getAbiItem, type Address, type Hash } from "viem";
import { bondingCurveAbi, FACTORY_DEPLOY_BLOCK } from "@/lib/contracts";

export type Trade = {
  timestamp: number;
  type: "buy" | "sell";
  price: bigint;
  tokenAmount: bigint;
  usdcAmount: bigint;
  trader: Address;
  txHash: Hash;
};

export type ChartPoint = {
  timestamp: number;
  price: number | null;
};

export type ChartRange = "1h" | "24h";

const tokensPurchasedEvent = getAbiItem({ abi: bondingCurveAbi, name: "TokensPurchased" });
const tokensSoldEvent = getAbiItem({ abi: bondingCurveAbi, name: "TokensSold" });

export function buildChartData(
  trades: Trade[],
  range: ChartRange,
  nowSeconds = Date.now() / 1000
): ChartPoint[] {
  const intervalSeconds = range === "1h" ? 60 : 30 * 60;
  const bucketCount = range === "1h" ? 60 : 48;
  const endTimestamp = Math.floor(nowSeconds / intervalSeconds) * intervalSeconds;
  const startTimestamp = endTimestamp - bucketCount * intervalSeconds;
  let tradeIndex = 0;
  let latestPrice: number | null = null;

  while (tradeIndex < trades.length && trades[tradeIndex].timestamp < startTimestamp) {
    latestPrice = Number(formatUnits(trades[tradeIndex].price, 18));
    tradeIndex += 1;
  }

  return Array.from({ length: bucketCount + 1 }, (_, index) => {
    const timestamp = startTimestamp + index * intervalSeconds;

    while (tradeIndex < trades.length && trades[tradeIndex].timestamp <= timestamp) {
      latestPrice = Number(formatUnits(trades[tradeIndex].price, 18));
      tradeIndex += 1;
    }

    return { timestamp, price: latestPrice };
  });
}

export function useTradeHistory(curveAddress?: Address) {
  const publicClient = usePublicClient();

  const query = useQuery({
    queryKey: ["tradeHistory", curveAddress, publicClient?.chain.id],
    enabled: Boolean(curveAddress) && Boolean(publicClient),
    staleTime: 15_000,
    queryFn: async (): Promise<Trade[]> => {
      if (!publicClient || !curveAddress) return [];

      const logs = await publicClient.getLogs({
        address: curveAddress,
        events: [tokensPurchasedEvent, tokensSoldEvent],
        fromBlock: FACTORY_DEPLOY_BLOCK,
        toBlock: "latest",
      });

      if (logs.length === 0) return [];

      const sorted = [...logs].sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
        if (a.transactionIndex !== b.transactionIndex) return a.transactionIndex - b.transactionIndex;
        return a.logIndex - b.logIndex;
      });

      const uniqueBlockNumbers = [...new Set(sorted.map((log) => log.blockNumber))];
      const blocks = await Promise.all(
        uniqueBlockNumbers.map((blockNumber) => publicClient.getBlock({ blockNumber }))
      );
      const timestampByBlock = new Map(
        blocks.map((block) => [block.number, Number(block.timestamp)])
      );

      return sorted.map((log) => {
        const isBuy = log.eventName === "TokensPurchased";
        const args = log.args as {
          buyer?: Address;
          seller?: Address;
          usdcIn?: bigint;
          tokensOut?: bigint;
          tokensIn?: bigint;
          usdcOut?: bigint;
          price: bigint;
        };

        return {
          timestamp: timestampByBlock.get(log.blockNumber) ?? 0,
          type: isBuy ? "buy" : "sell",
          price: args.price,
          tokenAmount: (isBuy ? args.tokensOut : args.tokensIn) as bigint,
          usdcAmount: (isBuy ? args.usdcIn : args.usdcOut) as bigint,
          trader: (isBuy ? args.buyer : args.seller) as Address,
          txHash: log.transactionHash,
        };
      });
    },
  });

  const trades = useMemo(() => query.data ?? [], [query.data]);

  return { ...query, trades };
}
