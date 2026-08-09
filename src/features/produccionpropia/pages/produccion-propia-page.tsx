import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { CampaniaSelect } from "@/shared/components/campania-select";
import { resolverCampania } from "@/shared/format/campania";
import { DataTable, type Column } from "@/shared/components/data-table";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { ExportButtons } from "@/shared/components/export-buttons";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { KpiCard } from "@/shared/components/kpi-card";
import { PageHeader } from "@/shared/components/page-header";
import { fecha as fmtFecha, numero } from "@/shared/format/format";
import { SaldoCard } from "../components/saldo-card";
import { SaldoCuentaDialog } from "../components/saldo-cuenta-dialog";
import {
  useCampaniasProduccionPropia,
  useProduccionPropia,
  useProduccionPropiaExport,
} from "../queries/use-produccion-propia";
import type { FilaProduccionPropia, ProduccionPropiaDto } from "../types";

/** Umbral por debajo del cual la diferencia de control se considera ruido y se atenúa. */
const DIF_RELEVANTE_TN = 50;

export function ProduccionPropiaPage() {
  const { hasAnyRole } = useAuth();
  const campanias = useCampaniasProduccionPropia();
  const [campaniaSel, setCampaniaSel] = useState<string>();
  const campania = resolverCampania(campaniaSel, campanias.data);

  const query = useProduccionPropia(campania);
  const exportar = useProduccionPropiaExport();
  const [saldoOpen, setSaldoOpen] = useState(false);

  const puedeCargar = hasAnyRole(["produccionpropia"]);

  return (
    <div>
      <PageHeader
        title="Posición de Producción Propia"
        subtitle={
          query.data
            ? `Grano propio de La Clementina · campaña ${query.data.campania} · al ${fmtFecha(query.data.fecha)}`
            : "Grano propio de La Clementina — cuánto se cosechó y todavía no se vendió"
        }
        actions={
          <>
            {puedeCargar && campania && (
              <Button type="button" variant="outline" size="sm" onClick={() => setSaldoOpen(true)}>
                Cargar saldo cta. cte.
              </Button>
            )}
            <ExportButtons
              onExcel={() => exportar.mutate(campania)}
              excelLoading={exportar.isPending}
              excelDisabled={!query.data}
            />
          </>
        }
      />

      <FilterBar>
        <FilterField label="Campaña">
          <CampaniaSelect
            value={campania}
            campanias={campanias.data}
            onChange={setCampaniaSel}
            disabled={campanias.isPending}
          />
        </FilterField>
      </FilterBar>

      <div className="mt-5">
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data ? (
          <Reporte data={query.data} />
        ) : (
          <Cargando />
        )}
      </div>

      {campania && query.data && (
        <SaldoCuentaDialog
          open={saldoOpen}
          onClose={() => setSaldoOpen(false)}
          campania={campania}
          cereales={query.data.filas.map((f) => f.cereal)}
        />
      )}
    </div>
  );
}

