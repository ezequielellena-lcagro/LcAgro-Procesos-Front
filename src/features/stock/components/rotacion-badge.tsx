import { cn } from "@/lib/utils";
import type { SemaforoRotacion } from "../types";

const MAP: Record<SemaforoRotacion, { label: string; cls: string }> = {
  SinDato: { label: "s/d", cls: "bg-panel-soft text-ink-soft" },
  Verde: { label: "Normal", cls: "bg-verde-bg text-verde" },
  Amarillo: { label: "Lenta", cls: "bg-clementina/15 text-clementina-deep" },
  Rojo: { label: "Inmovilizado", cls: "bg-rojo-bg text-rojo" },
};

/** Semáforo de rotación por antigüedad (días en stock). */
export function RotacionBadge({ semaforo }: { semaforo: SemaforoRotacion }) {
  const { label, cls } = MAP[semaforo];
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", cls)}>
      {label}
    </span>
  );
}
