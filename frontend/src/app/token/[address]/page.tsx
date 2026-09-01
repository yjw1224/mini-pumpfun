import { AppShell } from "@/components/layout/AppShell";
import { TokenDetail } from "@/components/token/TokenDetail";
import { TokenCreatedToast } from "@/components/ui/TokenCreatedToast";

export default async function TokenDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { address } = await params;
  const { created } = await searchParams;

  return (
    <AppShell>
      <TokenDetail tokenAddress={address} />
      {created === "1" && <TokenCreatedToast />}
    </AppShell>
  );
}
