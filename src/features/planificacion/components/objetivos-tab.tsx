import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { KpiCard } from "@/shared/components/kpi-card";
import { pct, usd } from "@/shared/format/format";
import { AvanceBar } from "./avance-bar";
import type { ObjetivoLinea, ProductorCalculado } from "../types";

interface Props {
  productores: ProductorCalculado[];
  lineas: ObjetivoLinea[];
  onCambiar: (lineas: ObjetivoLinea[]) => void;
  /** Fracción de campaña que debería llevarse vendida a hoy, según estacionalidad. */
  esperado: number;
  campania: string;
  campaniaPrev: string;
}

/**
 * Objetivos de campaña.
 *
 * El cliente NO carga un número por vendedor. Carga un **porcentaje de crecimiento por línea**
 * y el sistema lo baja a cada uno sobre su cierre anterior:
 *
 *   "Le ponés un 15 % a la venta, un 10 % a la rentabilidad... vos eso lo cargás y
 *    automáticamente el sistema te lo hace y te determina un objetivo."
 *
 * Por eso acá se editan porcentajes, y la tabla de vendedores es **derivada**: se recalcula
 * sola. Lo que sí se guarda por vendedor es el ajuste manual cuando se acuerda otra cosa.
 */
export function ObjetivosTab({ productores, lineas, onCambiar, esperado, campania, campaniaPrev }: Props) {
  const setCrecimiento = (id: string, valor: number) =>
    onCambiar(lineas.map((l) => (l.id === id ? { ...l, crecimiento: valor / 100 } : l)));

  /** Cierre anterior y real de la campaña, por vendedor. El objetivo sale de aplicarle el %. */
  const porVendedor = useMemo(() => {
    const mapa = new Map<string, { lcPrev: number; bayerPrev: number; lc: number; bayer: number }>();
    for (const p of productores) {
      const a = mapa.get(p.vendedor) ?? { lcPrev: 0, bayerPrev: 0, lc: 0, bayer: 0 };
      a.lcPrev += p.lcPrev;
      a.bayerPrev += p.bayerPrev;
      a.lc += p.lc;
      a.bayer += p.bayer;
      mapa.set(p.vendedor, a);
    }
    return [...mapa.entries()].map(([vendedor, a]) => ({ vendedor, ...a }));
  }, [productores]);

  const baseDe = (a: { lcPrev: number; bayerPrev: number }, base: ObjetivoLinea["base"]) =>
    base === "lc" ? a.lcPrev : base === "bayer" ? a.bayerPrev : a.lcPrev + a.bayerPrev;

  const realDe = (a: { lc: number; bayer: number }, base: ObjetivoLinea["base"]) =>
    base === "lc" ? a.lc : base === "bayer" ? a.bayer : a.lc + a.bayer;

  /** Línea principal para la tabla de bajada: la facturación general. */
  const principal = lineas.find((l) => l.base === "total") ?? lineas[0];

  const filas = porVendedor
    .map((a) => {
      const previo = baseDe(a, principal.base);
      const objetivo = previo * (1 + principal.crecimiento);
      const real = realDe(a, principal.base);
      return { ...a, previo, objetivo, real, avance: objetivo > 0 ? real / objetivo : 0 };
    })
    .sort((x, y) => y.objetivo - x.objetivo);

  const totObjetivo = filas.reduce((t, f) => t + f.objetivo, 0);
  const totPrevio = filas.reduce((t, f) => t + f.previo, 0);
  const totReal = filas.reduce((t, f) => t + f.real, 0);

  const columnas: Column<(typeof filas)[number]>[] = [
    { key: "vendedor", header: "Vendedor", cell: (f) => <span className="font-medium">{f.vendedor}</span>, sortBy: (f) => f.vendedor },
    { key: "previo", header: `Cierre ${campaniaPrev}`, align: "right", cell: (f) => usd(f.previo), sortBy: (f) => f.previo },
    {
      key: "objetivo",
      header: `Objetivo ${campania}`,
      align: "right",
      cell: (f) => <span className="font-medium tabular">{usd(f.objetivo)}</span>,
      sortBy: (f) => f.objetivo,
    },
    { key: "real", header: "Real a hoy", align: "right", cell: (f) => usd(f.real), sortBy: (f) => f.real },
    {
      key: "avance",
      header: "Avance",
      cell: (f) => <AvanceBar avance={f.avance} esperado={esperado} />,
      sortBy: (f) => f.avance,
    },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-card border border-line bg-panel p-4 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink">Objetivos de campaña {campania}</h2>
        <p className="mb-4 text-xs text-ink-soft">
          Se carga el crecimiento por línea, no un número por vendedor. El sistema lo baja a cada
          uno sobre su cierre de {campaniaPrev}.
        </p>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
          {lineas.map((l) => {
            const previo = porVendedor.reduce((t, a) => t + baseDe(a, l.base), 0);
            return (
              <div key={l.id} className="rounded-md border border-line bg-panel-soft p-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{l.nombre}</span>
                  <span className="font-display text-lg font-semibold tabular text-clementina-deep">
                    +{Math.round(l.crecimiento * 100)} %
                  </span>
                </div>
                <input
                  type="range"
                  min={-10}
                  max={120}
                  step={1}
                  value={Math.round(l.crecimiento * 100)}
                  onChange={(e) => setCrecimiento(l.id, Number(e.target.value))}
                  aria-label={`Crecimiento de ${l.nombre}`}
                  className="h-1 w-full accent-clementina-deep"
                />
                <div className="mt-2 flex justify-between border-t border-line pt-2 text-xs">
                  <span className="text-ink-soft">{campaniaPrev}: {usd(previo)}</span>
                  <span className="font-medium tabular text-ink">→ {usd(previo * (1 + l.crecimiento))}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <KpiCard label={`Cierre ${campaniaPrev}`} value={usd(totPrevio)} hint="base del cálculo" />
        <KpiCard
          label={`Objetivo ${campania}`}
          value={usd(totObjetivo)}
          hint={`+${pct(totPrevio > 0 ? (totObjetivo / totPrevio - 1) * 100 : 0)} sobre el cierre`}
        />
        <KpiCard
          label="Real a hoy"
          value={usd(totReal)}
          tone={totReal / totObjetivo >= esperado ? "verde" : "rojo"}
          hint={`${pct((totReal / totObjetivo) * 100)} del objetivo · esperado ${pct(esperado * 100)}`}
        />
        <KpiCard
          label="Proyección"
          value={usd(esperado > 0 ? totReal / esperado : 0)}
          tone={(esperado > 0 ? totReal / esperado : 0) >= totObjetivo ? "verde" : "rojo"}
          hint="a ritmo estacional de la campaña"
        />
      </div>

      <section>
        <h2 className="mb-1 font-display text-lg font-semibold text-ink">
          Bajada por vendedor — {principal.nombre}
        </h2>
        <p className="mb-3 text-xs text-ink-soft">
          Derivado: nadie carga estos números a mano. La marca vertical de cada barra es el
          ritmo esperado a hoy según la estacionalidad de la campaña.
        </p>
        <DataTable
          columns={columnas}
          rows={filas}
          getRowKey={(f) => f.vendedor}
          empty="Sin vendedores."
          footer={[
            "Total",
            usd(totPrevio),
            usd(totObjetivo),
            usd(totReal),
            <AvanceBar key="t" avance={totObjetivo > 0 ? totReal / totObjetivo : 0} esperado={esperado} />,
          ]}
        />
      </section>

      <p className={cn("text-center text-xs leading-relaxed text-ink-soft")}>
        En la app real esto persiste en <b>ObjetivoVendedor</b> con línea y fecha de vigencia:
        queda el objetivo derivado, el acordado si se ajusta a mano, quién lo acordó y cuándo.
        Sin eso no se puede contestar contra qué objetivo se evaluó a alguien en abril.
      </p>
    </div>
  );
}
