import { formatUnits } from "viem";

/** Formats an 18-decimals on-chain amount as a compact, comma-separated string. */
export function formatTokenAmount(value: bigint, maxFractionDigits = 2): string {
  const asNumber = Number(formatUnits(value, 18));
  return asNumber.toLocaleString("en-US", {
    maximumFractionDigits: maxFractionDigits,
  });
}

/** Formats an 18-decimals USDC amount as a `$` prefixed string. */
export function formatUsd(value: bigint, maxFractionDigits = 6): string {
  return `$${formatTokenAmount(value, maxFractionDigits)}`;
}

/** Formats an 18-decimals USDC market cap with compact K/M/B units. */
export function formatMarketCap(value: bigint): string {
  const amount = Number(formatUnits(value, 18));
  const units = [
    { suffix: "B", value: 1_000_000_000 },
    { suffix: "M", value: 1_000_000 },
    { suffix: "K", value: 1_000 },
  ];

  const unit = units.find(({ value: unitValue }) => amount >= unitValue);
  if (!unit) return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

  const compactValue = amount / unit.value;
  return `$${compactValue.toLocaleString("en-US", {
    maximumFractionDigits: compactValue >= 10 ? 1 : 2,
  })}${unit.suffix}`;
}

export function formatPercent(ratio: number, maxFractionDigits = 1): string {
  return `${(ratio * 100).toLocaleString("en-US", {
    maximumFractionDigits: maxFractionDigits,
  })}%`;
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
