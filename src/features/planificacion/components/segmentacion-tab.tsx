import { cn } from "@/lib/utils";
import { numero, pct, usd } from "@/shared/format/format";
import { CORTES, TONO_SEGMENTO } from "../lib/segmentacion";
import type { CriterioMatriz, ProductorCalculado, Segmento } from "../types";

interface Props {
  productores: ProductorCalculado[];
  criterios: CriterioMatriz[];
  onCambiar: (criterios: CriterioMatriz[]) => void;
}

/**
 * La matriz de segmentación, editable.
 *
 * El cliente lo pidió textual: "una matriz que te saca tantos puntos y te dice cómo los
 * clasifica en ABC — eso también lo podés configurar". Mover un peso acá recalcula el
 * score y el segmento de los 425 productores en el acto, que es lo que en el Excel
 * significa rehacer la planilla.
 */
export function SegmentacionTab({ productores, criterios, onCambiar }: Props) {
  const pesoActivo = criterios.filter((c) => c.activo).reduce((t, c) => t + c.peso, 0);

  const setPeso = (id: CriterioMatriz["id"], peso: number) =>
    onCambiar(criterios.map((c) => (c.id === id ? { ...c, peso: Math.max(0, Math.min(50, peso)) } : c)));

  const toggle = (id: CriterioMatriz["id"]) =>
    onCambiar(criterios.map((c) => (c.id === id ? { ...c, activo: !c.activo } : c)));

  const porSegmento = (["A", "B", "C", "D"] as Segmento[]).map((s) => {
    const g = productores.filter((p) => p.segmentoCalculado === s);
    const sum = (f: (p: ProductorCalculado) => number) => g.reduce((t, p) => t + f(p), 0);
    const mercado = sum((p) => p.mercado);
    const vendido = sum((p) => p.total);
    return {
      segmento: s,
      etiqueta: CORTES.find((c) => c.segmento === s)!.etiqueta,
      desde: CORTES.find((c) => c.segmento === s)!.desde,
      cantidad: g.length,
      has: sum((p) => p.hasTotal),
      mercado,
      vendido,
      participacion: mercado > 0 ? vendido / mercado : 0,
      oportunidad: sum((p) => p.oportunidad),
    };
  });

  const totalProd = productores.length || 1;

  return (
    <div className="space-y-5">
      <section className="rounded-card border border-line bg-panel p-4 shadow-card">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-ink">Matriz de segmentación</h2>
          <span className="text-xs text-ink-soft">
            {pesoActivo} puntos activos · el score se normaliza a 100
          </span>
        </div>
        <p className="mb-4 text-xs text-ink-soft">
          Mové un peso o apagá un criterio y mirá cómo se reacomodan los segmentos abajo.
        </p>

        <div className="space-y-2">
          {criterios.map((c) => (
            <div
              key={c.id}
              className={cn(
                "grid grid-cols-[1.5rem_11rem_1fr_5rem] items-center gap-3 rounded-md border p-2.5 transition",
                c.activo ? "border-line bg-panel-soft" : "border-dashed border-line bg-panel opacity-60",
              )}
            >
              <input
                type="checkbox"
                checked={c.activo}
                onChange={() => toggle(c.id)}
                aria-label={`Activar ${c.nombre}`}
                className="h-4 w-4 accent-clementina-deep"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">{c.nombre}</div>
                <div className="truncate text-[10px] text-ink-soft">{c.bandas.join(" · ")}</div>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                step={5}
                value={c.peso}
                disabled={!c.activo}
                onChange={(e) => setPeso(c.id, Number(e.target.value))}
                aria-label={`Peso de ${c.nombre}`}
                className="h-1 accent-clementina-deep disabled:opacity-40"
              />
              <span className="text-right font-display text-lg font-semibold tabular text-ink">
                {c.peso}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-3 rounded-md border border-clementina-deep/40 bg-clementina/10 p-3 text-xs leading-relaxed text-ink">
          <b>El Excel de hoy define seis criterios pero calcula cinco.</b> "Rentabilidad LC" (20
          puntos) está en la matriz y nunca se computa, así que el score real se normaliza sobre
          80. La app sí puede calcularlo: la rentabilidad por línea ya sale del módulo de
          Comisiones. Prendé el criterio y mirá cuántos productores cambian de segmento.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-display text-lg font-semibold text-ink">Distribución de la cartera</h2>
        <p className="mb-3 text-xs text-ink-soft">
          Es un Pareto: pocos productores concentran el mercado. Los segmentos C y D no son
          "clientes malos" — son los que tienen más mercado sin capturar.
        </p>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-3">
          {porSegmento.map((s) => (
            <div key={s.segmento} className="rounded-card border border-line bg-panel p-4 shadow-card">
              <div className="mb-2 flex items-center justify-between">
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", TONO_SEGMENTO[s.segmento])}>
                  {s.segmento} · {s.etiqueta}
                </span>
                <span className="text-[10px] text-ink-soft">score ≥ {s.desde}</span>
              </div>

              <div className="font-display text-2xl font-semibold tabular text-ink">{s.cantidad}</div>
              <div className="text-xs text-ink-soft">
                productores · {pct((s.cantidad / totalProd) * 100)} de la cartera
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded bg-panel-soft" title="Participación de bolsillo">
                <div
                  className="h-full rounded bg-clementina"
                  style={{ width: `${Math.min(s.participacion * 100, 100).toFixed(1)}%` }}
                />
              </div>

              <div className="mt-2 space-y-1 text-xs">
                <Linea k="Hectáreas" v={numero(s.has)} />
                <Linea k="Mercado" v={usd(s.mercado)} />
                <Linea k="Vendido" v={usd(s.vendido)} />
                <Linea k="Participación" v={pct(s.participacion * 100)} />
                <Linea k="Oportunidad" v={usd(s.oportunidad)} tono="rojo" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Linea({ k, v, tono }: { k: string; v: string; tono?: "rojo" }) {
  return (
    <div className="flex justify-between gap-2 border-t border-line/50 pt-1">
      <span className="text-ink-soft">{k}</span>
      <span className={cn("font-medium tabular", tono === "rojo" ? "text-rojo" : "text-ink")}>{v}</span>
    </div>
  );
}
