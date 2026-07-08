import { KpiCard } from "@/shared/components/kpi-card";
import { pct, usd } from "@/shared/format/format";
import type { TotalesStock } from "../types";

// KPIs sobre TODO el set filtrado (lo calcula el backend), no la página.
export function StockKpis({ totales }: { totales: TotalesStock }) {
  return (
    <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
      <KpiCard label="Artículos" value={totales.cantidadArticulos} />
      <KpiCard
        label="Valor USD"
        value={usd(totales.valorUsdTotal)}
        hint={`Propio ${usd(totales.valorUsdPropio)} · Consignado ${usd(totales.valorUsdConsignado)}`}
        tone="verde"
      />
      <KpiCard
        label="Inmovilizado"
        value={usd(totales.valorUsdInmovilizado)}
        hint={`${pct(totales.pctInmovilizado)} del total`}
        tone="rojo"
      />
      <KpiCard label="En riesgo de quiebre" value={totales.cantidadRiesgoQuiebre} tone="rojo" />
      <KpiCard label="Bajo mínimo" value={totales.cantidadBajoMinimo} tone="rojo" />
    </div>
  );
}
