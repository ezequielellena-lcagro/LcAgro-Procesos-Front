import { cn } from "@/lib/utils";
import { pct } from "@/shared/format/format";

/**
 * Semáforo del avance. Se compara contra el **ritmo esperado a la fecha**, no contra el 100 %:
 * en agosto nadie lleva vendida la campaña entera, y pintar todo de rojo no informa nada.
 */
function tonoAvance(avance: number, esperado: number): "ok" | "medio" | "malo" {
  if (esperado <= 0) return "ok";
  const relativo = avance / esperado;
  if (relativo >= 1) return "ok";
  if (relativo >= 0.8) return "medio";
  return "malo";
}

/**
 * Barra de avance con la marca del **ritmo esperado a la fecha**.
 *
 * Sin esa marca la barra no dice nada: en agosto nadie lleva el 100 % de la campaña.
 * El semáforo compara contra la marca, no contra el 100 %.
 */
export function AvanceBar({
  avance,
  esperado,
  ancho = "w-28",
  mostrarPct = true,
}: {
  /** Real ÷ objetivo (0–1+). `null` = sin objetivo cargado. */
  avance: number | null;
  /** Fracción de campaña que debería llevar hoy, según la curva estacional. */
  esperado: number;
  ancho?: string;
  mostrarPct?: boolean;
}) {
  if (avance == null || !Number.isFinite(avance)) {
    return <span className="text-xs text-ink-soft">sin objetivo</span>;
  }

  const tono = tonoAvance(avance, esperado);
  const relleno = Math.max(0, Math.min(avance * 100, 100));
  const marca = Math.max(0, Math.min(esperado * 100, 100));

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <div className={cn("relative h-2 overflow-visible rounded bg-panel-soft", ancho)}>
        <div
          className={cn(
            "h-full rounded",
            tono === "ok" && "bg-verde",
            tono === "medio" && "bg-clementina-deep",
            tono === "malo" && "bg-rojo",
          )}
          style={{ width: `${relleno.toFixed(1)}%` }}
        />
        <div
          className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded bg-slate-brand/60"
          style={{ left: `${marca.toFixed(1)}%` }}
          title={`Ritmo esperado a hoy: ${pct(marca)}`}
        />
      </div>
      {mostrarPct && (
        <span
          className={cn(
            "text-xs font-medium tabular",
            tono === "ok" && "text-verde",
            tono === "medio" && "text-clementina-deep",
            tono === "malo" && "text-rojo",
          )}
        >
          {pct(avance * 100)}
        </span>
      )}
    </div>
  );
}
