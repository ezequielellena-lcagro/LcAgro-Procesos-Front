import { useMemo, useState } from "react";
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
import { claveCampania, ultimasCampanias } from "../lib/campanias";
import { useTableroPlanificacion } from "../queries/use-tablero-planificacion";
import type { TableroFiltros } from "../types";

type Tab = "cartera" | "objetivos";

function filtrosIniciales(campania: string): TableroFiltros {
  return { campania, orden: "Oportunidad", page: 1, pageSize: 50 };
}

/** Tablero productivo de planificación. Toda la lógica comercial llega resuelta por la API. */
export function PlanificacionPage() {
  const inicial = useMemo(() => claveCampania(new Date()), []);
  const campaniasIniciales = useMemo(() => ultimasCampanias(new Date(), 3), []);
  const [tab, setTab] = useState<Tab>("cartera");
  const [filtros, setFiltros] = useState<TableroFiltros>(() => filtrosIniciales(inicial));
  const [busqueda, setBusqueda] = useState("");
  const [configurando, setConfigurando] = useState(false);
  const busquedaDiferida = useDebounce(busqueda.trim(), 350);

  const filtrosConsulta = useMemo<TableroFiltros>(
    () => ({ ...filtros, q: busquedaDiferida || undefined }),
    [busquedaDiferida, filtros],
  );
  const tablero = useTableroPlanificacion(filtrosConsulta);
  const data = tablero.data;

  function cambiarCampania(campania: string) {
    setFiltros(filtrosIniciales(campania));
    setBusqueda("");
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
                Corte generado {new Date(data.generadoEn).toLocaleString("es-AR")}
              </span>
            )}
            <label className="text-xs font-medium text-ink-soft">
              Campaña
              <Select
                className="mt-1 h-9 min-w-36 text-ink"
                value={filtros.campania}
                onChange={(event) => cambiarCampania(event.target.value)}
                disabled={tablero.isPending}
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

      {tablero.isError && !data ? (
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
            <ComparacionFuentes tablero={data} />
          </div>

          <Tabs value={tab} onValueChange={(valor) => setTab(valor as Tab)}>
            <TabsList>
              <TabsTrigger value="cartera">Cartera de productores</TabsTrigger>
              <TabsTrigger value="objetivos">Objetivos y avance</TabsTrigger>
            </TabsList>

            <TabsContent value="cartera">
              <CarteraTab
                key={data.campania}
                tablero={data}
                filtros={filtrosConsulta}
                busqueda={busqueda}
                actualizando={tablero.isFetching}
                onBusqueda={cambiarBusqueda}
                onFiltros={cambiarFiltros}
                onLimpiarFiltros={limpiarFiltros}
                onConfigurarSegmentacion={() => setConfigurando(true)}
              />
            </TabsContent>

            <TabsContent value="objetivos">
              <ObjetivosTab
                key={`${data.campania}-${data.objetivos.revision}`}
                objetivos={data.objetivos}
                actualizando={tablero.isFetching}
              />
            </TabsContent>
          </Tabs>

          {configurando && (
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
