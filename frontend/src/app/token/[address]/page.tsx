import { AppShell } from "@/components/layout/AppShell";

export default async function TokenDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold text-text-primary">Token</h1>
      <p className="mt-2 font-financial text-sm text-text-secondary">
        {address}
      </p>
      <p className="mt-4 text-sm text-text-secondary">
        상세 페이지(Buy/Sell, Bonding Curve, Graduation)는 Phase 3에서
        구현됩니다.
      </p>
    </AppShell>
  );
}
