import { useState } from "react";
import { Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-context";
import { toAppError } from "@/lib/api-error";
import { CampaniaSelect } from "@/shared/components/campania-select";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { PageHeader } from "@/shared/components/page-header";
import { EvolucionPanel } from "../components/evolucion-panel";
import { ObjetivosPanel } from "../components/objetivos-panel";
import { SerieCampanias } from "../components/serie-campanias";
import { TarjetasGestion } from "../components/tarjetas-gestion";
import { VendedoresPanel } from "../components/vendedores-panel";
import { entero } from "../lib/formato";
import {
  useGuardarObjetivos,
  useGuardarObjetivosVendedores,
  useRefrescarTablero,
  useRestablecerObjetivos,
  useTableroAcopio,
} from "../queries/use-tablero-acopio";

type Solapa = "gestion" | "evolucion" | "vendedores" | "objetivos";

const avisarError = (e: unknown) => toast.error(toAppError(e).message);

/**
 * Tablero de gestión del acopio: los 6 indicadores por campaña contra sus objetivos, para la
 * devolución al equipo (02-desarrollo/14-tablero-acopio.md). Es genérico: lo central son las tarjetas
 * de la campaña titular y la serie por campaña.
 */
export function TableroAcopioPage() {
  const { hasAnyRole } = useAuth();
  const tablero = useTableroAcopio();
  const refrescar = useRefrescarTablero();
  const [campaniaSel, setCampaniaSel] = useState<string>();
  const [solapa, setSolapa] = useState<Solapa>("gestion");

  const data = tablero.data;
  const campanias = data?.campanias ?? [];
  const titular = campanias.find((c) => c.titular)?.campania ?? campanias.at(-1)?.campania;
  const campania = campanias.find((c) => c.campania === (campaniaSel ?? titular));

  const guardarObjetivos = useGuardarObjetivos(campania?.campania);
  const restablecer = useRestablecerObjetivos(campania?.campania);
  const guardarVendedores = useGuardarObjetivosVendedores(campania?.campania);
  const puedeEditar = hasAnyRole(["tableroacopio"]);

  const generado = data
    ? new Date(data.generado).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : "";
  const excluido = data?.acopiadoExcluido.find((e) => e.campania === campania?.campania);

  return (
    <div>
      <PageHeader
        title="Tablero de gestión del acopio"
        subtitle={
          data
            ? `Devolución al equipo · MacroGest en vivo · corte comparable al ${data.corte}${
                data.corteFijo ? " (fijo)" : ""
              } · calculado a las ${generado}`
            : "Los 6 indicadores de la devolución al equipo contra sus objetivos"
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={refrescar.isPending || !data}
              onClick={() => refrescar.mutate(undefined, { onError: avisarError })}
            >
              <RefreshCw className={refrescar.isPending ? "size-4 animate-spin" : "size-4"} />
              {refrescar.isPending ? "Leyendo MacroGest…" : "Actualizar"}
            </Button>
            <Button
              type="button"
              variant="accent"
              size="sm"
              disabled={!data}
              onClick={() => window.print()}
            >
              <Printer className="size-4" /> Exportar a PDF
            </Button>
          </>
        }
      />

      {tablero.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        </div>
      ) : tablero.isError ? (
        <ErrorState error={tablero.error} onRetry={() => void tablero.refetch()} />
      ) : !data || !campania ? (
        <EmptyState mensaje="Todavía no hay campañas con datos para el tablero." />
      ) : (
        <>
          <FilterBar>
            <FilterField label="Campaña">
              <CampaniaSelect
                value={campania.campania}
                campanias={[...campanias].reverse().map((c) => c.campania)}
                onChange={setCampaniaSel}
              />
            </FilterField>
            <p className="pb-2 text-sm text-ink-soft">
              {campania.preCorte
                ? `${campania.campania} todavía no llegó al corte del ${data.corte}: no se juzga contra objetivo.`
                : campania.definitiva
                  ? `${campania.campania} es definitiva: su número ya no se mueve.`
                  : `${campania.campania} es provisoria: faltan ${entero(campania.tnSinPrecio ?? 0)} tn de venta por fijar.`}
              {campania.titular && " Es la campaña titular de la devolución."}
            </p>
          </FilterBar>

          <Tabs value={solapa} onValueChange={setSolapa}>
            <TabsList label="Solapas del tablero" className="no-print mb-4 flex-wrap">
              <TabsTrigger value="gestion">Gestión</TabsTrigger>
              <TabsTrigger value="evolucion">Evolución</TabsTrigger>
              <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
              <TabsTrigger value="objetivos">Objetivos</TabsTrigger>
            </TabsList>

            <TabsContent value="gestion" className="space-y-4">
              <TarjetasGestion campania={campania} excluido={excluido} />
              <SerieCampanias
                campanias={campanias}
                seleccionada={campania.campania}
                corte={data.corte}
              />
              <p className="text-xs text-ink-soft">
                Posición con el arrastre de Posición de cereal desde{" "}
                {data.campaniaInicioArrastre ?? "—"}; las campañas anteriores, solas. Comisiones
                netas del período 1/11–31/10 (ARS): bruta − corredores que facturan aparte − IIBB −
                impuesto a los débitos y créditos de las cuentas reducidas. Rotación = planta 15 ÷{" "}
                {entero(data.parametros.capacidadAcopioTn)} tn.
              </p>
            </TabsContent>

            <TabsContent value="evolucion">
              <EvolucionPanel filas={data.evolucion} />
            </TabsContent>

            <TabsContent value="vendedores">
              <VendedoresPanel
                key={`${campania.campania}-${data.vendedores
                  .filter((v) => v.campania === campania.campania)
                  .map((v) => v.objetivoTn)
                  .join(",")}`}
                campania={campania}
                vendedores={data.vendedores.filter((v) => v.campania === campania.campania)}
                excluido={excluido}
                corte={data.corte}
                puedeEditar={puedeEditar}
                guardando={guardarVendedores.isPending}
                onGuardar={(cambios) =>
                  guardarVendedores.mutate({ vendedores: cambios }, { onError: avisarError })
                }
              />
            </TabsContent>

            <TabsContent value="objetivos">
              <ObjetivosPanel
                key={`${campania.campania}-${JSON.stringify(campania.objetivos)}-${JSON.stringify(campania.objetivosCereal)}`}
                campania={campania}
                acopiadoCereal={data.acopiadoCereal.filter((a) => a.campania === campania.campania)}
                puedeEditar={puedeEditar}
                guardando={guardarObjetivos.isPending || restablecer.isPending}
                onGuardar={(req) => guardarObjetivos.mutate(req, { onError: avisarError })}
                onRestablecer={() => restablecer.mutate(undefined, { onError: avisarError })}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
