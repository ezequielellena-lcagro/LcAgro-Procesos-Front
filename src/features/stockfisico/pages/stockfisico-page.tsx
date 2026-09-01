import { useState } from "react";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaniaSelect } from "@/shared/components/campania-select";
import { DataTable, type Column } from "@/shared/components/data-table";
import { ErrorState } from "@/shared/components/error-state";
import { ExportButtons } from "@/shared/components/export-buttons";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { KpiCard } from "@/shared/components/kpi-card";
import { PageHeader } from "@/shared/components/page-header";
import { fecha as fmtFecha, numero, oDash } from "@/shared/format/format";
import { FijacionBadge } from "../components/fijacion-badge";
import { FijacionVencidaCard } from "../components/fijacion-vencida-card";
import { PlantaCard } from "../components/planta-card";
import { PorCompradorCard } from "../components/por-comprador-card";
import { porExportador, porRiesgo, type GrupoAFijar } from "../lib/a-fijar";
import {
  cerealesDe,
  filtrarPorCereal,
  filtrarPorVencimiento,
  OPCIONES_VENCIMIENTO,
  type FiltroVencimiento,
} from "../lib/filtros";
import { useStockCereal } from "../queries/use-stock-cereal";
import { useStockCerealExport } from "../queries/use-stock-cereal-export";
import type { AFijarDetalleDto, AlertaDescargaDto, ConsolidadoCerealDto, StockCerealDto } from "../types";

const campLabel = (c: string) => (c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c);

export function StockFisicoPage() {
  // La campaña se resuelve en el backend (filtra las cuatro componentes, incluida la planilla de
  // silobolsa del año); cereal y vencimiento son filtros de lectura sobre el reporte ya traído.
  const [campania, setCampania] = useState("");
  const [cerealSel, setCerealSel] = useState("");
  const [vencimiento, setVencimiento] = useState<FiltroVencimiento>("");

  const query = useStockCereal(campania || undefined);
  const exportar = useStockCerealExport();

  const cereales = query.data ? cerealesDe(query.data) : [];
  // Derivado: si al cambiar de campaña el cereal elegido ya no tiene stock, se vuelve a "Todos"
  // en vez de dejar la pantalla vacía sin explicación.
  const cereal = cereales.includes(cerealSel) ? cerealSel : "";
  const filtrado = query.data ? filtrarPorCereal(query.data, cereal) : undefined;

  const cuerpo = query.isError ? (
    <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  ) : filtrado ? (
    <Reporte data={filtrado} vencimiento={vencimiento} />
  ) : (
    <Cargando />
  );

  return (
    <div>
      <PageHeader
        title="Stock Físico de Cereal"
        subtitle={
          query.data
            ? `Existencia de grano propio por cereal · ${campania ? `campaña ${campania}` : "todas las campañas"} · al ${fmtFecha(query.data.fecha)}`
            : "Existencia de grano propio por cereal"
        }
        actions={
          <ExportButtons
            onExcel={() => exportar.mutate(campania || undefined)}
            excelLoading={exportar.isPending}
            excelDisabled={!query.data}
          />
        }
      />

      <FilterBar>
        <FilterField label="Campaña">
          <CampaniaSelect
            value={campania}
            campanias={query.data?.campanias}
            onChange={setCampania}
            disabled={query.isPending}
            todasLabel="Todas"
          />
        </FilterField>
        <FilterField label="Cereal">
          <Select
            value={cereal}
            onChange={(e) => setCerealSel(e.target.value)}
            disabled={cereales.length === 0}
          >
            <option value="">Todos</option>
            {cereales.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField
          label="Vto. de fijación (planta 10)"
          title="Aplica solo al bloque de planta 10: el grano no deja de estar en la planta porque su fijación venza más adelante."
        >
          <Select
            value={vencimiento}
            onChange={(e) => setVencimiento(e.target.value as FiltroVencimiento)}
          >
            {OPCIONES_VENCIMIENTO.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {(cereal || vencimiento) && (
        <p className="-mt-2 mb-4 text-xs text-ink-soft">
          Cereal y vencimiento filtran lo que se ve en pantalla; el Excel se descarga con la campaña
          completa.
        </p>
      )}

      {cuerpo}
    </div>
  );
}

function Reporte({ data, vencimiento }: { data: StockCerealDto; vencimiento: FiltroVencimiento }) {
  const t = data.totales;
  // El filtro de vencimiento acota SOLO planta 10; el consolidado y los KPIs siguen mostrando la
  // existencia completa. Los totales de esas tablas se rehacen sobre lo visible para no mentir.
  const planta10 = filtrarPorVencimiento(data.detallePlanta10, vencimiento);
  const planta10Tn = planta10.reduce((acc, d) => acc + d.aFijarTn, 0);

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

  const grupoCols: Column<GrupoAFijar>[] = [
    { key: "cereal", header: "Cereal", cell: (g) => g.cereal },
    { key: "exportador", header: "Exportador", cell: (g) => g.exportador },
    {
      key: "via",
      header: "Vía",
      cell: (g) =>
        g.esDirecto ? <span className="text-ink-soft">Directo</span> : g.via,
    },
    { key: "contratos", header: "Contratos", align: "right", cell: (g) => g.contratos },
    { key: "tn", header: "A fijar (tn)", align: "right", cell: (g) => numero(g.tn) },
    { key: "vto", header: "Próx. vto.", align: "right", cell: (g) => oDash(g.proximoVto, fmtFecha) },
    { key: "estado", header: "Estado", cell: (g) => <FijacionBadge estado={g.estado} /> },
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

      {data.campania && data.plantasOtrasCampaniasTn !== 0 && (
        <p className="rounded-card border border-line bg-panel-soft px-4 py-2 text-sm text-ink-soft">
          Quedan <strong>{numero(data.plantasOtrasCampaniasTn)} tn</strong> de plantas 15/20 imputadas a
          otras campañas, fuera de este filtro. MacroGest imputa el saldo de planta a la campaña del
          movimiento, así que arrastra residuos de años anteriores —y pueden ser negativos, cuando el
          grano entró imputado a un año y salió imputado a otro—. Sin filtro de campaña el total los
          incluye: ese es el número que se concilia con Acopio.
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

      {planta10.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <PorCompradorCard filas={planta10} />
          <FijacionVencidaCard filas={planta10} />
        </div>
      )}

      <section>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">
          Planta 10 — a fijar por contrato
        </h2>
        <DataTable
          columns={detalleCols}
          rows={porRiesgo(planta10)}
          getRowKey={(r) => `${r.contrato}-${r.cereal}`}
          footer={["TOTAL PLANTA 10", "", "", "", numero(planta10Tn), "", "", ""]}
          empty="Sin contratos a fijar."
        />
        <p className="mt-2 text-xs text-ink-soft">
          Ordenado por riesgo de fijación: primero lo vencido, después lo que vence antes.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-display text-lg font-semibold text-ink">
          A fijar por exportador y corredor
        </h2>
        <p className="mb-2 text-sm text-ink-soft">
          Con quién hay que gestionar cada fijación: cuando interviene un corredor, la fijación se hace
          con él y no con la exportadora.
        </p>
        <DataTable
          columns={grupoCols}
          rows={porExportador(planta10)}
          getRowKey={(g) => `${g.cereal}-${g.exportador}-${g.via}`}
          footer={["TOTAL", "", "", String(planta10.length), numero(planta10Tn), "", ""]}
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
