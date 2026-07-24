import type { ReactNode } from "react";
import { KpiCard } from "@/shared/components/kpi-card";
import { oDash, pct, usd } from "@/shared/format/format";
import type { TabStock } from "../tabs";
import type { TotalesStock } from "../types";

interface Props {
  totales: TotalesStock;
}

/** Encabezado de KPIs de una solapa: 1-2 tarjetas, no una pared. */
function KpiRow({ children }: { children: ReactNode }) {
  return <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

function KpisStock({ totales }: Props) {
  return (
    <KpiRow>
      <KpiCard
        label="Valor USD"
        value={usd(totales.valorUsdTotal)}
        hint={`Propio ${usd(totales.valorUsdPropio)} · Consignado ${usd(totales.valorUsdConsignado)}`}
        tone="verde"
      />
      {/* Plata que está en el galpón pero ya no es nuestra: el stock valorizado la incluye. */}
      <KpiCard
        label="USD comprometido"
        value={usd(totales.valorUsdComprometido)}
        hint="Ya vendido, sin entregar"
        tone="rojo"
      />
    </KpiRow>
  );
}

function KpisVencimientos({ totales }: Props) {
  return (
    <KpiRow>
      <KpiCard label="USD vencido" value={usd(totales.valorUsdVencido)} tone="rojo" />
      <KpiCard
        label="Por vencer"
        value={usd(totales.valorUsdPorVencer)}
        hint={`${totales.cantidadPorVencer} art. (vencido + crítico)`}
        tone="rojo"
      />
    </KpiRow>
  );
}

function KpisInmovilizado({ totales }: Props) {
  const antiguedad = oDash(totales.antiguedadPromedioDias, (d) => `${d} días`);
  return (
    <KpiRow>
      <KpiCard
        label="USD inmovilizado"
        value={usd(totales.valorUsdInmovilizado)}
        hint={`${pct(totales.pctInmovilizado)} del total · antigüedad prom. ${antiguedad}`}
        tone="rojo"
      />
    </KpiRow>
  );
}

/**
 * KPI(s) de la solapa activa. `totales` viene del SET BASE (filtros compartidos), así que los
 * números NO cambian al cambiar de solapa: la solapa es el drill-down de ese número.
 */
export function StockKpis({ tab, totales }: { tab: TabStock } & Props) {
  switch (tab) {
    // "Stock global" es el mismo set visto sin depósitos: comparte los KPIs con la solapa Stock.
    case "stock":
    case "global":
      return <KpisStock totales={totales} />;
    case "vencimientos":
      return <KpisVencimientos totales={totales} />;
    case "inmovilizado":
      return <KpisInmovilizado totales={totales} />;
    case "rubro":
      // El gráfico por rubro ya es su propio número: no lleva KPI arriba.
      return null;
  }
}
