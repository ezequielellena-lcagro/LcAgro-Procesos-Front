import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/shared/components/error-state";
import { PageHeader } from "@/shared/components/page-header";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { CarteraTab } from "../components/cartera-tab";
import { ComparacionFuentes } from "../components/comparacion-fuentes";
import { ObjetivosTab } from "../components/objetivos-tab";
import { SegmentacionModal } from "../components/segmentacion-modal";
import { claveCampania, fechaHoraPlanificacion, ultimasCampanias } from "../lib/campanias";
import {
  claveCortePlanificacion,
  CORTE_VIVO_PLANIFICACION,
} from "../queries/keys";
import { useSnapshotsPlanificacion } from "../queries/use-snapshots-planificacion";
import { useTableroPlanificacion } from "../queries/use-tablero-planificacion";
import type {
  CorteConsultaPlanificacion,
  SnapshotPlanificacionDto,
  TableroFiltros,
} from "../types";

type Tab = "cartera" | "objetivos";

function filtrosIniciales(campania: string): TableroFiltros {
  return { campania, orden: "Oportunidad", page: 1, pageSize: 50 };
}

/** Tablero productivo de planificación. Toda la lógica comercial llega resuelta por la API. */
export function PlanificacionPage() {
  const instanteInicial = useMemo(() => new Date(), []);
  const inicial = claveCampania(instanteInicial);
  const campaniasIniciales = useMemo(
    () => ultimasCampanias(instanteInicial, 3),
    [instanteInicial],
  );
  const [tab, setTab] = useState<Tab>("cartera");
  const [filtros, setFiltros] = useState<TableroFiltros>(() => filtrosIniciales(inicial));
  const [snapshotId, setSnapshotId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [configurando, setConfigurando] = useState(false);
  const busquedaDiferida = useDebounce(busqueda.trim(), 350);

  const filtrosConsulta = useMemo<TableroFiltros>(
    () => ({ ...filtros, q: busquedaDiferida || undefined }),
    [busquedaDiferida, filtros],
  );
  const snapshots = useSnapshotsPlanificacion(filtros.campania);
  const snapshotActivo = snapshots.data?.find((snapshot) => snapshot.id === snapshotId);
  const corte = useMemo<CorteConsultaPlanificacion>(() => {
    if (snapshotId == null) return CORTE_VIVO_PLANIFICACION;
    if (!snapshotActivo) return { modo: "snapshot-pendiente", snapshotId };
    return { modo: "snapshot", snapshot: snapshotActivo };
  }, [snapshotActivo, snapshotId]);
  const tablero = useTableroPlanificacion(filtrosConsulta, corte);
  const data = tablero.data;
  const soloLectura = corte.modo !== "vivo";

  function cambiarCampania(campania: string) {
    setFiltros(filtrosIniciales(campania));
    setSnapshotId(null);
    setBusqueda("");
    setConfigurando(false);
  }

  function cambiarCorte(valor: string) {
    const candidato = Number(valor);
    const siguiente = valor === "vivo" || !Number.isSafeInteger(candidato) || candidato <= 0
      ? null
      : candidato;
    setSnapshotId(siguiente);
    setFiltros((actuales) => ({
      ...actuales,
      segmento: undefined,
      canal: undefined,
      page: 1,
    }));
    setConfigurando(false);
  }

  function cambiarBusqueda(valor: string) {
    setBusqueda(valor);
    setFiltros((actuales) => (actuales.page === 1 ? actuales : { ...actuales, page: 1 }));
  }

  function cambiarFiltros(cambios: Partial<TableroFiltros>) {
    setFiltros((actuales) => ({ ...actuales, ...cambios }));
  }

  function limpiarFiltros() {
    setFiltros(filtrosIniciales(filtros.campania));
    setBusqueda("");
  }

  // El selector es estable: cambiar a una campaña anterior no debe hacer desaparecer la vigente.
  const campanias = campaniasIniciales;

  return (
    <div>
      <PageHeader
        title="Planificación de Ventas"
        subtitle={
          data
            ? `Mercado, venta y oportunidad por productor · campaña ${data.campania}`
            : "Mercado, venta y oportunidad por productor"
        }
        actions={
          <div className="flex flex-wrap items-end justify-end gap-3">
            {data && (
              <span className="pb-2 text-xs text-ink-soft">
                {soloLectura ? "Datos de la foto" : "Corte vivo generado"}{" "}
                {fechaHoraPlanificacion(data.generadoEn)}
              </span>
            )}
            <label className="text-xs font-medium text-ink-soft">
              Corte
              <Select
                className="mt-1 h-9 min-w-64 text-ink"
                value={snapshotId == null ? "vivo" : String(snapshotId)}
                onChange={(event) => cambiarCorte(event.target.value)}
                aria-describedby={snapshots.isError ? "snapshots-error" : undefined}
              >
                <option value="vivo">Ahora · datos vivos</option>
                {snapshotId != null && !snapshotActivo && (
                  <option value={snapshotId}>Foto seleccionada · metadatos no disponibles</option>
                )}
                {snapshots.data?.map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id}>
                    {etiquetaSnapshot(snapshot)}
                  </option>
                ))}
                {snapshots.isPending && <option disabled>Cargando fotos…</option>}
              </Select>
            </label>
            <label className="text-xs font-medium text-ink-soft">
              Campaña
              <Select
                className="mt-1 h-9 min-w-36 text-ink"
                value={filtros.campania}
                onChange={(event) => cambiarCampania(event.target.value)}
                disabled={tablero.isPending && corte.modo !== "snapshot-pendiente"}
              >
                {campanias.map((campania) => (
                  <option key={campania} value={campania}>
                    {campania}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        }
      />

      {snapshots.isError && (
        <p
          id="snapshots-error"
          role="alert"
          className="mb-4 rounded-md border border-clementina-deep/30 bg-clementina/10 px-3 py-2 text-xs text-ink"
        >
          No se pudieron cargar las fotos guardadas. El tablero vivo sigue disponible.
        </p>
      )}

      {snapshotActivo && (
        <SnapshotBanner
          snapshot={snapshotActivo}
          onVolverAlVivo={() => cambiarCorte("vivo")}
        />
      )}

      {corte.modo === "snapshot-pendiente" ? (
        <SnapshotSinMetadatos
          reintentando={snapshots.isFetching}
          onReintentar={() => void snapshots.refetch()}
          onVolverAlVivo={() => cambiarCorte("vivo")}
        />
      ) : tablero.isError && !data ? (
        <ErrorState error={tablero.error} onRetry={() => void tablero.refetch()} />
      ) : !data ? (
        <CargandoTablero />
      ) : (
        <>
          {tablero.isError && (
            <div className="mb-4">
              <ErrorState error={tablero.error} onRetry={() => void tablero.refetch()} />
            </div>
          )}
          <div className="mb-5">
            <ComparacionFuentes tablero={data} soloLectura={soloLectura} />
          </div>

          <Tabs value={tab} onValueChange={(valor) => setTab(valor as Tab)}>
            <TabsList>
              <TabsTrigger value="cartera">Cartera de productores</TabsTrigger>
              <TabsTrigger value="objetivos">Objetivos y avance</TabsTrigger>
            </TabsList>

            <TabsContent value="cartera">
              <CarteraTab
                key={`${data.campania}-${claveCortePlanificacion(corte)}`}
                tablero={data}
                filtros={filtrosConsulta}
                busqueda={busqueda}
                actualizando={tablero.isFetching}
                corte={corte}
                soloLectura={soloLectura}
                onBusqueda={cambiarBusqueda}
                onFiltros={cambiarFiltros}
                onLimpiarFiltros={limpiarFiltros}
                onConfigurarSegmentacion={() => setConfigurando(true)}
              />
            </TabsContent>

            <TabsContent value="objetivos">
              <ObjetivosTab
                key={`${data.campania}-${data.objetivos.revision}-${claveCortePlanificacion(corte)}`}
                objetivos={data.objetivos}
                actualizando={tablero.isFetching}
                soloLectura={soloLectura}
              />
            </TabsContent>
          </Tabs>

          {configurando && !soloLectura && (
            <SegmentacionModal
              matriz={data.matriz}
              campania={data.campania}
              onClose={() => setConfigurando(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

function etiquetaSnapshot(snapshot: SnapshotPlanificacionDto): string {
  const capturado = fechaHoraPlanificacion(snapshot.capturadoEn);
  return `${capturado} · ${snapshot.productores} productores`;
}

function SnapshotBanner({
  snapshot,
  onVolverAlVivo,
}: {
  snapshot: SnapshotPlanificacionDto;
  onVolverAlVivo: () => void;
}) {
  return (
    <section
      role="status"
      className="mb-4 flex flex-col gap-3 rounded-card border border-slate-brand/25 bg-slate-brand/5 p-3.5 shadow-card sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="text-sm font-semibold text-slate-brand">Foto guardada · Sólo lectura</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
          {`Capturada el ${fechaHoraPlanificacion(snapshot.capturadoEn)} · ${snapshot.productores} productores · revisión de matriz ${snapshot.matrizRevision} · revisión de objetivos ${snapshot.objetivosRevision}.`}
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onVolverAlVivo}>
        Volver a datos vivos
      </Button>
    </section>
  );
}

function SnapshotSinMetadatos({
  reintentando,
  onReintentar,
  onVolverAlVivo,
}: {
  reintentando: boolean;
  onReintentar: () => void;
  onVolverAlVivo: () => void;
}) {
  return (
    <section
      role="alert"
      className="rounded-card border border-clementina-deep/30 bg-clementina/10 p-5 shadow-card"
    >
      <h2 className="font-display text-lg font-semibold text-ink">
        No se pudo recuperar la foto seleccionada
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Los metadatos del corte no están disponibles. Podés volver a consultar el listado de fotos
        o continuar con los datos vivos.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={reintentando}
          onClick={onReintentar}
        >
          {reintentando ? "Reintentando…" : "Reintentar metadatos"}
        </Button>
        <Button type="button" size="sm" onClick={onVolverAlVivo}>
          Volver a datos vivos
        </Button>
      </div>
    </section>
  );
}

function CargandoTablero() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-36 w-full rounded-card" />
        <Skeleton className="h-36 w-full rounded-card" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {[0, 1, 2, 3, 4].map((indice) => (
          <Skeleton key={indice} className="h-24 w-full rounded-card" />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-card" />
    </div>
  );
}
