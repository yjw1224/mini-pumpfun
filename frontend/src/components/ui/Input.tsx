import { type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  suffix?: string;
}

export function Input({ label, suffix, className, id, onChange, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor
        ={id} className="text-[13px] font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div className="flex h-12 items-center rounded-md border border-border bg-surface px-3 focus-within:border-primary">
        <input
          id={id}
          className={cn(
            "h-full w-full min-w-0 bg-transparent text-text-primary outline-none placeholder:text-text-muted font-financial",
            id === "trade-amount" ? "text-xl" : "text-[15px]",
            className
          )}
          onChange={(event) => {
            if (id === "trade-amount" && !/^\d*\.?\d*$/.test(event.target.value)) return;
            onChange?.(event);
          }}
          {...props}
        />
        {suffix && (
          <span className="ml-2 shrink-0 text-[13px] font-medium text-text-secondary">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
