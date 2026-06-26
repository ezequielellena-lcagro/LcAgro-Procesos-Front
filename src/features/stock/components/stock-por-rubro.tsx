import { usd } from "@/shared/format/format";
import type { RubroValor } from "../types";

/** Gráfico de barras (USD por rubro) sin dependencias: el ancho es proporcional al máximo. */
export function StockPorRubro({ porRubro }: { porRubro: RubroValor[] }) {
  if (porRubro.length === 0) return null;
  const max = Math.max(...porRubro.map((r) => r.valorUsd), 1);

  return (
    <div className="mb-4 rounded-card border border-line bg-panel p-4 shadow-card">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
        Valor USD por rubro
      </h2>
      <div className="space-y-2">
        {porRubro.map((r) => (
          <div key={r.rubro} className="flex items-center gap-3 text-sm">
            <span className="w-40 shrink-0 truncate text-ink-soft" title={r.rubroDesc}>
              {r.rubroDesc}
            </span>
            <div className="h-3 flex-1 rounded-full bg-panel-soft">
              <div
                data-testid={`barra-${r.rubro}`}
                className="h-3 rounded-full bg-clementina"
                style={{ width: `${(r.valorUsd / max) * 100}%` }}
              />
            </div>
            <span className="w-32 shrink-0 text-right tabular">{usd(r.valorUsd)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
