import { AppShell } from "@/components/layout/AppShell";

export default function Home() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold text-text-primary">Explore</h1>
      <p className="mt-2 text-sm text-text-secondary">
        Frontend 셋업 완료 — Token 목록은 Factory `TokenCreated` 이벤트 연동 단계(Phase
        2)에서 채워집니다.
      </p>
    </AppShell>
  );
}
