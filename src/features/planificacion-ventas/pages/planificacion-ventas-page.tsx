import { useState } from "react";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { PageHeader } from "@/shared/components/page-header";
import { useAvisoCambiosSinGuardar } from "@/shared/hooks/use-aviso-cambios-sin-guardar";
import { ConsolidadoPanel } from "../components/consolidado-panel";
import { MarketShareForm } from "../components/market-share-form";
import { PlanSiembraPanel } from "../components/plan-siembra-panel";
import { useContextoPlanificacion } from "../queries/use-plan-siembra";

type Solapa = "plan" | "consolidado" | "market-share" | "vendedores";
const SOLAPAS: { id: Solapa; nombre: string; gestion?: boolean }[] = [
  { id: "plan", nombre: "Plan de siembra" },
  { id: "consolidado", nombre: "Consolidado" },
  { id: "market-share", nombre: "Market Share", gestion: true },
  { id: "vendedores", nombre: "Vendedores", gestion: true },
];

export function PlanificacionVentasPage() {
  const contexto = useContextoPlanificacion();
  const [solapa, setSolapa] = useState<Solapa>("plan");
  const [planDirty, setPlanDirty] = useState(false);
  const [marketDirty, setMarketDirty] = useState(false);
  useAvisoCambiosSinGuardar(planDirty || marketDirty);
  const solapaVisible =
    contexto.data &&
    !contexto.data.alcance.veTodo &&
    (solapa === "market-share" || solapa === "vendedores")
      ? "plan"
      : solapa;
  return (
    <div>
      <PageHeader
        title="Planificación de Ventas"
        subtitle="Plan de siembra y seguimiento comercial por campaña."
      />
      {contexto.data ? (
        <>
          {contexto.isError && (
            <ErrorState error={contexto.error} onRetry={() => void contexto.refetch()} />
          )}
          <div
            role="tablist"
            aria-label="Planificación de Ventas"
            className="mb-5 flex gap-1 overflow-x-auto border-b border-line pb-2"
          >
            {SOLAPAS.filter((item) => !item.gestion || contexto.data.alcance.veTodo).map((item) => (
              <button
                key={item.id}
                id={`solapa-${item.id}`}
                type="button"
                role="tab"
                aria-selected={solapaVisible === item.id}
                aria-controls={`panel-${item.id}`}
                onClick={() => setSolapa(item.id)}
                className={
                  solapaVisible === item.id
                    ? "whitespace-nowrap rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                    : "whitespace-nowrap rounded-md px-4 py-2 text-sm text-ink-soft hover:bg-panel-soft hover:text-ink"
                }
              >
                {item.nombre}
              </button>
            ))}
          </div>
          {/* La carga conserva su borrador y su aviso de salida al cambiar de solapa. */}
          <div
            id="panel-plan"
            role="tabpanel"
            aria-labelledby="solapa-plan"
            hidden={solapaVisible !== "plan"}
          >
            <PlanSiembraPanel contexto={contexto.data} onDirtyChange={setPlanDirty} />
          </div>
          {solapaVisible === "consolidado" && (
            <div id="panel-consolidado" role="tabpanel" aria-labelledby="solapa-consolidado">
              <ConsolidadoPanel contexto={contexto.data} />
            </div>
          )}
          {contexto.data.alcance.veTodo && (
            <div
              id="panel-market-share"
              role="tabpanel"
              aria-labelledby="solapa-market-share"
              hidden={solapaVisible !== "market-share"}
            >
              <MarketShareForm
                contexto={contexto.data}
                activo={solapaVisible === "market-share"}
                onDirtyChange={setMarketDirty}
              />
            </div>
          )}
          {solapaVisible === "vendedores" && contexto.data.alcance.veTodo && (
            <div id="panel-vendedores" role="tabpanel" aria-labelledby="solapa-vendedores">
              <EmptyState mensaje="La administración de vendedores estará disponible en esta solapa." />
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
