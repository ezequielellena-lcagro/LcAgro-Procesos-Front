import { cn } from "@/lib/utils";
import { numero } from "@/shared/format/format";
import type { FilaProduccionPropia } from "../types";

/** Plano ①: el número grande — lo cosechado que todavía no se vendió, por cereal. */
export function SaldoCard({ fila }: { fila: FilaProduccionPropia }) {
  const positivo = fila.saldo >= 0;

  return (
    <div
      className={cn(
        "rounded-card border border-line bg-panel p-4 shadow-card",
        positivo ? "border-l-4 border-l-verde" : "border-l-4 border-l-rojo",
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-ink-soft">{fila.cereal}</div>

      <div className="mt-1 font-display text-2xl font-semibold tabular">
        <span className={cn(positivo ? "text-verde" : "text-rojo")}>{numero(fila.saldo)}</span>
        <span className="ml-1 text-sm font-normal text-ink-soft">tn sin vender</span>
      </div>

      <div className="mt-2 border-t border-dashed border-line pt-2 text-xs text-ink-soft">
        de <b className="tabular text-ink">{numero(fila.cosechado)}</b> tn cosechadas · vendido{" "}
        <b className="tabular text-ink">{numero(fila.vendido)}</b>
      </div>
    </div>
  );
}
