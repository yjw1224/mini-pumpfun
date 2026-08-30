import { cn } from "@/lib/utils";

export function Progress({
  ratio,
  className,
}: {
  ratio: number;
  className?: string;
}) {
  const clamped = Math.min(1, Math.max(0, ratio));

  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-sm bg-surface-elevated", className)}
    >
      <div
        className="h-full rounded-sm bg-primary transition-[width]"
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
