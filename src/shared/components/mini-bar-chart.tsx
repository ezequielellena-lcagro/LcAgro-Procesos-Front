import { cn } from "@/lib/utils";

export interface BarRow {
  /** Etiqueta de la fila (campaña, comprador, etc.). */
  label: string;
  value: number;
  /** Texto chico a la derecha del valor (ej. "3 clientes"). */
  sub?: string;
  /** Resalta la fila (ej. la campaña en curso). */
  highlight?: boolean;
}

/**
 * Gráfico de barras horizontal, sin dependencias: una fila por dato, barra proporcional al máximo.
 * Pensado para series cortas (evolución por campaña, ranking por comprador) donde una tabla se lee
 * peor que ver de un vistazo quién pesa más.
 */
export function MiniBarChart({
  rows,
  formatValue = (n) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 }),
  unit,
  className,
}: {
  rows: BarRow[];
  formatValue?: (n: number) => string;
  unit?: string;
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className={cn("space-y-1.5", className)}>
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 text-sm">
          <span className={cn("truncate text-ink-soft", r.highlight && "font-medium text-ink")} title={r.label}>
            {r.label}
          </span>
          <div className="h-5 overflow-hidden rounded bg-panel-soft">
            <div
              className={cn("h-full rounded", r.highlight ? "bg-clementina" : "bg-slate-brand/55")}
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </div>
          <span className={cn("tabular text-right text-ink-soft", r.highlight && "font-semibold text-ink")}>
            {formatValue(r.value)}
            {unit ? ` ${unit}` : ""}
            {r.sub && <span className="ml-1 text-xs text-ink-soft">· {r.sub}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
