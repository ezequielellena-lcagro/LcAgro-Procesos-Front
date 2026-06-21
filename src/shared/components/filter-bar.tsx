import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "no-print mb-4 flex flex-wrap items-end gap-3 rounded-card border border-line bg-panel p-3.5 shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Campo etiquetado para la FilterBar (label arriba, control abajo). */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
      {label}
      {children}
    </label>
  );
}
