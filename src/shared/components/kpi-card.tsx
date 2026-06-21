import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "verde" | "rojo";

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-panel p-4 shadow-card",
        tone === "verde" && "border-l-4 border-l-verde",
        tone === "rojo" && "border-l-4 border-l-rojo",
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold tabular text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-soft">{hint}</div>}
    </div>
  );
}
