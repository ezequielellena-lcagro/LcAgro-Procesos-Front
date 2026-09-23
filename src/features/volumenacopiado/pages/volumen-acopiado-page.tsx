import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { CampaniaSelect } from "@/shared/components/campania-select";
import { DataTable, type Column } from "@/shared/components/data-table";
import { ErrorState } from "@/shared/components/error-state";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { ExportButtons } from "@/shared/components/export-buttons";
import { KpiCard } from "@/shared/components/kpi-card";
import { MiniBarChart } from "@/shared/components/mini-bar-chart";
import { PageHeader } from "@/shared/components/page-header";
import { Sparkline } from "@/shared/components/sparkline";
import { exportToPdf } from "@/shared/export/export-pdf";
import { exportToXlsx } from "@/shared/export/export-xlsx";
import { numero, oDash, pct } from "@/shared/format/format";
import { specFichaVendedor, specObjetivosPorVendedor } from "../lib/export-vendedores";
import { CarteraAccionable } from "../components/cartera-accionable";
import { EstadoClienteBadge } from "../components/estado-cliente-badge";
import { ObjetivoDialog } from "../components/objetivo-dialog";
import { SeguimientoDialog } from "../components/seguimiento-dialog";
import { historiaValores, sparkToneDeEstado } from "../lib/historia";
import { useAnalisisVendedor, useVolumenAcopiado } from "../queries/use-volumen-acopiado";
import type {
  AnalisisVendedorDto,
  ClienteCartera,
  SerieCampania,
  VendedorResumen,
  VolumenAcopiadoDto,
} from "../types";

export function VolumenAcopiadoPage() {
  const { hasAnyRole } = useAuth();
  const [campaniaSel, setCampaniaSel] = useState<string>();
  // El filtro de vendedor ES la navegación: sin vendedor se ve el ranking de todos; con uno elegido,
  // su ficha. No hay solapas porque serían un segundo control para lo mismo que ya hace el filtro.
  const [vendedorSel, setVendedorSel] = useState<string>();

  const resumen = useVolumenAcopiado(campaniaSel);
  const campania = resumen.data?.campania;
  const analisis = useAnalisisVendedor(vendedorSel, campania);

  const puedeAcordar = hasAnyRole(["volumenacopiado"]);

  // Con un vendedor elegido se exporta su ficha; sin filtrar, los objetivos de todos.
  const hayQueExportar = vendedorSel ? analisis.data != null && campania != null : resumen.data != null;

  // Cada rama llama al exportador con su propio tipo de fila: unificarlas antes de llamar dejaría un
  // ExportSpec de dos filas distintas, que no tipa.
  function exportarCon(exportador: typeof exportToPdf) {
    const fallo = () => toast.error("No se pudo generar el archivo.");
    if (vendedorSel) {
      if (analisis.data && campania) void exportador(specFichaVendedor(analisis.data, campania)).catch(fallo);
      return;
    }
    if (resumen.data) void exportador(specObjetivosPorVendedor(resumen.data)).catch(fallo);
  }

  return (
    <div>
      <PageHeader
        title="Volumen Acopiado por Vendedor"
        subtitle={
          campania
            ? `Certificados de depósito 1116 A · campaña ${campania}${vendedorSel ? ` · ${vendedorSel}` : ""}`
            : "Cuánto grano trae la cartera de cada vendedor"
        }
        actions={
          <ExportButtons
            onExcel={() => exportarCon(exportToXlsx)}
            onPdf={() => exportarCon(exportToPdf)}
            excelDisabled={!hayQueExportar}
            pdfDisabled={!hayQueExportar}
          />
        }
      />

      <FilterBar>
        <FilterField label="Campaña">
          <CampaniaSelect
            value={campania}
            campanias={resumen.data?.campanias}
            onChange={setCampaniaSel}
            disabled={resumen.isPending}
          />
        </FilterField>
        <FilterField label="Vendedor">
          {/* "" es "todos": el valor vacío vuelve a `undefined` para que la query de la ficha quede
              apagada (`enabled: !!vendedor`) y no se dispare un pedido sin vendedor. */}
          <Select
            value={vendedorSel ?? ""}
            onChange={(e) => setVendedorSel(e.target.value || undefined)}
            disabled={resumen.isPending}
          >
            <option value="">Todos (ranking)</option>
            {resumen.data?.vendedores
              .filter((v) => !v.excluido)
              .map((v) => (
                <option key={v.vendedor} value={v.vendedor}>
                  {v.vendedor}
                </option>
              ))}
          </Select>
        </FilterField>
      </FilterBar>

      {!vendedorSel ? (
        resumen.isError ? (
          <ErrorState error={resumen.error} onRetry={() => void resumen.refetch()} />
        ) : resumen.data ? (
          <Resumen data={resumen.data} />
        ) : (
          <Cargando kpis={0} />
        )
      ) : analisis.isError ? (
        <ErrorState error={analisis.error} onRetry={() => void analisis.refetch()} />
      ) : analisis.data && campania ? (
        <Vendedor data={analisis.data} campania={campania} puedeAcordar={puedeAcordar} />
      ) : (
        <Cargando />
      )}
    </div>
  );
}

