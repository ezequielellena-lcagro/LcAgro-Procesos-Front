import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { numero, pct, usd } from "@/shared/format/format";
import {
  CRITERIOS,
  CULTIVOS,
  NOMBRE_CULTIVO,
  TONO_SEGMENTO,
  costoPorHa,
} from "../lib/segmentacion";
import type { CostoCultivo, CriterioMatriz, Cultivo, ProductorCalculado } from "../types";

interface Props {
  productor: ProductorCalculado;
  costos: Record<Cultivo, CostoCultivo>;
  criterios: CriterioMatriz[];
  campania: string;
  onClose: () => void;
}

/**
 * Ficha del productor: de dónde sale su potencial, cuánto le vendemos y por qué está en
 * el segmento en el que está. Es la pantalla que contesta "¿por qué este cliente es B?".
 */
export function ProductorDetalle({ productor: p, costos, criterios, campania, onClose }: Props) {
  const activos = criterios.filter((c) => c.activo);
  const pesoTotal = activos.reduce((t, c) => t + c.peso, 0);

  return (
    <Modal open onClose={onClose} title={p.nombre} className="w-full max-w-2xl">
      <div className="max-h-[78vh] space-y-4 overflow-y-auto p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">{p.nombre}</h2>
            <p className="text-xs text-ink-soft">
              {p.vendedor} · canal {p.canal} · campaña {campania}
            </p>
          </div>
          <div className="text-right">
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", TONO_SEGMENTO[p.segmentoCalculado])}>
              Segmento {p.segmentoCalculado}
            </span>
            <div className="mt-1 text-xs text-ink-soft">score {p.score}/100</div>
          </div>
        </header>

        {/* La cuenta central: potencial vs. vendido */}
        <section className="rounded-card border border-line bg-panel-soft p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">Participación de bolsillo</h3>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <div className="font-display text-3xl font-semibold tabular text-ink">
                {pct(p.participacion * 100)}
              </div>
              <div className="text-xs text-ink-soft">de lo que va a gastar este año</div>
            </div>
            <div className="text-right">
              <div className="font-display text-xl font-semibold tabular text-rojo">
                {usd(p.oportunidad)}
              </div>
              <div className="text-xs text-ink-soft">sin capturar</div>
            </div>
          </div>

          <div className="flex h-6 w-full overflow-hidden rounded-md border border-line bg-panel">
            <div
              className="flex items-center justify-center bg-clementina text-[10px] font-bold text-slate-brand"
              style={{ width: `${Math.min((p.lc / p.mercado) * 100, 100).toFixed(1)}%` }}
              title={`La Clementina: ${usd(p.lc)}`}
            >
              {p.lc / p.mercado > 0.08 ? "LC" : ""}
            </div>
            <div
              className="flex items-center justify-center bg-slate-brand text-[10px] font-bold text-white"
              style={{ width: `${Math.min((p.bayer / p.mercado) * 100, 100).toFixed(1)}%` }}
              title={`Bayer: ${usd(p.bayer)}`}
            >
              {p.bayer / p.mercado > 0.08 ? "Bayer" : ""}
            </div>
          </div>

          <div className="mt-3">
            <Fila label="Mercado del productor" valor={usd(p.mercado)} />
            <Fila label="La Clementina" valor={usd(p.lc)} />
            <Fila label="Bayer (facturación directa)" valor={usd(p.bayer)} />
            <Fila
              label={`Campaña anterior`}
              valor={
                <>
                  {usd(p.totalPrev)}{" "}
                  {p.variacion != null && (
                    <span className={cn("font-normal", p.variacion >= 0 ? "text-verde" : "text-rojo")}>
                      ({p.variacion >= 0 ? "+" : ""}
                      {pct(p.variacion * 100)})
                    </span>
                  )}
                </>
              }
            />
          </div>
        </section>

        {/* De dónde sale el potencial */}
        <section className="rounded-card border border-line bg-panel p-4">
          <h3 className="mb-1 text-sm font-semibold text-ink">Plan de siembra</h3>
          <p className="mb-3 text-xs text-ink-soft">
            Se carga a mano: MacroGest no tiene las hectáreas. Es lo que convierte al productor
            en un número de mercado.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wide text-ink-soft">
                <th className="pb-1 text-left font-medium">Cultivo</th>
                <th className="pb-1 text-right font-medium">Hectáreas</th>
                <th className="pb-1 text-right font-medium">USD/ha</th>
                <th className="pb-1 text-right font-medium">Mercado</th>
              </tr>
            </thead>
            <tbody>
              {CULTIVOS.filter((c) => (p.has[c] ?? 0) > 0).map((c) => (
                <tr key={c} className="border-t border-line/50">
                  <td className="py-1.5">{NOMBRE_CULTIVO[c]}</td>
                  <td className="py-1.5 text-right tabular">{numero(p.has[c])}</td>
                  <td className="py-1.5 text-right tabular text-ink-soft">{usd(costoPorHa(costos[c]))}</td>
                  <td className="py-1.5 text-right tabular font-medium">
                    {usd(p.has[c] * costoPorHa(costos[c]))}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-line font-semibold">
                <td className="py-1.5">Total</td>
                <td className="py-1.5 text-right tabular">{numero(p.hasTotal)}</td>
                <td />
                <td className="py-1.5 text-right tabular">{usd(p.mercado)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Por qué está en ese segmento */}
        <section className="rounded-card border border-line bg-panel p-4">
          <h3 className="mb-1 text-sm font-semibold text-ink">Cómo se compone el score</h3>
          <p className="mb-3 text-xs text-ink-soft">
            Puntos obtenidos sobre {pesoTotal} disponibles, normalizados a 100.
          </p>
          <div className="space-y-2">
            {activos.map((c) => {
              const base = CRITERIOS.find((x) => x.id === c.id)?.peso ?? c.peso;
              const obtenidos =
                c.id === "rentabilidad"
                  ? Math.min(p.mix / 4, 1) * c.peso
                  : (base > 0 ? p.pts[c.id] / base : 0) * c.peso;
              return (
                <div key={c.id} className="grid grid-cols-[9rem_1fr_3.5rem] items-center gap-3 text-xs">
                  <span className="truncate text-ink-soft" title={c.nombre}>
                    {c.nombre}
                  </span>
                  <div className="h-2 overflow-hidden rounded bg-panel-soft">
                    <div
                      className="h-full rounded bg-clementina"
                      style={{ width: `${((obtenidos / c.peso) * 100).toFixed(0)}%` }}
                    />
                  </div>
                  <span className="text-right tabular font-medium">
                    {obtenidos.toFixed(1)}/{c.peso}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 border-t border-line pt-2 text-xs text-ink-soft">
            Compró <b>{p.mix}</b> sub-rubros distintos. Cuantos más, más difícil que se lo lleve
            la competencia.
          </p>
        </section>

        {/* La acción */}
        <section
          className={cn(
            "rounded-card border p-4",
            p.canal === "Ambos"
              ? "border-line bg-panel"
              : "border-clementina-deep/40 bg-clementina/10",
          )}
        >
          <h3 className="mb-1 text-sm font-semibold text-ink">Qué hacer con este productor</h3>
          <p className="text-xs leading-relaxed text-ink">{recomendacion(p)}</p>
        </section>
      </div>
    </Modal>
  );
}

/**
 * La lectura comercial de la fila. Combina segmento, canal y participación, que es
 * exactamente cómo lo explicó el cliente: a quién le puedo crecer, a quién ya le vendo todo.
 */
function recomendacion(p: ProductorCalculado): string {
  const alta = p.participacion >= 0.6;
  const grande = p.mercado >= 500_000;

  if (p.canal === "Solo Bayer")
    return `Le compra a Bayer por nuestro canal pero no nos compra insumos a nosotros: ${usd(p.oportunidad)} de mercado propio sin tocar. Es la venta cruzada más directa que hay.`;
  if (p.canal === "Solo LC")
    return `Nos compra insumos pero nunca le vendimos Bayer. Con ${numero(p.hasTotal)} hectáreas sembradas, la línea de semilla de maíz y Adengo es el camino natural.`;
  if (alta && p.segmentoCalculado === "A")
    return `Ya le vendemos el ${pct(p.participacion * 100)} de lo que gasta. Acá no hay mucho más que capturar: es cartera a defender, no a desarrollar. Corresponde fidelización, no presión de venta.`;
  if (grande && !alta)
    return `Mercado grande (${usd(p.mercado)}) con participación baja: ${usd(p.oportunidad)} sin capturar. Es la prioridad comercial más alta de esta cartera.`;
  return `Participación del ${pct(p.participacion * 100)} sobre un mercado de ${usd(p.mercado)}. Quedan ${usd(p.oportunidad)} por trabajar.`;
}

function Fila({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-t border-line/60 py-1.5 text-xs">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium tabular text-ink">{valor}</span>
    </div>
  );
}
