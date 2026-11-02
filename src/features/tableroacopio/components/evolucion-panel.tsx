import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { acumular, cerealesDe, type PuntoEvolucion } from "../lib/evolucion";
import { conSigno, dos, usd0 } from "../lib/formato";
import type { EvolucionMes } from "../types";

const MESES_VISIBLES = 24;

/**
 * Gráfico sin dependencias: barras = lo que sumó o restó el total en el mes (USD, eje derecho);
 * línea = % de posición acumulado de todas las campañas (eje izquierdo).
 */
function Grafico({ puntos }: { puntos: PuntoEvolucion[] }) {
  const W = 900;
  const H = 240;
  const pad = { top: 16, right: 70, bottom: 28, left: 54 };
  const iw = W - pad.left - pad.right;
  const ih = H - pad.top - pad.bottom;

  const pcts = puntos.map((p) => p.pctTotal).filter((v): v is number => v != null);
  const pMin = Math.min(0, ...pcts);
  const pMax = Math.max(0.5, ...pcts);
  const maxBar = Math.max(1, ...puntos.map((p) => Math.abs(p.resultadoMes)));
  const paso = iw / Math.max(1, puntos.length);

  const yPct = (v: number) => pad.top + ih - ((v - pMin) / (pMax - pMin || 1)) * ih;
  const yUsd = (v: number) => pad.top + ih / 2 - (v / maxBar) * (ih / 2);
  const xCentro = (i: number) => pad.left + paso * i + paso / 2;

  const linea = puntos
    .map((p, i) =>
      p.pctTotal == null ? null : `${xCentro(i).toFixed(1)},${yPct(p.pctTotal).toFixed(1)}`,
    )
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Evolución del resultado de la posición"
    >
      {/* barras: resultado del mes */}
      <line x1={pad.left} x2={pad.left + iw} y1={yUsd(0)} y2={yUsd(0)} stroke="var(--color-line)" />
      {puntos.map((p, i) => {
        const y = yUsd(Math.max(0, p.resultadoMes));
        const h = Math.abs(yUsd(p.resultadoMes) - yUsd(0));
        return (
          <rect
            key={p.mes}
            x={pad.left + paso * i + paso * 0.2}
            y={y}
            width={paso * 0.6}
            height={Math.max(0.5, h)}
            fill={p.resultadoMes >= 0 ? "var(--color-slate-soft)" : "var(--color-rojo)"}
            opacity={0.55}
          >
            <title>{`${p.mes}: ${usd0(p.resultadoMes)} en el mes`}</title>
          </rect>
        );
      })}
      {/* línea: % acumulado de todas las campañas */}
      <polyline
        points={linea}
        fill="none"
        stroke="var(--color-slate-brand)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {puntos.map((p, i) =>
        p.pctTotal == null ? null : (
          <circle
            key={p.mes}
            cx={xCentro(i)}
            cy={yPct(p.pctTotal)}
            r={2.5}
            fill="var(--color-slate-brand)"
          >
            <title>{`${p.mes}: ${dos(p.pctTotal)} % acumulado`}</title>
          </circle>
        ),
      )}
      {/* ejes */}
      {[pMin, (pMin + pMax) / 2, pMax].map((v) => (
        <text
          key={`p${v}`}
          x={pad.left - 6}
          y={yPct(v) + 4}
          textAnchor="end"
          fontSize={11}
          fill="var(--color-ink-soft)"
        >
          {dos(v)} %
        </text>
      ))}
      {[maxBar, 0, -maxBar].map((v) => (
        <text
          key={`u${v}`}
          x={pad.left + iw + 6}
          y={yUsd(v) + 4}
          fontSize={11}
          fill="var(--color-ink-soft)"
        >
          {usd0(v)}
        </text>
      ))}
      {puntos.map((p, i) =>
        i % 3 === 0 ? (
          <text
            key={`m${p.mes}`}
            x={xCentro(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={11}
            fill="var(--color-ink-soft)"
          >
            {p.mes}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function EvolucionPanel({ filas }: { filas: EvolucionMes[] }) {
  const cereales = useMemo(() => cerealesDe(filas), [filas]);
  const [elegidos, setElegidos] = useState<Set<string> | null>(null);
  const puntos = useMemo(() => acumular(filas, elegidos), [filas, elegidos]);
  const visibles = puntos.slice(-MESES_VISIBLES);
  const campanias = useMemo(
    () => [...new Set(visibles.flatMap((p) => Object.keys(p.porCampania)))].sort(),
    [visibles],
  );

  function alternar(cereal: string) {
    const actual = new Set(elegidos ?? []);
    if (actual.has(cereal)) actual.delete(cereal);
    else actual.add(cereal);
    setElegidos(actual.size === 0 ? null : actual);
  }

  const ultimo = visibles.at(-1);

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-line bg-panel p-4 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink">
          Cómo viene dando el acumulado · todas las campañas
        </h2>
        <p className="mt-1 text-xs text-ink-soft">
          El resultado de la posición de todas las campañas a la vez, mes a mes, desde que hay
          datos. Cada celda es la campaña <b>entera hasta ese mes</b>, con su arrastre: el último
          mes da lo mismo que la tarjeta. Las dos puntas de un negocio pueden caer en campañas
          distintas; para saber si un mes fue bueno hay que mirar el <b>Total</b>.
        </p>

        <div className="no-print mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setElegidos(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold",
              elegidos == null
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-panel text-ink-soft",
            )}
          >
            Todos los cereales
          </button>
          {cereales.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => alternar(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                elegidos?.has(c)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-panel text-ink-soft",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-soft">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 bg-slate-brand" /> % de posición acumulado de
            todas las campañas (eje izquierdo)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 bg-slate-soft/60" />
            <span className="inline-block h-3 w-3 bg-rojo/60" /> lo que sumó o restó el total en el
            mes, en USD (eje derecho)
          </span>
        </div>
        {visibles.length > 0 ? (
          <Grafico puntos={visibles} />
        ) : (
          <p className="mt-4 text-sm text-ink-soft">Sin datos.</p>
        )}
        {ultimo && (
          <p className="text-xs text-ink-soft">
            A {ultimo.mes}: {ultimo.pctTotal == null ? "—" : `${dos(ultimo.pctTotal)} %`} sobre lo
            comprado, con un resultado de {usd0(ultimo.resultadoTotal)} sumando todas las campañas.
          </p>
        )}
      </div>

      <div className="rounded-card border border-line bg-panel shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-right text-xs text-ink-soft">
                <th className="px-4 py-2 text-left font-medium">Mes</th>
                {campanias.map((c) => (
                  <th key={c} className="px-3 py-2 font-medium">
                    {c}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">Resultado total</th>
                <th className="px-3 py-2 font-medium">% total</th>
              </tr>
            </thead>
            <tbody>
              {[...visibles].reverse().map((p) => (
                <tr
                  key={p.mes}
                  className="border-b border-line-soft text-right tabular last:border-0"
                >
                  <td className="px-4 py-1.5 text-left text-ink">{p.mes}</td>
                  {campanias.map((c) => {
                    const v = p.porCampania[c];
                    return (
                      <td key={c} className="px-3 py-1.5">
                        {v?.pct == null ? (
                          <span className="text-ink-soft">—</span>
                        ) : (
                          <>
                            <div className="text-ink">{dos(v.pct)} %</div>
                            {v.deltaPp != null && Math.abs(v.deltaPp) >= 0.005 && (
                              <div
                                className={cn(
                                  "text-[11px]",
                                  v.deltaPp > 0 ? "text-verde" : "text-rojo",
                                )}
                              >
                                {conSigno(v.deltaPp)} pp
                              </div>
                            )}
                          </>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-ink">{usd0(p.resultadoTotal)}</td>
                  <td className="px-3 py-1.5 font-semibold text-ink">
                    {p.pctTotal == null ? "—" : `${dos(p.pctTotal)} %`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
