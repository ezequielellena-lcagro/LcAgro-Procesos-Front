import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-context";
import { CampaniaSelect } from "@/shared/components/campania-select";
import { DataTable, type Column } from "@/shared/components/data-table";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { KpiCard } from "@/shared/components/kpi-card";
import { PageHeader } from "@/shared/components/page-header";
import { numero, oDash, pct } from "@/shared/format/format";
import { EstadoClienteBadge } from "../components/estado-cliente-badge";
import { ObjetivoDialog } from "../components/objetivo-dialog";
import { SeguimientoDialog } from "../components/seguimiento-dialog";
import { useAnalisisVendedor, useVolumenAcopiado } from "../queries/use-volumen-acopiado";
import type {
  AnalisisVendedorDto,
  ClienteCartera,
  SerieCampania,
  VendedorResumen,
  VolumenAcopiadoDto,
} from "../types";

type Tab = "resumen" | "vendedor";

export function VolumenAcopiadoPage() {
  const { hasAnyRole } = useAuth();
  const [campaniaSel, setCampaniaSel] = useState<string>();
  const [tab, setTab] = useState<Tab>("resumen");
  const [vendedorSel, setVendedorSel] = useState<string>();

  const resumen = useVolumenAcopiado(campaniaSel);
  const campania = resumen.data?.campania;
  const analisis = useAnalisisVendedor(tab === "vendedor" ? vendedorSel : undefined, campania);

  const puedeAcordar = hasAnyRole(["volumenacopiado"]);

  return (
    <div>
      <PageHeader
        title="Volumen Acopiado por Vendedor"
        subtitle={
          campania
            ? `Certificados de depósito 1116 A · campaña ${campania}`
            : "Cuánto grano trae la cartera de cada vendedor"
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
        {tab === "vendedor" && (
          <FilterField label="Vendedor">
            <Select value={vendedorSel ?? ""} onChange={(e) => setVendedorSel(e.target.value)}>
              <option value="">Elegí un vendedor…</option>
              {resumen.data?.vendedores
                .filter((v) => !v.excluido)
                .map((v) => (
                  <option key={v.vendedor} value={v.vendedor}>
                    {v.vendedor}
                  </option>
                ))}
            </Select>
          </FilterField>
        )}
      </FilterBar>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="vendedor">Por vendedor</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          {resumen.isError ? (
            <ErrorState error={resumen.error} onRetry={() => void resumen.refetch()} />
          ) : resumen.data ? (
            <Resumen data={resumen.data} />
          ) : (
            <Cargando />
          )}
        </TabsContent>

        <TabsContent value="vendedor">
          {!vendedorSel ? (
            <EmptyState mensaje="Elegí un vendedor para ver el análisis de su cartera." />
          ) : analisis.isError ? (
            <ErrorState error={analisis.error} onRetry={() => void analisis.refetch()} />
          ) : analisis.data && campania ? (
            <Vendedor data={analisis.data} campania={campania} puedeAcordar={puedeAcordar} />
          ) : (
            <Cargando />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Resumen({ data }: { data: VolumenAcopiadoDto }) {
  const t = data.totales;

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
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <KpiCard label="Total acopiado" value={`${numero(t.tn)} tn`} hint={`${t.productores} productores`} />
        <KpiCard
          label="Vendedor líder"
          value={t.vendedorLider}
          hint={`${numero(t.tnLider)} tn · ${pct(t.shareLider)} del total`}
        />
        <KpiCard
          label="Cartera dormida"
          tone="rojo"
          value={`${numero(t.tnDormidas)} tn`}
          hint="mejor año de los clientes que hoy no entregan"
        />
      </div>

      <section>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Ranking por vendedor</h2>
        <DataTable
          columns={ranking}
          rows={data.vendedores}
          getRowKey={(r) => r.vendedor}
          empty="Sin acopio en esta campaña."
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

  const clientes: Column<ClienteCartera>[] = [
    { key: "cliente", header: "Cliente", cell: (c) => c.cliente },
    { key: "tn", header: `${campania} (tn)`, align: "right", cell: (c) => numero(c.tn) },
    { key: "pico", header: "Mejor año", align: "right", cell: (c) => numero(c.tnPico) },
    { key: "campaniaPico", header: "En", cell: (c) => c.campaniaPico },
    { key: "estado", header: "Estado", cell: (c) => <EstadoClienteBadge estado={c.estado} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        <KpiCard label="Acopiado" value={`${numero(r.tn)} tn`} hint={`${r.activos} clientes activos`} />
        <KpiCard
          label="Penetración"
          value={pct(r.penetracion * 100)}
          hint={`${r.activos} de ${r.universo} de su cartera`}
        />
        <KpiCard label="tn por cliente" value={numero(r.tnPorActivo)} />
        <KpiCard label="Dormidos" tone="rojo" value={String(r.dormidos)} hint="con historia, hoy en cero" />
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

      <SerieTabla titulo="Evolución del vendedor" filas={data.evolucion} />

      <section>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Cartera de clientes</h2>
        <DataTable
          columns={clientes}
          rows={data.clientes}
          getRowKey={(c) => c.numero}
          empty="Sin clientes en la ventana analizada."
        />
        <p className="mt-2 text-xs text-ink-soft">
          Los <b>dormidos</b> son clientes con historia que este año no entregaron: reactivarlos pesa más
          que exigirle más a los activos. Se listan los clientes por encima del piso de toneladas.
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

function Cargando() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-card" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-card" />
    </div>
  );
}
