import Link from "next/link";
import { Progress } from "@/components/ui/Progress";
import { formatPercent, formatUsd, truncateAddress } from "@/lib/format";
import { type TokenListItem } from "@/hooks/useTokenList";

export function TokenCard({ item }: { item: TokenListItem }) {
  return (
    <Link
      href={`/token/${item.token}`}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[15px] font-semibold text-text-primary">
            {item.symbol}
          </p>
          <p className="text-[13px] text-text-secondary">{item.name}</p>
        </div>
        {item.graduated && (
          <span className="rounded-sm bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info">
            Graduated
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-[13px]">
        <span className="text-text-secondary">Price</span>
        <span className="font-financial text-text-primary">
          {formatUsd(item.price)}
        </span>
      </div>
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-text-secondary">Market Cap</span>
        <span className="font-financial text-text-primary">
          {formatUsd(item.fdv, 0)}
        </span>
      </div>

      {!item.graduated && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[12px] text-text-secondary">
            <span>Bonding Curve</span>
            <span className="font-financial text-primary">
              {formatPercent(item.progress)}
            </span>
          </div>
          <Progress ratio={item.progress} />
        </div>
      )}

      <p className="text-[11px] text-text-muted">
        {truncateAddress(item.token)}
      </p>
    </Link>
  );
}
