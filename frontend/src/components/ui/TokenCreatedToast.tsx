"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";

export function TokenCreatedToast() {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const exitTimeoutId = window.setTimeout(() => setIsExiting(true), 2_700);
    const removeTimeoutId = window.setTimeout(() => setIsVisible(false), 3_000);
    return () => {
      window.clearTimeout(exitTimeoutId);
      window.clearTimeout(removeTimeoutId);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      role="status"
      className={`fixed bottom-4 left-4 z-50 flex w-[calc(100%-2rem)] max-w-[360px] items-center gap-3 rounded-lg border border-border bg-surface/85 p-3 shadow-lg shadow-black/30 backdrop-blur-md ${isExiting ? "animate-toast-exit" : "animate-toast-enter"}`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-positive text-background">
        <Check className="size-5" strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">Token created successfully</p>
        <p className="mt-0.5 text-[13px] text-text-secondary">Your token is now live.</p>
      </div>
      <button
        type="button"
        onClick={() => setIsExiting(true)}
        aria-label="Dismiss notification"
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}