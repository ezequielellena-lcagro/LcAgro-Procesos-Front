import { cn } from "@/lib/utils";
import type { EstadoStock } from "../types";

const MAP: Record<EstadoStock, { label: string; cls: string }> = {
  Ok: { label: "OK", cls: "bg-verde-bg text-verde" },
  RiesgoQuiebre: { label: "Riesgo quiebre", cls: "bg-rojo-bg text-rojo" },
  Inmovilizado: { label: "Inmovilizado", cls: "bg-panel-soft text-ink-soft" },
};

export function EstadoBadge({ estado }: { estado: EstadoStock }) {
  const { label, cls } = MAP[estado];
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", cls)}>
      {label}
    </span>
  );
}
