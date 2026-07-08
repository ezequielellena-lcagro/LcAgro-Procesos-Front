import { fecha, numero, oDash } from "@/shared/format/format";
import { VencimientoBadge } from "./vencimiento-badge";
import { RotacionBadge } from "./rotacion-badge";
import type { StockLote } from "../types";

/** Detalle de los lotes de un artículo (4º nivel): stock, antigüedad (ingreso) y vencimiento. */
export function StockLotes({ lotes }: { lotes: StockLote[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line-soft bg-panel">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-line-soft text-ink-soft">
            <th className="px-3 py-1.5 text-left font-semibold">Lote / serie</th>
            <th className="px-3 py-1.5 text-right font-semibold">Stock</th>
            <th className="px-3 py-1.5 text-left font-semibold">Ingreso</th>
            <th className="px-3 py-1.5 text-left font-semibold">Antigüedad</th>
            <th className="px-3 py-1.5 text-left font-semibold">Vence</th>
            <th className="px-3 py-1.5 text-center font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody>
          {lotes.map((l, i) => (
            <tr key={`${l.serie}-${i}`} className="border-b border-line-soft/60 last:border-0">
              <td className="px-3 py-1.5">{l.serie || "—"}</td>
              <td className="px-3 py-1.5 text-right tabular">{numero(l.stockActual)}</td>
              <td className="px-3 py-1.5">{oDash(l.fechaIngreso, fecha)}</td>
              <td className="px-3 py-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="tabular text-ink-soft">{l.diasEnStock !== null ? `${l.diasEnStock} d` : "—"}</span>
                  <RotacionBadge semaforo={l.semaforoRotacion} />
                </span>
              </td>
              <td className="px-3 py-1.5">
                <span className="inline-flex items-center gap-1.5">
                  {oDash(l.fechaVencimiento, fecha)}
                  {l.diasParaVencer !== null && (
                    <span className="tabular text-ink-soft">({l.diasParaVencer} d)</span>
                  )}
                </span>
              </td>
              <td className="px-3 py-1.5 text-center">
                <VencimientoBadge estado={l.estadoVenc} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
