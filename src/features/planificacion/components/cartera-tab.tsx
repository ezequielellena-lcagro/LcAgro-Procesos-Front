import { useState } from "react";
import { RefreshCw, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { ErrorState } from "@/shared/components/error-state";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { KpiCard } from "@/shared/components/kpi-card";
import { Pagination } from "@/shared/components/pagination";
import { numero, oDash, pct, usd } from "@/shared/format/format";
import { ETIQUETA_CANAL, TONO_CANAL, TONO_SEGMENTO } from "../lib/presentacion";
import { useProductorTableroDetalle } from "../queries/use-tablero-planificacion";
import type {
  CanalVentaPlanificacion,
  ProductorTableroDto,
  Segmento,
  TableroFiltros,
  TableroPlanificacionDto,
} from "../types";
import { ProductorDetalle } from "./productor-detalle";

interface Props {
  tablero: TableroPlanificacionDto;
  filtros: TableroFiltros;
  busqueda: string;
  actualizando: boolean;
  onBusqueda: (valor: string) => void;
  onFiltros: (cambios: Partial<TableroFiltros>) => void;
  onLimpiarFiltros: () => void;
  onConfigurarSegmentacion: () => void;
}

const SEGMENTOS: Segmento[] = ["A", "B", "C", "D"];
const CANALES: CanalVentaPlanificacion[] = ["Ambos", "SoloLc", "SoloBayer", "SinCompras"];

/** Cartera operativa: todos los cálculos y agregados llegan del snapshot único del servidor. */
export function CarteraTab({
  tablero,
  filtros,
  busqueda,
  actualizando,
  onBusqueda,
  onFiltros,
  onLimpiarFiltros,
  onConfigurarSegmentacion,
}: Props) {
  const [productorId, setProductorId] = useState<number>();
  const detalle = useProductorTableroDetalle(productorId, tablero.campania);
  const resumen = tablero.resumenSeleccion;

  const columnas: Column<ProductorTableroDto>[] = [
    {
      key: "productor",
      header: "Productor",
      cell: ({ productor }) => (
        <div className="min-w-0">
          <button
            type="button"
            aria-label={`Abrir detalle de ${productor.razonSocial}`}
            className="block max-w-full truncate rounded text-left font-medium text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clementina-deep"
            title={productor.razonSocial}
            onClick={() => setProductorId(productor.productorId)}
          >
            {productor.razonSocial}
          </button>
          <div className="truncate text-xs text-ink-soft">
            {productor.vendedorNombre ?? "Sin vendedor asignado"}
          </div>
        </div>
      ),
    },
    {
      key: "segmento",
      header: "Seg.",
      cell: (fila) =>
        fila.segmento ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-bold",
              TONO_SEGMENTO[fila.segmento],
            )}
          >
            {fila.segmento}
          </span>
        ) : (
          <span className="text-xs text-ink-soft">Sin calcular</span>
        ),
    },
    {
      key: "canal",
      header: "Canal",
      cell: ({ productor }) => (
        <CanalBadge canal={productor.canal} bayerDisponible={tablero.bayerDisponible} />
      ),
    },
    {
      key: "has",
      header: "Has",
      align: "right",
      cell: ({ productor }) => (
        <div>
          <div className="tabular">{numero(productor.hectareasTotales)}</div>
          {!productor.planCargado && <div className="text-[10px] text-rojo">sin plan</div>}
        </div>
      ),
    },
    {
      key: "mercado",
      header: "Mercado",
      align: "right",
      cell: ({ productor }) => (
        <div>
          <div className="tabular">{oDash(productor.mercadoConocidoUsd, usd)}</div>
          {productor.planCargado && !productor.mercadoCompleto && (
            <div className="text-[10px] text-clementina-deep">incompleto</div>
          )}
        </div>
      ),
    },
    {
      key: "lc",
      header: "LC",
      align: "right",
      cell: ({ productor }) => <span className="tabular">{usd(productor.facturacionLcUsd)}</span>,
    },
    {
      key: "bayer",
      header: "Bayer",
      align: "right",
      cell: ({ productor }) => (
        <span className="tabular">{oDash(productor.facturacionBayerUsd, usd)}</span>
      ),
    },
    {
      key: "participacion",
      header: "Participación",
      cell: ({ productor }) => <ParticipacionBar valor={productor.participacionPct} />,
    },
    {
      key: "oportunidad",
      header: "Oportunidad",
      align: "right",
      cell: ({ productor }) => (
        <span className="font-medium tabular text-rojo">
          {oDash(productor.oportunidadUsd, usd)}
        </span>
      ),
    },
  ];

  const hayFiltros = Boolean(
    busqueda || filtros.vendedorCodigo || filtros.segmento || filtros.canal,
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <KpiCard
          label="Productores"
          value={resumen.productores}
          hint={`${numero(resumen.hectareasTotales)} has · ${resumen.productoresConPlan} con plan`}
        />
        <KpiCard
          label="Mercado conocido"
          value={usd(resumen.mercadoConocidoUsd)}
          hint={
            resumen.productoresMercadoIncompleto > 0
              ? `${resumen.productoresMercadoIncompleto} planes con costos faltantes`
              : "plan y costos completos para la selección"
          }
        />
        <KpiCard
          label="Vendido operativo"
          value={oDash(resumen.facturacionTotalUsd, usd)}
          hint={
            tablero.bayerDisponible
              ? `LC ${usd(resumen.facturacionLcUsd)} · Bayer ${oDash(resumen.facturacionBayerUsd, usd)}`
              : `LC ${usd(resumen.facturacionLcUsd)} · Bayer sin importación`
          }
        />
        <KpiCard
          label="Participación"
          value={oDash(resumen.participacionComparablePct, pct)}
          tone={
            resumen.participacionComparablePct == null
              ? "default"
              : resumen.participacionComparablePct >= 30
                ? "verde"
                : "rojo"
          }
          hint="venta comparable ÷ mercado comparable"
        />
        <KpiCard
          label="Oportunidad"
          value={oDash(resumen.oportunidadUsd, usd)}
          tone={resumen.oportunidadUsd == null ? "default" : "rojo"}
          hint="mercado conocido menos venta comparable"
        />
      </div>

      <BandaSegmentos
        tablero={tablero}
        segmentoActivo={filtros.segmento}
        onSegmento={(segmento) => onFiltros({ segmento, page: 1 })}
        onConfigurar={onConfigurarSegmentacion}
      />

      <FilterBar>
        <FilterField label="Productor">
          <input
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            placeholder="Buscar por nombre, vendedor o cuenta…"
            className="h-9 w-64 rounded-md border border-line bg-panel px-2 text-sm text-ink outline-none focus:border-clementina-deep"
          />
        </FilterField>
        <FilterField label="Vendedor">
          <Select
            className="h-9 min-w-48"
            value={filtros.vendedorCodigo ?? ""}
            onChange={(e) =>
              onFiltros({
                vendedorCodigo: e.target.value ? Number(e.target.value) : undefined,
                page: 1,
              })
            }
          >
            <option value="">Todos</option>
            {tablero.vendedores.map((vendedor) => (
              <option key={vendedor.codigo} value={vendedor.codigo}>
                {vendedor.nombre} ({vendedor.productores})
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Segmento">
          <Select
            className="h-9"
            value={filtros.segmento ?? ""}
            disabled={!tablero.segmentacionDisponible}
            onChange={(e) =>
              onFiltros({
                segmento: (e.target.value || undefined) as Segmento | undefined,
                page: 1,
              })
            }
          >
            <option value="">Todos</option>
            {SEGMENTOS.map((segmento) => {
              const cantidad =
                tablero.resumenPorSegmento.find((x) => x.segmento === segmento)?.productores ?? 0;
              return (
                <option key={segmento} value={segmento}>
                  {segmento} ({cantidad})
                </option>
              );
            })}
          </Select>
        </FilterField>
        <FilterField label="Canal">
          <Select
            className="h-9 min-w-36"
            value={filtros.canal ?? ""}
            disabled={!tablero.bayerDisponible}
            onChange={(e) =>
              onFiltros({
                canal: (e.target.value || undefined) as CanalVentaPlanificacion | undefined,
                page: 1,
              })
            }
          >
            <option value="">Todos</option>
            {CANALES.map((canal) => {
              const cantidad =
                tablero.resumenPorCanal.find((x) => x.canal === canal)?.productores ?? 0;
              return (
                <option key={canal} value={canal}>
                  {ETIQUETA_CANAL[canal]} ({cantidad})
                </option>
              );
            })}
          </Select>
        </FilterField>
        <div className="flex-1" />
        {hayFiltros && (
          <Button type="button" variant="ghost" size="sm" onClick={onLimpiarFiltros}>
            <X className="size-4" /> Limpiar
          </Button>
        )}
        <FilterField label="Ordenar por">
          <Select
            className="h-9 min-w-48"
            value={filtros.orden ?? "Oportunidad"}
            onChange={(e) =>
              onFiltros({ orden: e.target.value as TableroFiltros["orden"], page: 1 })
            }
          >
            <option value="Oportunidad">Mayor oportunidad</option>
            <option value="Mercado">Mayor mercado</option>
            <option value="Vendido">Mayor venta</option>
            <option value="Participacion">Menor participación</option>
            <option value="Nombre">Nombre</option>
          </Select>
        </FilterField>
      </FilterBar>

      <section aria-busy={actualizando}>
        {actualizando && (
          <div className="mb-2 flex items-center gap-1.5 text-xs text-ink-soft">
            <RefreshCw className="size-3.5 animate-spin" /> Actualizando datos…
          </div>
        )}
        <DataTable
          columns={columnas}
          rows={tablero.items}
          getRowKey={(fila) => fila.productor.productorId}
          empty={
            hayFiltros
              ? "Ningún productor coincide con los filtros."
              : "Todavía no hay productores habilitados en el padrón."
          }
        />
        <Pagination
          page={tablero.page}
          totalPages={tablero.totalPages}
          total={tablero.total}
          onPage={(page) => onFiltros({ page })}
          unidad={{ singular: "productor", plural: "productores" }}
          detalle={`${tablero.items.length} en esta página`}
        />
        <p className="text-xs leading-relaxed text-ink-soft">
          El mercado sale del plan de siembra y los costos vigentes. La oportunidad se informa sólo
          cuando mercado y ventas son comparables. Usá el nombre del productor para ver sus fuentes
          y el desglose del score.
        </p>
      </section>

      {productorId && detalle.isPending && (
        <Modal
          open
          onClose={() => setProductorId(undefined)}
          title="Cargando productor"
          className="w-full max-w-2xl"
        >
          <div className="space-y-3 p-5">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-52 w-full" />
          </div>
        </Modal>
      )}
      {productorId && detalle.isError && (
        <Modal
          open
          onClose={() => setProductorId(undefined)}
          title="No se pudo abrir el productor"
          className="w-full max-w-xl"
        >
          <div className="p-5">
            <ErrorState error={detalle.error} onRetry={() => void detalle.refetch()} />
          </div>
        </Modal>
      )}
      {productorId && detalle.data && (
        <ProductorDetalle detalle={detalle.data} onClose={() => setProductorId(undefined)} />
      )}
    </div>
  );
}

function BandaSegmentos({
  tablero,
  segmentoActivo,
  onSegmento,
  onConfigurar,
}: {
  tablero: TableroPlanificacionDto;
  segmentoActivo: Segmento | undefined;
  onSegmento: (segmento: Segmento | undefined) => void;
  onConfigurar: () => void;
}) {
  if (!tablero.segmentacionDisponible) {
    return (
      <section className="rounded-card border border-clementina-deep/30 bg-clementina/10 p-3.5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Segmentación no disponible</h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              {tablero.motivoSegmentacionNoDisponible ??
                "Falta una fuente requerida por la matriz vigente."}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onConfigurar}>
            <SlidersHorizontal className="size-3.5" /> Configurar matriz
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-line bg-panel p-3.5 shadow-card">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Segmentación de la cartera</h2>
          <p className="text-xs text-ink-soft">
            Cada tarjeta filtra la tabla; sus totales conservan el resto de los filtros activos.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onConfigurar}>
          <SlidersHorizontal className="size-3.5" /> Configurar matriz
        </Button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2">
        {SEGMENTOS.map((segmento) => {
          const resumen = tablero.resumenPorSegmento.find((x) => x.segmento === segmento);
          const activo = segmentoActivo === segmento;
          return (
            <button
              key={segmento}
              type="button"
              onClick={() => onSegmento(activo ? undefined : segmento)}
              aria-pressed={activo}
              className={cn(
                "rounded-md border p-2.5 text-left transition",
                activo
                  ? "border-clementina-deep bg-clementina/10 ring-2 ring-clementina/30"
                  : "border-line bg-panel-soft hover:border-slate-brand/40",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    TONO_SEGMENTO[segmento],
                  )}
                >
                  {segmento}
                </span>
                <span className="font-display text-lg font-semibold tabular text-ink">
                  {resumen?.productores ?? 0}
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded bg-panel"
                title="Participación de bolsillo"
              >
                <div
                  className="h-full rounded bg-clementina"
                  style={{
                    width: `${Math.min(Math.max(resumen?.participacionPct ?? 0, 0), 100)}%`,
                  }}
                />
              </div>
              <div className="mt-1 text-[10px] text-ink-soft">
                capta {oDash(resumen?.participacionPct, pct)} ·{" "}
                <b className="text-rojo">{oDash(resumen?.participacionOportunidadPct, pct)}</b> de
                la oportunidad
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ParticipacionBar({ valor }: { valor: number | null }) {
  if (valor == null) return <span className="text-xs text-ink-soft">—</span>;
  const tono = valor >= 50 ? "bg-verde" : valor >= 20 ? "bg-clementina-deep" : "bg-rojo";
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <div className="h-2 w-20 overflow-hidden rounded bg-panel-soft">
        <div
          className={cn("h-full rounded", tono)}
          style={{ width: `${Math.min(Math.max(valor, 0), 100)}%` }}
        />
      </div>
      <span className="text-xs tabular text-ink-soft">{pct(valor)}</span>
    </div>
  );
}

function CanalBadge({
  canal,
  bayerDisponible,
}: {
  canal: CanalVentaPlanificacion | null;
  bayerDisponible: boolean;
}) {
  if (!bayerDisponible || canal == null) {
    return <span className="whitespace-nowrap text-xs text-ink-soft">Bayer sin importar</span>;
  }
  return (
    <span
      className={cn("whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium", TONO_CANAL[canal])}
    >
      {ETIQUETA_CANAL[canal]}
    </span>
  );
}
