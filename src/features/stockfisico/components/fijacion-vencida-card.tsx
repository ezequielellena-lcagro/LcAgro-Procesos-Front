import { fecha as fmtFecha, numero } from "@/shared/format/format";
import type { AFijarDetalleDto } from "../types";

const TOPE = 8;

/**
 * Lista accionable de contratos con la fijación ya vencida: el grano está entregado, el plazo para
 * ponerle precio pasó y hay que resolverlo. Ordena por tonelaje (lo que más pesa primero) y encabeza
 * con el total vencido, para leerse como una cola de trabajo, no como una tabla más.
 */
export function FijacionVencidaCard({ filas }: { filas: AFijarDetalleDto[] }) {
  const vencidas = filas
    .filter((f) => f.estado === "Vencido")
    .sort((a, b) => b.aFijarTn - a.aFijarTn);
  const totalTn = vencidas.reduce((acc, f) => acc + f.aFijarTn, 0);
  const visibles = vencidas.slice(0, TOPE);

  return (
    <section className="rounded-card border border-l-4 border-line border-l-rojo bg-panel p-4 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-display text-lg font-semibold text-ink">
          Fijación vencida
          <span className="ml-2 rounded-full bg-rojo-bg px-2 py-0.5 align-middle text-xs font-medium text-rojo">
            {vencidas.length}
          </span>
        </h3>
        {vencidas.length > 0 && (
          <div className="text-right">
            <span className="font-display text-xl font-semibold tabular text-ink">{numero(totalTn)} tn</span>{" "}
            <span className="text-xs text-ink-soft">a resolver</span>
          </div>
        )}
      </div>
      <p className="mt-0.5 text-xs text-ink-soft">Grano entregado con el plazo de fijación ya cumplido</p>

      {vencidas.length === 0 ? (
        <p className="mt-4 rounded-card bg-verde-bg px-3 py-2 text-sm text-verde">
          Ningún contrato con fijación vencida.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line-soft">
          {visibles.map((f) => (
            <li key={`${f.contrato}-${f.cereal}`} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2">
              <div className="min-w-0">
                <span className="block truncate text-sm text-ink" title={f.comprador}>
                  {f.comprador}
                </span>
                <span className="text-xs text-ink-soft">
                  {f.cereal} · contrato {f.contrato}
                  {f.vtoFijacion && ` · venció el ${fmtFecha(f.vtoFijacion)}`}
                </span>
              </div>
              <span className="text-right text-sm font-semibold tabular text-ink">{numero(f.aFijarTn)} tn</span>
            </li>
          ))}
        </ul>
      )}

      {vencidas.length > TOPE && (
        <p className="mt-2 text-xs text-ink-soft">y {vencidas.length - TOPE} contratos más…</p>
      )}
    </section>
  );
}
