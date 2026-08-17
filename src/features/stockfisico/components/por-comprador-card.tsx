import { MiniBarChart } from "@/shared/components/mini-bar-chart";
import { numero } from "@/shared/format/format";
import { porCanal, porComprador } from "../lib/a-fijar";
import type { AFijarDetalleDto } from "../types";

const TOPE = 8;

/**
 * Resumen del cereal a fijar por comprador: quién concentra el volumen pendiente de precio, con la
 * fracción ya vencida marcada, y el reparto por canal (venta directa vs. por corredor).
 */
export function PorCompradorCard({ filas }: { filas: AFijarDetalleDto[] }) {
  const compradores = porComprador(filas);
  const { directoTn, corredorTn } = porCanal(filas);
  const totalTn = directoTn + corredorTn;
  const visibles = compradores.slice(0, TOPE);

  const rows = visibles.map((c) => ({
    label: c.comprador,
    value: c.tn,
    sub: c.vencidoTn > 0 ? `${numero(c.vencidoTn)} vencido` : `${c.contratos} contr.`,
  }));

  return (
    <section className="rounded-card border border-line bg-panel p-4 shadow-card">
      <h3 className="font-display text-lg font-semibold text-ink">A fijar por comprador</h3>
      <p className="mt-0.5 text-xs text-ink-soft">Quién concentra el grano entregado sin precio cerrado</p>

      {compradores.length === 0 ? (
        <p className="mt-4 rounded-card bg-verde-bg px-3 py-2 text-sm text-verde">
          No hay cereal pendiente de fijación.
        </p>
      ) : (
        <>
          <div className="mt-3">
            <MiniBarChart rows={rows} unit="tn" />
          </div>
          {compradores.length > TOPE && (
            <p className="mt-2 text-xs text-ink-soft">y {compradores.length - TOPE} compradores más…</p>
          )}
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-line-soft pt-3 text-sm">
            <span className="text-ink-soft">
              Canal:{" "}
              <b className="text-ink">{numero(directoTn)} tn</b> directo ·{" "}
              <b className="text-ink">{numero(corredorTn)} tn</b> por corredor
            </span>
            {totalTn > 0 && (
              <span className="text-ink-soft">
                ({Math.round((corredorTn / totalTn) * 100)}% intermediado)
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