function Reporte({ data }: { data: ProduccionPropiaDto }) {
  const t = data.totales;

  if (data.filas.length === 0)
    return <EmptyState mensaje="No hay datos de producción propia para esta campaña." />;

  // Plano ②: cómo surge el saldo (producción − ventas).
  const comoSurge: Column<FilaProduccionPropia>[] = [
    { key: "cereal", header: "Cereal", cell: (r) => r.cereal },
    { key: "cosechado", header: "Cosechado", align: "right", cell: (r) => numero(r.cosechado) },
    { key: "vendido", header: "Vendido (fijado)", align: "right", cell: (r) => numero(r.vendido) },
    {
      key: "precio",
      header: "Precio USD/tn",
      align: "right",
      cell: (r) => (r.precioUsd == null ? "—" : `US$ ${numero(r.precioUsd)}`),
    },
    {
      key: "saldo",
      header: "Saldo a vender",
      align: "right",
      cell: (r) => <span className={r.saldo < 0 ? "text-rojo" : "text-verde"}>{numero(r.saldo)}</span>,
    },
  ];

  // Plano ③: dónde está físicamente ese saldo.
  const dondeEsta: Column<FilaProduccionPropia>[] = [
    { key: "cereal", header: "Cereal", cell: (r) => r.cereal },
    {
      key: "ctacte",
      header: "Cta. cte. 32",
      align: "right",
      cell: (r) =>
        r.ctaCte == null ? <span className="italic text-ink-soft">s/d</span> : numero(r.ctaCte),
    },
    { key: "embolsado", header: "Embolsado", align: "right", cell: (r) => numero(r.embolsado) },
    { key: "planta10", header: "Planta 10 a fijar", align: "right", cell: (r) => numero(r.planta10) },
    {
      key: "fisico",
      header: "Total físico",
      align: "right",
      cell: (r) => <b>{numero(r.totalFisico)}</b>,
    },
    {
      key: "comercial",
      header: "Saldo comercial",
      align: "right",
      cell: (r) => <span className="text-ink-soft">{numero(r.saldo)}</span>,
    },
    {
      key: "dif",
      header: "Dif. control",
      align: "right",
      cell: (r) => <DifControl tn={r.difControl} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <KpiCard label="Cosechado" value={`${numero(t.cosechado)} tn`} />
        <KpiCard label="Vendido (fijado)" value={`${numero(t.vendido)} tn`} />
        <KpiCard
          label="Saldo a vender"
          tone={t.saldo >= 0 ? "verde" : "rojo"}
          value={`${numero(t.saldo)} tn`}
        />
        <KpiCard label="Total físico" value={`${numero(t.totalFisico)} tn`} hint="cta. cte. + bolsa + planta 10" />
      </div>

      {(data.cosechaPendiente || data.silobolsaPendiente) && (
        <p className="rounded-card border border-line bg-panel-soft px-4 py-2 text-sm text-ink-soft">
          Las planillas de cosecha de la red no estaban disponibles al generar el reporte
          {data.cosechaPendiente && " · el cosechado figura en 0"}
          {data.silobolsaPendiente && " · el embolsado figura en 0"}.
        </p>
      )}

      <section>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">
          Stock sin vender por cereal <span className="text-sm font-normal text-ink-soft">= cosechado − vendido</span>
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          {data.filas.map((f) => (
            <SaldoCard key={f.cereal} fila={f} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">
          Cómo surge <span className="text-sm font-normal text-ink-soft">producción − ventas (precio ponderado por tn)</span>
        </h2>
        <DataTable
          columns={comoSurge}
          rows={data.filas}
          getRowKey={(r) => r.cereal}
          footer={["TOTAL", numero(t.cosechado), numero(t.vendido), "—", numero(t.saldo)]}
        />
        <p className="mt-2 text-xs text-ink-soft">
          <b>Vendido</b> = toneladas con precio cerrado (fijadas). Lo pactado sin precio queda dentro del
          saldo a vender. Alcance: producción propia (tipo de negocio 7), no la posición comercial del acopio.
        </p>
      </section>

      <section>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">
          Dónde está el stock <span className="text-sm font-normal text-ink-soft">ubicación física del grano</span>
        </h2>
        <DataTable
          columns={dondeEsta}
          rows={data.filas}
          getRowKey={(r) => r.cereal}
          footer={[
            "TOTAL",
            numero(t.ctaCte),
            numero(t.embolsado),
            numero(t.planta10),
            numero(t.totalFisico),
            numero(t.saldo),
            numero(t.difControl),
          ]}
        />
        <p className="mt-2 text-xs text-ink-soft">
          <b>Cta. cte. 32</b>: saldo en kilos del productor La Clementina (reporte oficial, acumulado; se
          carga a mano). <b>Embolsado</b>: silobolsa en campo, neto. <b>Planta 10 a fijar</b>: grano propio
          entregado al exportador sin precio cerrado. La <b>diferencia de control</b> es esperable —la
          cuenta corriente es acumulada y hay ventas a precio todavía sin entregar—: no es un error, es el
          chequeo de que no falte mercadería.
        </p>
      </section>
    </div>
  );
}

/** La diferencia chica es ruido esperable: se atenúa para que no compita con las cifras del cuadro. */
function DifControl({ tn }: { tn: number }) {
  if (Math.abs(tn) < DIF_RELEVANTE_TN) return <span className="text-ink-soft">{numero(tn)}</span>;
  return (
    <span className={tn < 0 ? "text-rojo" : "text-verde"}>
      {tn > 0 ? "+" : ""}
      {numero(tn)}
    </span>
  );
}

function Cargando() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-card" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-card" />
    </div>
  );
}
