import Link from "next/link";
import { formatMarketCap } from "@/lib/format";
import { type TokenListItem } from "@/hooks/useTokenList";

export function TokenCard({ item }: { item: TokenListItem }) {
  const progressPercent = Math.min(Math.max(item.progress * 100, 0), 100);

  return (
    <Link
      href={`/token/${item.token}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.008] hover:border-border-strong"
    >
      <div className="overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt={`${item.name} token image`}
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="aspect-square w-full bg-surface-elevated" />
        )}
      </div>

      <div className="flex flex-col gap-3 bg-surface-elevated p-4">
        <div className="space-y-1">
          <p className="text-[15px] font-semibold text-text-primary">{item.name}</p>
          <p className="text-[13px] text-text-secondary">${item.symbol}</p>
          <p className="pt-2 font-financial text-[15px] font-medium text-text-primary">
            {formatMarketCap(item.fdv)}
          </p>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-[#4ADE80]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
