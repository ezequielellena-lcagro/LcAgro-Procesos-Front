import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { KpiCard } from "@/shared/components/kpi-card";
import { numero, pct, usd } from "@/shared/format/format";
import { TONO_SEGMENTO } from "../lib/segmentacion";
import type { Canal, CriterioMatriz, ProductorCalculado, Segmento } from "../types";
import { ProductorDetalle } from "./productor-detalle";

interface Props {
  productores: ProductorCalculado[];
  costos: Parameters<typeof ProductorDetalle>[0]["costos"];
  criterios: CriterioMatriz[];
  campania: string;
  /** Abre la configuración de la matriz. La segmentación se lee acá y se configura aparte. */
  onConfigurarSegmentacion: () => void;
}

type Orden = "oportunidad" | "mercado" | "vendido" | "participacion" | "nombre";

/**
 * Cartera de productores ordenada por oportunidad.
 *
 * El orden por defecto NO es por facturación: es por lo que falta capturar. Un ranking por
 * facturación pone arriba a los clientes que ya están trabajados; este pone arriba dónde ir.
 */
export function CarteraTab({
  productores,
  costos,
  criterios,
  campania,
  onConfigurarSegmentacion,
}: Props) {
  const [vendedor, setVendedor] = useState("");
  const [segmento, setSegmento] = useState("");
  const [canal, setCanal] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<Orden>("oportunidad");
  const [detalle, setDetalle] = useState<ProductorCalculado | null>(null);

  const vendedores = useMemo(
    () => [...new Set(productores.map((p) => p.vendedor))].sort((a, b) => a.localeCompare(b, "es")),
    [productores],
  );

  /**
   * Todos los filtros MENOS el de segmento: es lo que alimenta la banda de segmentos, para que
   * siga mostrando el reparto completo cuando clickeás uno (si no, se filtra a sí misma).
   */
  const filasSinSegmento = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productores
      .filter((p) => !q || p.nombre.toLowerCase().includes(q))
      .filter((p) => !vendedor || p.vendedor === vendedor)
      .filter((p) => !canal || p.canal === canal);
  }, [productores, busqueda, vendedor, canal]);

  const filas = useMemo(() => {
    const cmp: Record<Orden, (a: ProductorCalculado, b: ProductorCalculado) => number> = {
      oportunidad: (a, b) => b.oportunidad - a.oportunidad,
      mercado: (a, b) => b.mercado - a.mercado,
      vendido: (a, b) => b.total - a.total,
      participacion: (a, b) => a.participacion - b.participacion,
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, "es"),
    };
    return filasSinSegmento
      .filter((p) => !segmento || p.segmentoCalculado === segmento)
      .sort(cmp[orden]);
  }, [filasSinSegmento, segmento, orden]);

  const suma = (f: (p: ProductorCalculado) => number) => filas.reduce((t, p) => t + f(p), 0);
  const mercado = suma((p) => p.mercado);
  const vendido = suma((p) => p.total);
  const oportunidad = suma((p) => p.oportunidad);
  const soloUnCanal = filas.filter((p) => p.canal !== "Ambos");

  const columnas: Column<ProductorCalculado>[] = [
    {
      key: "productor",
      header: "Productor",
      cell: (p) => (
        <div className="min-w-0">
          <div className="truncate font-medium" title={p.nombre}>
            {p.nombre}
          </div>
          <div className="truncate text-xs text-ink-soft">{p.vendedor}</div>
        </div>
      ),
      sortBy: (p) => p.nombre,
    },
    {
      key: "segmento",
      header: "Seg.",
      cell: (p) => (
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", TONO_SEGMENTO[p.segmentoCalculado])}>
          {p.segmentoCalculado}
        </span>
      ),
      sortBy: (p) => p.score,
    },
    { key: "canal", header: "Canal", cell: (p) => <CanalBadge canal={p.canal} />, sortBy: (p) => p.canal },
    { key: "has", header: "Has", align: "right", cell: (p) => numero(p.hasTotal), sortBy: (p) => p.hasTotal },
    {
      key: "mercado",
      header: "Mercado",
      align: "right",
      cell: (p) => usd(p.mercado),
      sortBy: (p) => p.mercado,
    },
    { key: "lc", header: "LC", align: "right", cell: (p) => usd(p.lc), sortBy: (p) => p.lc },
    { key: "bayer", header: "Bayer", align: "right", cell: (p) => usd(p.bayer), sortBy: (p) => p.bayer },
    {
      key: "participacion",
      header: "Participación",
      cell: (p) => <ParticipacionBar productor={p} />,
      sortBy: (p) => p.participacion,
    },
    {
      key: "oportunidad",
      header: "Oportunidad",
      align: "right",
      cell: (p) => <span className="font-medium tabular text-rojo">{usd(p.oportunidad)}</span>,
      sortBy: (p) => p.oportunidad,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <KpiCard label="Productores" value={filas.length} hint={`${numero(suma((p) => p.hasTotal))} has sembradas`} />
        <KpiCard label="Mercado de la cartera" value={usd(mercado)} hint="lo que van a gastar en insumos" />
        <KpiCard
          label="Vendido"
          value={usd(vendido)}
          hint={`LC ${usd(suma((p) => p.lc))} · Bayer ${usd(suma((p) => p.bayer))}`}
        />
        <KpiCard
          label="Participación"
          value={pct(mercado > 0 ? (vendido / mercado) * 100 : 0)}
          tone={vendido / mercado >= 0.3 ? "verde" : "rojo"}
          hint="de bolsillo del productor"
        />
        <KpiCard
          label="Oportunidad"
          tone="rojo"
          value={usd(oportunidad)}
          hint={`${soloUnCanal.length} compran por un solo canal`}
        />
      </div>

      <BandaSegmentos
        productores={filasSinSegmento}
        segmentoActivo={segmento}
        onSegmento={setSegmento}
        onConfigurar={onConfigurarSegmentacion}
      />

      <FilterBar>
        <FilterField label="Productor">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar…"
            className="h-9 w-48 rounded-md border border-line bg-panel px-2 text-sm text-ink outline-none focus:border-clementina-deep"
          />
        </FilterField>
        <FilterField label="Vendedor">
          <Select value={vendedor} onChange={setVendedor} vacio="Todos">
            {vendedores.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Segmento">
          <Select value={segmento} onChange={setSegmento} vacio="Todos">
            {(["A", "B", "C", "D"] as Segmento[]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Canal">
          <Select value={canal} onChange={setCanal} vacio="Todos">
            {(["Ambos", "Solo LC", "Solo Bayer"] as Canal[]).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FilterField>
        <div className="flex-1" />
        <FilterField label="Ordenar por">
          <Select value={orden} onChange={(v) => setOrden(v as Orden)}>
            <option value="oportunidad">Oportunidad</option>
            <option value="mercado">Mercado</option>
            <option value="vendido">Vendido</option>
            <option value="participacion">Menor participación</option>
            <option value="nombre">Nombre</option>
          </Select>
        </FilterField>
      </FilterBar>

      <section>
        <DataTable
          columns={columnas}
          rows={filas}
          getRowKey={(p) => p.id}
          onRowClick={setDetalle}
          empty="Ningún productor coincide con el filtro."
        />
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          Clic en una fila para ver la ficha. El <b>mercado</b> sale del plan de siembra del
          productor por el costo de insumos de cada cultivo; la <b>oportunidad</b> es lo que
          gasta menos lo que nos compra. Ordenado por oportunidad, no por facturación: el
          ranking por facturación muestra a los que ya están trabajados.
        </p>
      </section>

      {detalle && (
        <ProductorDetalle
          productor={detalle}
          costos={costos}
          criterios={criterios}
          campania={campania}
          onClose={() => setDetalle(null)}
        />
      )}
    </div>
  );
}

/**
 * Distribución A/B/C/D como banda de lectura, no como pantalla aparte.
 *
 * Cada tarjeta es además un filtro: la segmentación se mira seguido, se configura casi nunca.
 * Muestra participación y oportunidad por segmento porque es donde se ve lo contraintuitivo:
 * el segmento "Estándar" concentra la mayor parte del mercado sin capturar.
 */
function BandaSegmentos({
  productores,
  segmentoActivo,
  onSegmento,
  onConfigurar,
}: {
  productores: ProductorCalculado[];
  segmentoActivo: string;
  onSegmento: (s: string) => void;
  onConfigurar: () => void;
}) {
  const oportunidadTotal = productores.reduce((t, p) => t + p.oportunidad, 0) || 1;

  const segmentos = (["A", "B", "C", "D"] as Segmento[]).map((s) => {
    const g = productores.filter((p) => p.segmentoCalculado === s);
    const suma = (f: (p: ProductorCalculado) => number) => g.reduce((t, p) => t + f(p), 0);
    const mercado = suma((p) => p.mercado);
    const oportunidad = suma((p) => p.oportunidad);
    return {
      segmento: s,
      cantidad: g.length,
      participacion: mercado > 0 ? suma((p) => p.total) / mercado : 0,
      oportunidad,
      shareOportunidad: oportunidad / oportunidadTotal,
    };
  });

  return (
    <section className="rounded-card border border-line bg-panel p-3.5 shadow-card">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Segmentación de la cartera</h2>
          <p className="text-xs text-ink-soft">
            Clic en un segmento para filtrar. Es un Pareto: los segmentos bajos no son clientes
            malos, son los que tienen más mercado sin capturar.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onConfigurar}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Configurar matriz
        </Button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2">
        {segmentos.map((s) => {
          const activo = segmentoActivo === s.segmento;
          return (
            <button
              key={s.segmento}
              type="button"
              onClick={() => onSegmento(activo ? "" : s.segmento)}
              aria-pressed={activo}
              className={cn(
                "rounded-md border p-2.5 text-left transition",
                activo
                  ? "border-clementina-deep bg-clementina/10 ring-2 ring-clementina/30"
                  : "border-line bg-panel-soft hover:border-slate-brand/40",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", TONO_SEGMENTO[s.segmento])}>
                  {s.segmento}
                </span>
                <span className="font-display text-lg font-semibold tabular text-ink">{s.cantidad}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-panel" title="Participación de bolsillo">
                <div
                  className="h-full rounded bg-clementina"
                  style={{ width: `${Math.min(s.participacion * 100, 100).toFixed(1)}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-ink-soft">
                capta {pct(s.participacion * 100)} · <b className="text-rojo">{pct(s.shareOportunidad * 100)}</b>{" "}
                de la oportunidad
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ParticipacionBar({ productor: p }: { productor: ProductorCalculado }) {
  const tono = p.participacion >= 0.5 ? "bg-verde" : p.participacion >= 0.2 ? "bg-clementina-deep" : "bg-rojo";
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <div className="h-2 w-20 overflow-hidden rounded bg-panel-soft">
        <div className={cn("h-full rounded", tono)} style={{ width: `${Math.min(p.participacion * 100, 100).toFixed(1)}%` }} />
      </div>
      <span className="text-xs tabular text-ink-soft">{pct(p.participacion * 100)}</span>
    </div>
  );
}

function CanalBadge({ canal }: { canal: Canal }) {
  const estilo =
    canal === "Ambos"
      ? "bg-verde/10 text-verde"
      : "bg-clementina/15 text-clementina-deep";
  return <span className={cn("whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium", estilo)}>{canal}</span>;
}

function Select({
  value,
  onChange,
  vacio,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  vacio?: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-line bg-panel px-2 text-sm text-ink outline-none focus:border-clementina-deep"
    >
      {vacio && <option value="">{vacio}</option>}
      {children}
    </select>
  );
}
