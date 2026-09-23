import { Sliders } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/shared/components/page-header";
import { useAvisoCambiosSinGuardar } from "@/shared/hooks/use-aviso-cambios-sin-guardar";
import { ConsolidadoPanel } from "../components/consolidado-panel";
import { MarketShareForm } from "../components/market-share-form";
import { PlanSiembraPanel } from "../components/plan-siembra-panel";
import { VendedoresDialog } from "../components/vendedores-dialog";
import { useContextoPlanificacion } from "../queries/use-plan-siembra";

type Solapa = "plan" | "consolidado" | "market-share";
const SOLAPAS: { id: Solapa; nombre: string; gestion?: boolean }[] = [
  { id: "plan", nombre: "Plan de siembra" },
  { id: "consolidado", nombre: "Consolidado" },
  { id: "market-share", nombre: "Market Share", gestion: true },
];

export function PlanificacionVentasPage() {
  const contexto = useContextoPlanificacion();
  const [solapa, setSolapa] = useState<Solapa>("plan");
  // Nodo del encabezado donde la solapa activa manda su "Datos de MacroGest al … / Actualizar".
  const [slotFuente, setSlotFuente] = useState<HTMLElement | null>(null);
  const [planDirty, setPlanDirty] = useState(false);
  const [marketDirty, setMarketDirty] = useState(false);
  // Los vendedores no entran acá: el tilde de cada uno guarda solo, no deja borrador que avisar.
  const [ajustesOpen, setAjustesOpen] = useState(false);
  useAvisoCambiosSinGuardar(planDirty || marketDirty);
  const puedeGestionar = contexto.data?.alcance.veTodo ?? false;
  const solapaVisible =
    contexto.data && !puedeGestionar && solapa === "market-share" ? "plan" : solapa;
  return (
    <div>
      <PageHeader
        title="Planificación de Ventas"
        subtitle="Plan de siembra y seguimiento comercial por campaña."
        actions={
          <>
            <div ref={setSlotFuente} className="flex items-center gap-2" />
            {puedeGestionar && (
              <Button type="button" size="sm" onClick={() => setAjustesOpen(true)}>
                <Sliders className="size-4" /> Ajustes
              </Button>
            )}
          </>
        }
      />
      {/* Montado sólo mientras está abierto: así cada vez arranca en la primera página y sin
          filtro, y el catálogo no se consulta al entrar a la pantalla. */}
      {ajustesOpen && <VendedoresDialog open onClose={() => setAjustesOpen(false)} />}
      {contexto.data ? (
        <>
          {contexto.isError && (
            <ErrorState error={contexto.error} onRetry={() => void contexto.refetch()} />
          )}
          {/* Sólo la tira de solapas sale del componente compartido: los paneles se quedan
              montados (hidden) para no perder el borrador, así que no usamos TabsContent. */}
          <Tabs value={solapaVisible} onValueChange={setSolapa} className="mb-4">
            <TabsList label="Planificación de Ventas">
              {SOLAPAS.filter((item) => !item.gestion || puedeGestionar).map(
                (item) => (
                  <TabsTrigger key={item.id} value={item.id}>
                    {item.nombre}
                  </TabsTrigger>
                ),
              )}
            </TabsList>
          </Tabs>
          {/* La carga conserva su borrador y su aviso de salida al cambiar de solapa. */}
          <div
            id="tabpanel-plan"
            role="tabpanel"
            aria-labelledby="tab-plan"
            hidden={solapaVisible !== "plan"}
          >
            <PlanSiembraPanel
              contexto={contexto.data}
              activo={solapaVisible === "plan"}
              slotFuente={slotFuente}
              onDirtyChange={setPlanDirty}
            />
          </div>
          {solapaVisible === "consolidado" && (
            <div id="tabpanel-consolidado" role="tabpanel" aria-labelledby="tab-consolidado">
              <ConsolidadoPanel contexto={contexto.data} slotFuente={slotFuente} />
            </div>
          )}
          {puedeGestionar && (
            <div
              id="tabpanel-market-share"
              role="tabpanel"
              aria-labelledby="tab-market-share"
              hidden={solapaVisible !== "market-share"}
            >
              <MarketShareForm
                contexto={contexto.data}
                activo={solapaVisible === "market-share"}
                onDirtyChange={setMarketDirty}
              />
            </div>
          )}
        </>
      ) : contexto.isError ? (
        <ErrorState error={contexto.error} onRetry={() => void contexto.refetch()} />
      ) : (
        <EmptyState mensaje="Cargando planificación de ventas…" />
      )}
    </div>
  );
}
