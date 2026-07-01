import { KpiCard } from "@/shared/components/kpi-card";
import { usd } from "@/shared/format/format";
import type { TotalesCuentas } from "../types";

// KPIs sobre TODO el set filtrado (lo calcula el backend), no la página. Si se filtra por un vendedor,
// muestran el total de ese vendedor; en "Todos", el total general.
export function CuentasKpis({ totales }: { totales: TotalesCuentas }) {
  return (
    <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
      <KpiCard label="Cuentas" value={totales.cuentas} />
      <KpiCard label="Saldo vencido" value={usd(totales.vencido)} tone="rojo" />
      <KpiCard label="A vencer" value={usd(totales.aVencer)} />
      <KpiCard label="Cartera" value={usd(totales.saldo)} tone="verde" />
    </div>
  );
}