function Resumen({ data }: { data: VolumenAcopiadoDto }) {
  // El total es la suma de la columna, no un número traído aparte: así el pie de la tabla siempre
  // cierra con lo que está arriba (incluidas las sociedades vinculadas y los canales de baja).
  const totalTn = data.vendedores.reduce((acc, v) => acc + v.tn, 0);

  const ranking: Column<VendedorResumen>[] = [
    {
      key: "vendedor",
      header: "Vendedor",
      cell: (r) => (
        <span className={r.excluido ? "text-ink-soft" : undefined}>
          {r.vendedor}
          {r.excluido && <span className="ml-2 text-xs">(vinculada / baja)</span>}
        </span>
      ),
    },
    { key: "tn", header: "Acopiado (tn)", align: "right", cell: (r) => numero(r.tn) },
    { key: "activos", header: "Clientes", align: "right", cell: (r) => (r.excluido ? "—" : r.activos) },
    {
      key: "penetracion",
      header: "Penetración",
      align: "right",
      cell: (r) => (r.excluido ? "—" : pct(r.penetracion * 100)),
    },
    { key: "dormidos", header: "Dormidos", align: "right", cell: (r) => (r.excluido ? "—" : r.dormidos) },
    {
      key: "objetivo",
      header: "Objetivo",
      align: "right",
      cell: (r) =>
        r.excluido ? "—" : oDash(r.objetivoAcordado, numero) === "—"
          ? <span className="text-ink-soft">{numero(r.objetivoSugerido)} <span className="text-xs">(sug.)</span></span>
          : numero(r.objetivoAcordado!),
    },
    {
      key: "cumplimiento",
      header: "Cumplimiento",
      align: "right",
      cell: (r) => <Cumplimiento valor={r.cumplimiento} />,
    },
  ];

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Ranking por vendedor</h2>
        <DataTable
          columns={ranking}
          rows={data.vendedores}
          getRowKey={(r) => r.vendedor}
          empty="Sin acopio en esta campaña."
          footer={["Total acopiado", numero(totalTn), null, null, null, null, null]}
        />
        <p className="mt-2 text-xs text-ink-soft">
          El volumen es el de los certificados <b>1116 A</b> (bruto certificado: no se netean retiros ni
          transferencias). Las sociedades vinculadas y los canales dados de baja suman al total de la
          empresa pero quedan fuera del análisis comercial y no llevan objetivo.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <SerieTabla titulo="Productores y volumen por campaña" filas={data.serie} />
        {data.efectoPlanta.length > 0 && <EfectoPlantaTabla data={data} />}
      </div>
    </div>
  );
}

