import { KpiCard } from "@/shared/components/kpi-card";
import { kg, toneladas, unidades } from "../format";
import type { StockTotalesDto } from "../types";

/**
 * La semilla de un cliente nunca se suma a los totales propios (ADR-13/R4.3): no es stock
 * vendible de La Clementina. Se muestra aparte, con un texto que lo aclara.
 */
export function SemilleroKpis({ totales }: { totales: StockTotalesDto }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
      <KpiCard label="BigBags propios" value={unidades(totales.propio.bigBagsDisponibles)} />
      <KpiCard label="Bolsas propias" value={unidades(totales.propio.bolsasDisponibles)} />
      <KpiCard label="Disponible propio" value={toneladas(totales.propio.kgDisponibles)} tone="verde" />
      <KpiCard
        label="Semilla de clientes"
        value={toneladas(totales.clientes.kgDisponibles)}
        hint="No es stock vendible"
      />
      <KpiCard
        label="Órdenes pendientes"
        value={totales.ordenesPendientes}
        hint={`${kg(totales.kgComprometidos)} reservados`}
      />
    </div>
  );
}
