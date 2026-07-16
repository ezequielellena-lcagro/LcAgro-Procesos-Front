import type { StockFiltros } from "./types";

/** Las 4 solapas de la pantalla de Stock. Cada una es el drill-down de su KPI. */
export type TabStock = "stock" | "vencimientos" | "inmovilizado" | "rubro";

/** Solapas en el orden en que se muestran. */
export const TABS_STOCK: { value: TabStock; label: string }[] = [
  { value: "stock", label: "Stock" },
  { value: "vencimientos", label: "Vencimientos" },
  { value: "inmovilizado", label: "Inmovilizado" },
  { value: "rubro", label: "Por rubro" },
];

/** Lo que la solapa le agrega a los filtros compartidos. No afecta los KPIs (los calcula el set base). */
export type PresetTab = Pick<StockFiltros, "estado" | "estadosVenc" | "orden">;

/**
 * Preset de consulta de cada solapa. Función pura: la solapa NO toca los filtros compartidos,
 * solo agrega el drill-down y el orden con el que se lee esa pregunta.
 */
export function presetDeTab(tab: TabStock): PresetTab {
  switch (tab) {
    case "vencimientos":
      return { estadosVenc: ["Vencido", "Critico", "Alerta"], orden: "Vencimiento" };
    case "inmovilizado":
      return { estado: "Inmovilizado", orden: "Valor" };
    case "rubro":
      // No pagina: se dibuja con `porRubro` de la respuesta.
      return {};
    case "stock":
      return { orden: "Deposito" };
  }
}