function SerieTabla({ titulo, filas }: { titulo: string; filas: SerieCampania[] }) {
  const cols: Column<SerieCampania>[] = [
    { key: "campania", header: "Campaña", cell: (r) => r.campania },
    { key: "productores", header: "Productores", align: "right", cell: (r) => r.productores },
    { key: "tn", header: "Toneladas", align: "right", cell: (r) => numero(r.tn) },
  ];
  return (
    <section>
      <h2 className="mb-2 font-display text-lg font-semibold text-ink">{titulo}</h2>
      <DataTable columns={cols} rows={filas} getRowKey={(r) => r.campania} />
    </section>
  );
}

function EfectoPlantaTabla({ data }: { data: VolumenAcopiadoDto }) {
  const cols: Column<VolumenAcopiadoDto["efectoPlanta"][number]>[] = [
    { key: "campania", header: "Campaña", cell: (r) => r.campania },
    { key: "prodTotal", header: "Prod. total", align: "right", cell: (r) => r.prodTotal },
    { key: "prodSin", header: "Sin planta", align: "right", cell: (r) => r.prodSinPlanta },
    { key: "tnTotal", header: "tn total", align: "right", cell: (r) => numero(r.tnTotal) },
    { key: "tnSin", header: "tn sin planta", align: "right", cell: (r) => numero(r.tnSinPlanta) },
  ];
  return (
    <section>
      <h2 className="mb-2 font-display text-lg font-semibold text-ink">Efecto de la planta alquilada</h2>
      <DataTable columns={cols} rows={data.efectoPlanta} getRowKey={(r) => r.campania} />
      <p className="mt-2 text-xs text-ink-soft">
        Medido por <b>balanza</b>, la única fuente con planta física. <b>No reconcilia con el 1116 A</b>
        {" "}porque no cubre el "Directo a puerto": sirve para comparar la base propia contra años previos,
        no como volumen acopiado.
      </p>
    </section>
  );
}

