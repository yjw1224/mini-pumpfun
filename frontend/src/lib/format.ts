import { formatUnits } from "viem";

/** Formats an 18-decimals on-chain amount as a compact, comma-separated string. */
export function formatTokenAmount(value: bigint, maxFractionDigits = 2): string {
  const asNumber = Number(formatUnits(value, 18));
  return asNumber.toLocaleString("en-US", {
    maximumFractionDigits: maxFractionDigits,
  });
}

/** Formats an 18-decimals USDC amount as a `$` prefixed string. */
export function formatUsd(value: bigint, maxFractionDigits = 4): string {
  return `$${formatTokenAmount(value, maxFractionDigits)}`;
}

export function formatPercent(ratio: number, maxFractionDigits = 1): string {
  return `${(ratio * 100).toLocaleString("en-US", {
    maximumFractionDigits: maxFractionDigits,
  })}%`;
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
