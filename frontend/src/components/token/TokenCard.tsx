import Link from "next/link";
import { useMemo } from "react";
import { Clock } from "lucide-react";
import { createAvatar } from "@dicebear/core";
import * as identicon from "@dicebear/identicon";
import { formatMarketCap, formatTimeAgo, truncateAddress } from "@/lib/format";
import { type TokenListItem } from "@/hooks/useTokenList";

export function TokenCard({ item }: { item: TokenListItem }) {
  const progressPercent = Math.min(Math.max(item.progress * 100, 0), 100);
  const avatarUri = useMemo(
    () => createAvatar(identicon, { seed: item.creator.toLowerCase() }).toDataUri(),
    [item.creator]
  );

  return (
    <Link
      href={`/token/${item.token}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.008] hover:border-border-strong"
    >
      <div className="relative overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt={`${item.name} token image`}
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="aspect-square w-full bg-surface-elevated" />
        )}
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white">
          <Clock size={11} />
          {formatTimeAgo(item.createdAt)}
        </div>
      </div>

      <div className="flex flex-col gap-3 bg-surface-elevated p-4">
        <div className="space-y-1">
          <p className="text-[15px] font-semibold text-text-primary">{item.name}</p>
          <p className="text-[13px] text-text-secondary">${item.symbol}</p>
          <p className="pt-2 font-financial text-[15px] font-medium text-text-primary">
            {formatMarketCap(item.fdv)}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <img src={avatarUri} alt="" aria-hidden="true" className="size-4 shrink-0 rounded-full" />
          <p className="font-financial text-[12px] text-text-secondary">
            {truncateAddress(item.creator)}
          </p>
        </div>

        <div className="h-1 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-[#4ADE80]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
