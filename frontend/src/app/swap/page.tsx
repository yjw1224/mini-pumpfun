"use client";

import { AppShell } from "@/components/layout/AppShell";
import { SwapCard } from "@/components/swap/SwapCard";

export default function SwapPage() {
  return (
    <AppShell>
      <div className="flex justify-center pt-6">
        <SwapCard />
      </div>
    </AppShell>
  );
}
