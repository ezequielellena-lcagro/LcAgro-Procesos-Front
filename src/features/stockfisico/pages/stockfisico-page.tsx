import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/shared/components/data-table";
import { ErrorState } from "@/shared/components/error-state";
import { ExportButtons } from "@/shared/components/export-buttons";
import { KpiCard } from "@/shared/components/kpi-card";
import { PageHeader } from "@/shared/components/page-header";
import { fecha as fmtFecha, numero, oDash } from "@/shared/format/format";
import { FijacionBadge } from "../components/fijacion-badge";
import { PlantaCard } from "../components/planta-card";
import { useStockCereal } from "../queries/use-stock-cereal";
import { useStockCerealExport } from "../queries/use-stock-cereal-export";
import type { AFijarDetalleDto, AlertaDescargaDto, ConsolidadoCerealDto, StockCerealDto } from "../types";

const campLabel = (c: string) => (c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c);

export function StockFisicoPage() {
  const query = useStockCereal();
  const exportar = useStockCerealExport();

  const cuerpo = query.isError ? (
    <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  ) : query.data ? (
    <Reporte data={query.data} />
  ) : (
    <Cargando />
  );

  return (
    <div>
      <PageHeader
        title="Stock Físico de Cereal"
        subtitle={
          query.data
            ? `Existencia de grano propio por cereal · al ${fmtFecha(query.data.fecha)}`
            : "Existencia de grano propio por cereal"
        }
        actions={
          <ExportButtons
            onExcel={() => exportar.mutate()}
            excelLoading={exportar.isPending}
            excelDisabled={!query.data}
          />
        }
      />
      {cuerpo}
    </div>
  );
}

function Reporte({ data }: { data: StockCerealDto }) {
  const t = data.totales;

  const consolidadoCols: Column<ConsolidadoCerealDto>[] = [
    { key: "cereal", header: "Cereal", cell: (r) => r.cereal },
    { key: "p15", header: "P15 Acopio", align: "right", cell: (r) => numero(r.p15) },
    { key: "p20", header: "P20 Semillero", align: "right", cell: (r) => numero(r.p20) },
    { key: "p10", header: "P10 A fijar", align: "right", cell: (r) => numero(r.p10) },
    { key: "bolsa", header: "Silobolsa", align: "right", cell: (r) => numero(r.silobolsa) },
    { key: "total", header: "Total", align: "right", cell: (r) => numero(r.total) },
  ];

  const detalleCols: Column<AFijarDetalleDto>[] = [
    { key: "comprador", header: "Comprador", cell: (r) => r.comprador },
    { key: "cereal", header: "Cereal", cell: (r) => r.cereal },
    { key: "contrato", header: "Contrato", cell: (r) => r.contrato },
    { key: "campania", header: "Campaña", cell: (r) => campLabel(r.campania) },
    { key: "afijar", header: "A fijar (tn)", align: "right", cell: (r) => numero(r.aFijarTn) },
    { key: "via", header: "Vía", cell: (r) => (r.directo ? "Directo" : "Corredor") },
    { key: "vto", header: "Vto. fijación", align: "right", cell: (r) => oDash(r.vtoFijacion, fmtFecha) },
    { key: "estado", header: "Estado", cell: (r) => <FijacionBadge estado={r.estado} /> },
  ];

  const alertaCols: Column<AlertaDescargaDto>[] = [
    { key: "contrato", header: "Contrato", cell: (r) => r.contrato },
    { key: "comprador", header: "Comprador", cell: (r) => r.comprador },
    { key: "cereal", header: "Cereal", cell: (r) => r.cereal },
    { key: "campania", header: "Campaña", cell: (r) => campLabel(r.campania) },
    { key: "fijado", header: "Fijado (tn)", align: "right", cell: (r) => numero(r.fijadoTn) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <KpiCard label="Total físico" value={`${numero(t.total)} tn`} />
        <KpiCard label="Planta 10 a fijar" value={`${numero(t.p10)} tn`} />
        <KpiCard
          label="Fijación vencida"
          tone="rojo"
          value={`${numero(t.vencidoTn)} tn`}
          hint={`${t.vencidoContratos} contratos`}
        />
        <KpiCard
          label="Vence ≤30 días"
          value={`${numero(t.proximo30Tn)} tn`}
          hint={`${t.proximo30Contratos} contratos`}
        />
      </div>

      {data.silobolsaPendiente && (
        <p className="rounded-card border border-line bg-panel-soft px-4 py-2 text-sm text-ink-soft">
          La silobolsa (grano embolsado en campo) se carga por otra vía; hoy figura en 0.
        </p>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <PlantaCard
          titulo="Planta 15"
          subtitulo="Acopio San Jorge"
          filas={data.consolidado.map((c) => ({ cereal: c.cereal, tn: c.p15 }))}
          totalTn={t.p15}
        />
        <PlantaCard
          titulo="Planta 20"
          subtitulo="Semillero"
          filas={data.consolidado.map((c) => ({ cereal: c.cereal, tn: c.p20 }))}
          totalTn={t.p20}
        />
        <PlantaCard
          titulo="Planta 10"
          subtitulo="Entregado a fijar"
          filas={data.consolidado.map((c) => ({ cereal: c.cereal, tn: c.p10 }))}
          totalTn={t.p10}
        />
        <PlantaCard
          titulo="Silobolsa"
          subtitulo="Embolsado en campo"
          filas={data.consolidado.map((c) => ({ cereal: c.cereal, tn: c.silobolsa }))}
          totalTn={t.silobolsa}
        />
      </div>

      <section>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">
          Consolidado por cereal y planta — tn
        </h2>
        <DataTable
          columns={consolidadoCols}
          rows={data.consolidado}
          getRowKey={(r) => r.cereal}
          footer={[
            "TOTAL",
            numero(t.p15),
            numero(t.p20),
            numero(t.p10),
            numero(t.silobolsa),
            numero(t.total),
          ]}
          empty="Sin existencias."
        />
      </section>

      <section>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">
          Planta 10 — a fijar por contrato
        </h2>
        <DataTable
          columns={detalleCols}
          rows={data.detallePlanta10}
          getRowKey={(r) => `${r.contrato}-${r.cereal}`}
          footer={["TOTAL PLANTA 10", "", "", "", numero(t.p10), "", "", ""]}
          empty="Sin contratos a fijar."
        />
      </section>

      {data.alertasDescarga.length > 0 && (
        <section>
          <h2 className="mb-1 font-display text-lg font-semibold text-ink">
            A revisar — descarga sin pasar
          </h2>
          <p className="mb-2 text-sm text-ink-soft">
            Contratos con fijado pero sin descarga cargada (intercompany/retiro): falta pasar la carta
            de porte en MacroGest. Es un error de carga, no del cálculo.
          </p>
          <DataTable columns={alertaCols} rows={data.alertasDescarga} getRowKey={(r) => r.contrato} />
        </section>
      )}
    </div>
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
