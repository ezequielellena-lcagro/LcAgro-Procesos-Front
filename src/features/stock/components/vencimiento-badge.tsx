import { cn } from "@/lib/utils";
import type { EstadoVencimiento } from "../types";

const MAP: Record<EstadoVencimiento, { label: string; cls: string }> = {
  SinFecha: { label: "Sin fecha", cls: "bg-panel-soft text-ink-soft" },
  Vencido: { label: "Vencido", cls: "bg-rojo-bg text-rojo font-semibold" },
  Critico: { label: "Crítico", cls: "bg-rojo-bg text-rojo" },
  Alerta: { label: "Alerta", cls: "bg-clementina/15 text-clementina-deep" },
  Normal: { label: "Normal", cls: "bg-verde-bg text-verde" },
};

export function VencimientoBadge({ estado }: { estado: EstadoVencimiento }) {
  const { label, cls } = MAP[estado];
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", cls)}>
      {label}
    </span>
  );
}
