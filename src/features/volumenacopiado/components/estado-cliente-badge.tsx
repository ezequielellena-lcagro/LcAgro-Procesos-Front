import { cn } from "@/lib/utils";
import type { EstadoCliente } from "../types";

const MAP: Record<EstadoCliente, { label: string; cls: string }> = {
  Creciente: { label: "Creciente", cls: "bg-verde-bg text-verde" },
  Declinante: { label: "Declinante", cls: "bg-clementina/15 text-clementina-deep" },
  Dormido: { label: "Dormido", cls: "bg-rojo-bg text-rojo font-medium" },
};

/** Situación del cliente en la cartera: el dormido es la palanca de reactivación. */
export function EstadoClienteBadge({ estado }: { estado: EstadoCliente }) {
  const { label, cls } = MAP[estado];
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs", cls)}>{label}</span>;
}
