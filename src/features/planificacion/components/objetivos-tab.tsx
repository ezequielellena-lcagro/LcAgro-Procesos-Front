import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { KpiCard } from "@/shared/components/kpi-card";
import { pct, usd } from "@/shared/format/format";
import { objetivosPorVendedor, revisarCoherencia } from "../lib/objetivos";
import type { ModoReparto, ObjetivoLinea, ObjetivoVendedorCalculado, ProductorCalculado } from "../types";
import { AvanceBar } from "./avance-bar";

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
 * El cliente carga un **porcentaje de crecimiento por línea** y el sistema lo baja a cada
 * vendedor sobre su cierre anterior: "le ponés un 15 % a la venta... y automáticamente el
 * sistema te determina un objetivo".
 *
 * Dos cosas que el Excel no hace y acá sí:
 *  - el reparto puede ajustarse por la **oportunidad** de cada cartera, en vez de pedirle lo
 *    mismo a quien está saturado y a quien tiene todo por crecer;
 *  - se avisa cuando las líneas **se contradicen** entre sí.
 */
export function ObjetivosTab({ productores, lineas, onCambiar, esperado, campania, campaniaPrev }: Props) {
  const [modo, setModo] = useState<ModoReparto>("oportunidad");
  const [lineaSel, setLineaSel] = useState(lineas.find((l) => l.esAgregada)?.id ?? lineas[0].id);

  const setCrecimiento = (id: string, valor: number) =>
    onCambiar(lineas.map((l) => (l.id === id ? { ...l, crecimiento: valor / 100 } : l)));

  const linea = lineas.find((l) => l.id === lineaSel) ?? lineas[0];
  const medible = linea.proporcionBase != null;

  const filas = useMemo(
    () => (medible ? objetivosPorVendedor(productores, linea, modo).sort((a, b) => b.objetivo - a.objetivo) : []),
    [productores, linea, modo, medible],
  );

  const coherencia = useMemo(() => revisarCoherencia(productores, lineas), [productores, lineas]);
  const descuadre =
    coherencia?.declaradoBayer != null &&
    Math.abs(coherencia.implicitoBayer - coherencia.declaradoBayer) > 0.05;

  const suma = (f: (x: ObjetivoVendedorCalculado) => number) => filas.reduce((t, x) => t + f(x), 0);
  const totObjetivo = suma((f) => f.objetivo);
  const totPrevio = suma((f) => f.previo);
  const totReal = suma((f) => f.real);

  const columnas: Column<ObjetivoVendedorCalculado>[] = [
    {
      key: "vendedor",
      header: "Vendedor",
      cell: (f) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{f.vendedor}</div>
          <div className="text-xs text-ink-soft">
            {f.productores} productores · capta {pct(f.participacion * 100)}
          </div>
        </div>
      ),
      sortBy: (f) => f.vendedor,
    },
    { key: "previo", header: `Cierre ${campaniaPrev}`, align: "right", cell: (f) => usd(f.previo), sortBy: (f) => f.previo },
    {
      key: "crecimiento",
      header: "Crecimiento",
      align: "right",
      cell: (f) => (
        <span
          className={cn(
            "font-medium tabular",
            modo === "oportunidad" && f.crecimiento > linea.crecimiento && "text-verde",
            modo === "oportunidad" && f.crecimiento < linea.crecimiento && "text-clementina-deep",
          )}
        >
          +{pct(f.crecimiento * 100)}
        </span>
      ),
      sortBy: (f) => f.crecimiento,
    },
    {
      key: "objetivo",
      header: `Objetivo ${campania}`,
      align: "right",
      cell: (f) => (
        <div>
          <div className="font-medium tabular">{usd(f.objetivo)}</div>
          {modo === "oportunidad" && Math.abs(f.objetivo - f.objetivoPlano) > 1 && (
            <div className="text-[10px] text-ink-soft">
              plano: {usd(f.objetivoPlano)}
            </div>
          )}
        </div>
      ),
      sortBy: (f) => f.objetivo,
    },
    { key: "real", header: "Real a hoy", align: "right", cell: (f) => usd(f.real), sortBy: (f) => f.real },
    { key: "avance", header: "Avance", cell: (f) => <AvanceBar avance={f.avance} esperado={esperado} />, sortBy: (f) => f.avance },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-card border border-line bg-panel p-4 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink">Objetivos de campaña {campania}</h2>
        <p className="mb-4 text-xs text-ink-soft">
          Se carga el crecimiento por línea, no un número por vendedor. El sistema lo baja a cada
          uno sobre su cierre de {campaniaPrev}.
        </p>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-3">
          {lineas.map((l) => {
            const base = productores.reduce(
              (t, p) =>
                t +
                (l.base === "lc" ? p.lcPrev : l.base === "bayer" ? p.bayerPrev : p.lcPrev + p.bayerPrev) *
                  (l.proporcionBase ?? 0),
              0,
            );
            const sinBase = l.proporcionBase == null;
            const activa = l.id === lineaSel;

            return (
              <button
                key={l.id}
                type="button"
                onClick={() => !sinBase && setLineaSel(l.id)}
                aria-pressed={activa}
                className={cn(
                  "rounded-md border p-3 text-left transition",
                  sinBase
                    ? "cursor-default border-dashed border-clementina-deep/40 bg-clementina/5"
                    : activa
                      ? "border-clementina-deep bg-clementina/10 ring-2 ring-clementina/30"
                      : "border-line bg-panel-soft hover:border-slate-brand/40",
                )}
              >
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
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Crecimiento de ${l.nombre}`}
                  className="h-1 w-full accent-clementina-deep"
                />
                <div className="mt-2 border-t border-line pt-2 text-xs">
                  {sinBase ? (
                    <span className="text-clementina-deep">Sin base desagregada — no se puede medir</span>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-ink-soft">{campaniaPrev}: {usd(base)}</span>
                      <span className="font-medium tabular text-ink">→ {usd(base * (1 + l.crecimiento))}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Una linea sin base no es un bug a esconder: es un dato que el cliente tiene que conseguir. */}
        {lineas.some((l) => l.proporcionBase == null) && (
          <p className="mt-3 rounded-md border border-clementina-deep/40 bg-clementina/10 p-3 text-xs leading-relaxed text-ink">
            <b>Hay objetivos que no se pueden medir.</b>{" "}
            {lineas.filter((l) => l.proporcionBase == null).map((l) => l.nombre).join(", ")}: se fija
            el objetivo pero la facturación no viene desagregada en USD, solo en unidades. Para
            seguirlo hay que pedirle a Bayer el detalle por línea, o cargar la equivalencia.
          </p>
        )}

        {/* Las lineas se contienen entre si y pueden pedir cosas incompatibles. */}
        {descuadre && coherencia && (
          <p className="mt-3 rounded-md border border-rojo/40 bg-rojo/5 p-3 text-xs leading-relaxed text-ink">
            <b className="text-rojo">Las líneas se contradicen.</b> "Facturación general" contiene a
            "Facturación La Clementina": con los porcentajes actuales, Bayer queda obligado a crecer{" "}
            <b>{pct(coherencia.implicitoBayer * 100)}</b>, pero las líneas de Bayer piden{" "}
            <b>{pct(coherencia.declaradoBayer! * 100)}</b>. Hay que decidir cuál manda.
          </p>
        )}
      </section>

      {medible ? (
        <>
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
              tone={totObjetivo > 0 && totReal / totObjetivo >= esperado ? "verde" : "rojo"}
              hint={`${pct(totObjetivo > 0 ? (totReal / totObjetivo) * 100 : 0)} del objetivo · esperado ${pct(esperado * 100)}`}
            />
            <KpiCard
              label="Proyección"
              value={usd(esperado > 0 ? totReal / esperado : 0)}
              tone={(esperado > 0 ? totReal / esperado : 0) >= totObjetivo ? "verde" : "rojo"}
              hint="a ritmo estacional de la campaña"
            />
          </div>

          <section>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">
                  Bajada por vendedor — {linea.nombre}
                </h2>
                <p className="text-xs text-ink-soft">
                  Derivado: nadie carga estos números a mano.
                </p>
              </div>
              <div className="flex gap-1 rounded-md border border-line bg-panel p-0.5">
                {(["plano", "oportunidad"] as ModoReparto[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModo(m)}
                    aria-pressed={modo === m}
                    className={cn(
                      "rounded px-3 py-1.5 text-xs font-semibold transition",
                      modo === m ? "bg-slate-brand text-white" : "text-ink-soft hover:bg-panel-soft",
                    )}
                  >
                    {m === "plano" ? "Mismo % para todos" : "Ajustado por oportunidad"}
                  </button>
                ))}
              </div>
            </div>

            <DataTable
              columns={columnas}
              rows={filas}
              getRowKey={(f) => f.vendedor}
              empty="Sin vendedores."
              footer={[
                "Total",
                usd(totPrevio),
                `+${pct(totPrevio > 0 ? (totObjetivo / totPrevio - 1) * 100 : 0)}`,
                usd(totObjetivo),
                usd(totReal),
                <AvanceBar key="t" avance={totObjetivo > 0 ? totReal / totObjetivo : 0} esperado={esperado} />,
              ]}
            />

            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              {modo === "oportunidad" ? (
                <>
                  El crecimiento se ajusta por la participación de cada cartera —más exigencia a
                  quien tiene más por capturar— y después se reescala para que{" "}
                  <b>el total de la compañía sea el mismo</b>: no cambia cuánto se pide, cambia a
                  quién. Es la fórmula que ya usa Volumen Acopiado en el backend.
                </>
              ) : (
                <>
                  Mismo porcentaje para todos. Pedirle +{Math.round(linea.crecimiento * 100)} % a
                  quien ya capta el 78 % de su cartera lo obliga a llegar al{" "}
                  {pct(78 * (1 + linea.crecimiento))}; a quien capta el 12 %, apenas al{" "}
                  {pct(12 * (1 + linea.crecimiento))}.
                </>
              )}
            </p>
          </section>
        </>
      ) : (
        <p className="rounded-card border border-line bg-panel p-6 text-center text-sm text-ink-soft">
          <b className="text-ink">{linea.nombre}</b> no tiene base desagregada, así que no se puede
          bajar por vendedor ni seguir su avance. Elegí otra línea.
        </p>
      )}

      <p className="text-center text-xs leading-relaxed text-ink-soft">
        En la app real esto persiste en <b>ObjetivoVendedor</b> con línea y fecha de vigencia:
        queda el objetivo derivado, el acordado si se ajusta a mano, quién lo acordó y cuándo.
      </p>
    </div>
  );
}
