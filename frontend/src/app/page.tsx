"use client";

import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { TokenCard } from "@/components/token/TokenCard";
import { useTokenList } from "@/hooks/useTokenList";
import { FACTORY_ADDRESS } from "@/lib/contracts";

type SortMode = "created" | "mcap";

export default function Home() {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("created");
  const { data: tokens, isLoading, isError } = useTokenList();

  const filtered = (tokens ?? []).filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.symbol.toLowerCase().includes(q) ||
      item.token.toLowerCase().includes(q)
    );
  });

  const sortedFiltered = [...filtered].sort((a, b) => {
    if (sortMode === "mcap") {
      if (a.fdv > b.fdv) return -1;
      if (a.fdv < b.fdv) return 1;
      return 0;
    }

    return 0;
  });

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Explore</h1>
        <Link href="/create">
          <Button>Create Token</Button>
        </Link>
      </div>

      {!FACTORY_ADDRESS ? (
        <p className="text-sm text-text-secondary">
          NEXT_PUBLIC_FACTORY_ADDRESS가 설정되지 않았습니다. 배포 후 .env에
          채워주세요.
        </p>
      ) : (
        <>
          <div className="mb-4 flex h-11 max-w-sm items-center gap-2 rounded-md border border-border bg-surface px-3">
            <Search size={16} className="shrink-0 text-text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, symbol, address"
              className="h-full w-full bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>

          <div className="mb-6 flex w-fit items-center rounded-md border border-border bg-surface p-1">
            {[
              { value: "created", label: "생성순" },
              { value: "mcap", label: "MCap순" },
            ].map((option) => {
              const isActive = sortMode === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSortMode(option.value as SortMode)}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-background"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {isLoading && (
            <p className="text-sm text-text-secondary">불러오는 중...</p>
          )}
          {isError && (
            <p className="text-sm text-negative">
              토큰 목록을 불러오지 못했습니다.
            </p>
          )}
          {!isLoading && !isError && sortedFiltered.length === 0 && (
            <p className="text-sm text-text-secondary">
              아직 생성된 토큰이 없습니다.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {sortedFiltered.map((item) => (
              <TokenCard key={item.token} item={item} />
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
