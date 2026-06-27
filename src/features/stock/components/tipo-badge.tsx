import { cn } from "@/lib/utils";
import type { TipoDeposito } from "../types";

const MAP: Record<TipoDeposito, { label: string; cls: string }> = {
  Propio: { label: "Propio", cls: "bg-verde-bg text-verde" },
  Consignado: { label: "Consignado", cls: "bg-panel-soft text-ink-soft" },
};

export function TipoBadge({ tipo }: { tipo: TipoDeposito }) {
  const { label, cls } = MAP[tipo];
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", cls)}>
      {label}
    </span>
  );
}