function Vendedor({
  data,
  campania,
  puedeAcordar,
}: {
  data: AnalisisVendedorDto;
  campania: string;
  puedeAcordar: boolean;
}) {
  const [objetivoOpen, setObjetivoOpen] = useState(false);
  const [seguimientoOpen, setSeguimientoOpen] = useState(false);
  const r = data.resumen;

  const dormidos = data.clientes.filter((c) => c.estado === "Dormido");
  const declinantes = data.clientes.filter((c) => c.estado === "Declinante");
  const maxTn = Math.max(1, ...data.clientes.map((c) => c.tn));
  const objetivoTn = r.objetivoAcordado ?? r.objetivoSugerido;

  const evolucionRows = data.evolucion.map((s) => ({
    label: s.campania,
    value: s.tn,
    sub: `${s.productores} prod.`,
    highlight: s.campania === campania,
  }));

  const clientes: Column<ClienteCartera>[] = [
    {
      key: "cliente",
      header: "Cliente",
      cell: (c) => (
        <span className="block max-w-[16rem] truncate" title={c.cliente}>
          {c.cliente}
        </span>
      ),
    },
    {
      key: "tn",
      header: `${campania} (tn)`,
      align: "right",
      cell: (c) => (
        <div className="flex items-center justify-end gap-2">
          <div className="hidden h-2 w-20 overflow-hidden rounded bg-panel-soft sm:block">
            <div
              className="h-full rounded bg-clementina"
              style={{ width: `${Math.max(c.tn > 0 ? 3 : 0, (c.tn / maxTn) * 100)}%` }}
            />
          </div>
          <span className="tabular">{numero(c.tn)}</span>
        </div>
      ),
    },
    {
      key: "tendencia",
      header: "Tendencia",
      cell: (c) => <Sparkline values={historiaValores(c.historia)} tone={sparkToneDeEstado(c.estado)} />,
    },
    {
      key: "pico",
      header: "Mejor año",
      align: "right",
      cell: (c) => (
        <span className="tabular">
          {numero(c.tnPico)} <span className="text-xs text-ink-soft">{c.campaniaPico}</span>
        </span>
      ),
    },
    { key: "estado", header: "Estado", cell: (c) => <EstadoClienteBadge estado={c.estado} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <KpiCard label="Acopiado" value={`${numero(r.tn)} tn`} hint={`${r.activos} clientes activos`} />
        <KpiCard
          label="Penetración"
          value={pct(r.penetracion * 100)}
          hint={`${r.activos} de ${r.universo} de su cartera`}
        />
        <KpiCard label="tn por cliente" value={numero(r.tnPorActivo)} hint="promedio del activo" />
        <KpiCard label="Dormidos" tone="rojo" value={String(r.dormidos)} hint="con historia, hoy en cero" />
        <KpiCard
          label="Objetivo"
          tone={r.cumplimiento != null && r.cumplimiento >= 100 ? "verde" : "default"}
          value={`${numero(objetivoTn)} tn`}
          hint={
            r.objetivoAcordado == null
              ? "sugerido, sin acordar"
              : r.cumplimiento != null
                ? `acordado · ${pct(r.cumplimiento)} cumplido`
                : "acordado"
          }
        />
      </div>

      <div className="rounded-card border border-line bg-panel p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Objetivo</h2>
            <p className="mt-1 text-sm text-ink-soft">{data.explicacionObjetivo}</p>
            {data.notaObjetivo && (
              <p className="mt-1 text-sm text-ink-soft">
                <b>Nota:</b> {data.notaObjetivo}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-semibold tabular text-ink">
              {r.objetivoAcordado == null
                ? `${numero(r.objetivoSugerido)} tn`
                : `${numero(r.objetivoAcordado)} tn`}
            </div>
            <div className="text-xs text-ink-soft">
              {r.objetivoAcordado == null ? "sugerido (sin acordar)" : "acordado"}
            </div>
            {puedeAcordar && !r.excluido && (
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setObjetivoOpen(true)}>
                  {r.objetivoAcordado == null ? "Acordar objetivo" : "Editar objetivo"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setSeguimientoOpen(true)}>
                  Enviar seguimiento
                </Button>
              </div>
            )}
          </div>
        </div>
        <p className="mt-3 border-t border-line pt-3 text-sm">
          <b>Palanca:</b> {data.palanca}
        </p>
      </div>

      <section className="rounded-card border border-line bg-panel p-4 shadow-card">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Evolución del vendedor</h2>
        <MiniBarChart rows={evolucionRows} unit="tn" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <CarteraAccionable variante="reactivar" clientes={dormidos} />
        <CarteraAccionable variante="defender" clientes={declinantes} />
      </div>

      <section>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Cartera completa</h2>
        <DataTable
          columns={clientes}
          rows={data.clientes}
          getRowKey={(c) => c.numero}
          empty="Sin clientes en la ventana analizada."
        />
        <p className="mt-2 text-xs text-ink-soft">
          Ordenada por volumen de la campaña. La <b>tendencia</b> muestra la trayectoria del cliente; el{" "}
          <b>mejor año</b> es el techo al que se puede volver. Se listan los clientes por encima del piso de
          toneladas.
        </p>
      </section>

      {seguimientoOpen && (
        <SeguimientoDialog
          open={seguimientoOpen}
          onClose={() => setSeguimientoOpen(false)}
          vendedor={data.vendedor}
          campania={campania}
        />
      )}

      {objetivoOpen && (
        <ObjetivoDialog
          open={objetivoOpen}
          onClose={() => setObjetivoOpen(false)}
          campania={campania}
          vendedor={r}
          explicacion={data.explicacionObjetivo}
          notaActual={data.notaObjetivo}
        />
      )}
    </div>
  );
}

/** Verde si llegó, rojo si está lejos: el objetivo es multi-año, no una nota. */
function Cumplimiento({ valor }: { valor: number | null }) {
  if (valor == null) return <span className="text-ink-soft">—</span>;
  const cls = valor >= 100 ? "text-verde" : valor >= 80 ? "text-clementina-deep" : "text-rojo";
  return <span className={cls}>{pct(valor)}</span>;
}

function Cargando({ kpis = 3 }: { kpis?: number }) {
  return (
    <div className="space-y-4">
      {kpis > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          {Array.from({ length: kpis }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-card" />
          ))}
        </div>
      )}
      <Skeleton className="h-64 w-full rounded-card" />
    </div>
  );
}
