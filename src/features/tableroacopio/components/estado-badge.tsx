import { cn } from "@/lib/utils";
import { ETIQUETA_ESTADO, type Estado } from "../lib/semaforo";

export function EstadoBadge({ estado }: { estado: Estado }) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        estado === "cumple" && "bg-verde-bg text-verde",
        estado === "no-cumple" && "bg-rojo-bg text-rojo",
        estado === "en-curso" && "bg-clementina/20 text-slate-brand",
        estado === "sin-objetivo" && "bg-panel-soft text-ink-soft",
      )}
    >
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}
