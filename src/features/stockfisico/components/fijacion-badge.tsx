import { cn } from "@/lib/utils";
import type { EstadoFijacion } from "../types";

const MAP: Record<EstadoFijacion, { label: string; cls: string }> = {
  Vencido: { label: "Vencido", cls: "bg-rojo-bg text-rojo font-semibold" },
  Naranja: { label: "≤30 días", cls: "bg-clementina/20 text-clementina-deep font-medium" },
  Amarillo: { label: "≤60 días", cls: "bg-clementina/10 text-clementina-deep" },
  Verde: { label: ">60 días", cls: "bg-verde-bg text-verde" },
  SinFecha: { label: "s/f", cls: "bg-panel-soft text-ink-soft" },
};

/** Pill del semáforo de vencimiento de fijación de un contrato de planta 10. */
export function FijacionBadge({ estado }: { estado: EstadoFijacion }) {
  const { label, cls } = MAP[estado];
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs", cls)}>{label}</span>;
}
