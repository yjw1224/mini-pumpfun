import { AppShell } from "@/components/layout/AppShell";
import { TokenDetail } from "@/components/token/TokenDetail";

export default async function TokenDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  return (
    <AppShell>
      <TokenDetail tokenAddress={address} />
    </AppShell>
  );
}
