"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowRight } from "lucide-react";
import { useAccount, useReadContracts } from "wagmi";
import { type Address } from "viem";
import { AppShell } from "@/components/layout/AppShell";
import { useTokenList } from "@/hooks/useTokenList";
import { useTradeHistory } from "@/hooks/useTradeHistory";
import { formatPercent, formatTokenAmount, formatUsd } from "@/lib/format";
import { memeTokenAbi } from "@/lib/contracts";

function PortfolioToken({
  item,
  balance,
  address,
}: {
  item: NonNullable<ReturnType<typeof useTokenList>["data"]>[number];
  balance: bigint;
  address: Address;
}) {
  const { trades, isLoading } = useTradeHistory(item.curve);
  const userTrades = trades.filter(
    (trade) => trade.trader.toLowerCase() === address.toLowerCase()
  );
  let held = 0n;
  let costBasis = 0n;

  for (const trade of userTrades) {
    if (trade.type === "buy") {
      held += trade.tokenAmount;
      costBasis += trade.usdcAmount;
    } else if (held > 0n) {
      costBasis -= (costBasis * (trade.tokenAmount > held ? held : trade.tokenAmount)) / held;
      held = held > trade.tokenAmount ? held - trade.tokenAmount : 0n;
    }
  }

  const averagePrice = held > 0n ? (costBasis * 10n ** 18n) / held : undefined;
  const changePercent = averagePrice && averagePrice > 0n
    ? Number(item.price - averagePrice) / Number(averagePrice)
    : undefined;
  const value = (balance * item.price) / 10n ** 18n;
  const pnl = averagePrice ? value - (costBasis * balance) / (held || 1n) : undefined;
  const isPositive = pnl !== undefined && pnl >= 0n;

  return (
    <Link
      href={`/token/${item.token}`}
      className="grid grid-cols-[minmax(180px,1.7fr)_minmax(130px,1fr)_minmax(130px,1fr)_minmax(150px,1fr)_18px] items-start gap-4 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong"
    >
      <div className="flex min-w-0 items-center gap-4">
        {item.image ? (
          <img
            src={item.image}
            alt={`${item.name} token image`}
            className="size-16 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="size-16 shrink-0 rounded-lg bg-surface-elevated" />
        )}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-text-primary">{item.name}</p>
          <p className="mt-1 truncate text-[13px] text-text-secondary">{item.symbol}</p>
        </div>
      </div>
      <div>
        <p className="font-financial text-xl font-semibold text-text-primary">
          {formatTokenAmount(balance)}
        </p>
        <p className="mt-1 font-financial text-[13px] text-text-secondary">
          ≈ {isLoading || !averagePrice ? "..." : formatUsd((averagePrice * held / (10n ** 18n)), 2)}
        </p>
      </div>
      <div>
        <p className="font-financial text-xl font-semibold text-text-primary">
          {formatUsd(value, 2)}
        </p>
      </div>
      <div>
        <p className={`font-financial text-xl font-semibold ${isPositive ? "text-positive" : "text-negative"}`}>
          {isLoading || pnl === undefined ? "..." : `${isPositive ? "+" : "-"}${formatUsd(pnl < 0n ? -pnl : pnl, 2)}`}
        </p>
        <p className={`mt-1 font-financial text-[13px] ${isPositive ? "text-positive" : "text-negative"}`}>
          {isLoading || changePercent === undefined ? "..." : `${changePercent >= 0 ? "+" : ""}${formatPercent(changePercent)}`}
        </p>
      </div>
      <ArrowRight size={18} className="text-text-secondary" />
    </Link>
  );
}

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { data: tokens, isLoading: isLoadingTokens, isError } = useTokenList();
  const { data: balances, isLoading: isLoadingBalances } = useReadContracts({
    contracts: (tokens ?? []).map((item) => ({
      address: item.token,
      abi: memeTokenAbi,
      functionName: "balanceOf",
      args: address ? [address] : undefined,
    })),
    query: { enabled: isConnected && Boolean(address) && (tokens?.length ?? 0) > 0 },
  });

  if (!isConnected || !address) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
          <h1 className="text-2xl font-semibold text-text-primary">Token Dashboard</h1>
          <p className="text-sm text-text-secondary">
            지갑을 연결하면 보유 중인 토큰을 확인할 수 있습니다.
          </p>
          <ConnectButton />
        </div>
      </AppShell>
    );
  }

  const ownedTokens = (tokens ?? []).flatMap((item, index) => {
    const balance = balances?.[index]?.result;
    return typeof balance === "bigint" && balance > 0n ? [{ item, balance }] : [];
  });
  const isLoading = isLoadingTokens || isLoadingBalances;

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">My Tokens</h1>
        <p className="mt-2 text-sm text-text-secondary">{ownedTokens.length} tokens</p>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-text-primary">My Tokens</h2>
      {isLoading && <p className="text-sm text-text-secondary">불러오는 중...</p>}
      {isError && (
        <p className="text-sm text-negative">토큰 목록을 불러오지 못했습니다.</p>
      )}
      {!isLoading && !isError && ownedTokens.length === 0 && (
        <p className="text-sm text-text-secondary">보유 중인 토큰이 없습니다.</p>
      )}

      <div className="grid grid-cols-[minmax(180px,1.7fr)_minmax(130px,1fr)_minmax(130px,1fr)_minmax(150px,1fr)_18px] items-center gap-4 px-4 text-[13px] text-text-secondary">
        <span />
        <span>Balance</span>
        <span>Value (fUSDC)</span>
        <span>PnL</span>
        <span />
      </div>
      <div className="mt-2 space-y-3">
        {ownedTokens.map(({ item, balance }) => (
          <PortfolioToken key={item.token} item={item} balance={balance} address={address} />
        ))}
      </div>
    </AppShell>
  );
}