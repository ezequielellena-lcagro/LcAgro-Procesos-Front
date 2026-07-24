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

/**
 * Campo etiquetado para la FilterBar (label arriba, control abajo).
 * `title` va en el label y no solo en el control: un control deshabilitado no dispara el tooltip.
 */
export function FilterField({
  label,
  title,
  children,
}: {
  label: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <label title={title} className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
      {label}
      {children}
    </label>
  );
}
