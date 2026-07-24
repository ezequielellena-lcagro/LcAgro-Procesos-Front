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

/**
 * Hint del comprometido. NO es siempre una tajada del valorizado: los artículos agotados con ventas
 * pendientes (stock 0) aportan al comprometido y cero al total, así que puede SUPERARLO. Cuando pasa
 * se dice, en vez de dejar dos números que parecen incoherentes.
 */
function hintComprometido(comprometido: number, total: number): string {
  if (comprometido > total)
    return "Supera el stock valorizado: hay artículos vendidos sin existencia física";
  // A un decimal, como el `pctInmovilizado` que ya redondea el backend.
  const parte =
    total > 0 ? `${pct(Math.round((comprometido / total) * 1000) / 10)} del stock valorizado · ` : "";
  return `${parte}ya vendido, sin entregar`;
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
      {/* Plata que está en el galpón pero ya tiene dueño. Tono neutro a propósito: es mercadería
          vendida, no un problema como "USD vencido" o "inmovilizado". */}
      <KpiCard
        label="USD comprometido"
        value={usd(totales.valorUsdComprometido)}
        hint={hintComprometido(totales.valorUsdComprometido, totales.valorUsdTotal)}
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

function kpisDeTab(tab: TabStock, totales: TotalesStock): ReactNode {
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

/**
 * KPI(s) de la solapa activa. `totales` viene del SET BASE (filtros compartidos), así que los
 * números NO cambian al cambiar de solapa: la solapa es el drill-down de ese número.
 *
 * `estadoFiltrado` avisa que hay un filtro de Estado activo. Es el único control de la barra que no
 * mueve estos números (el backend lo aplica como drill-down), así que se dice explícitamente: sin
 * eso, aislar "Riesgo quiebre" deja 3 filas abajo y el valor USD del total arriba, y se lee mal.
 */
export function StockKpis({
  tab,
  totales,
  estadoFiltrado = false,
}: { tab: TabStock; estadoFiltrado?: boolean } & Props) {
  const kpis = kpisDeTab(tab, totales);
  if (kpis === null) return null;
  return (
    <>
      {kpis}
      {estadoFiltrado && (
        <p className="-mt-2 mb-4 text-xs text-ink-soft">
          KPIs sobre el total filtrado arriba: el filtro de Estado solo acota el listado.
        </p>
      )}
    </>
  );
}
