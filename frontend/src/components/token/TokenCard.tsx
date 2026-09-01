import Link from "next/link";
import { formatUsd } from "@/lib/format";
import { type TokenListItem } from "@/hooks/useTokenList";

export function TokenCard({ item }: { item: TokenListItem }) {
  return (
    <Link
      href={`/token/${item.token}`}
      className="overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-border-strong"
    >
      {item.image ? <img src={item.image} alt={`${item.name} token image`} className="aspect-square w-full object-cover" /> : <div className="aspect-square w-full bg-surface-elevated" />}
      <div className="space-y-1 bg-surface-elevated p-4">
        <p className="text-[15px] font-semibold text-text-primary">{item.name}</p>
        <p className="text-[13px] text-text-secondary">{item.symbol}</p>
        <p className="pt-2 font-financial text-[15px] font-medium text-text-primary">{formatUsd(item.fdv, 0)}</p>
      </div>
    </Link>
  );
}
