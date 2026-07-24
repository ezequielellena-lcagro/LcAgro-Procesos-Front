import type { EstadoStock, StockFiltros } from "./types";

/** Las 5 solapas de la pantalla de Stock. Cada una es el drill-down de su KPI. */
export type TabStock = "stock" | "global" | "vencimientos" | "inmovilizado" | "rubro";

/** Solapas en el orden en que se muestran. */
export const TABS_STOCK: { value: TabStock; label: string }[] = [
  { value: "stock", label: "Stock" },
  { value: "global", label: "Stock global" },
  { value: "vencimientos", label: "Vencimientos" },
  { value: "inmovilizado", label: "Inmovilizado" },
  { value: "rubro", label: "Por rubro" },
];

/** Lo que la solapa le agrega a los filtros compartidos. No afecta los KPIs (los calcula el set base). */
export type PresetTab = Pick<StockFiltros, "estado" | "estadosVenc" | "orden" | "consolidado">;

/**
 * Preset de consulta de cada solapa. Función pura: la solapa NO toca los filtros compartidos,
 * solo agrega el drill-down y el orden con el que se lee esa pregunta.
 *
 * El preset se aplica DESPUÉS de los filtros compartidos (`{...compartidos, ...preset}`), así que
 * lo que fije acá gana. Cuando eso pasa con un filtro que el usuario también ve arriba —hoy solo
 * `estado`, en la solapa Inmovilizado— la barra lo muestra fijo y deshabilitado
 * (ver `estadoFijoDeTab`), para que se entienda en vez de pisarse en silencio.
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
    case "global":
      // Una fila por artículo sumando todos los depósitos, la plata más grande arriba.
      return { consolidado: true, orden: "Valor" };
    case "stock":
      return { orden: "Deposito" };
  }
}

/**
 * Estado que la solapa IMPONE sobre el filtro compartido, o `undefined` si respeta lo que elija
 * el usuario. Sale del propio preset para que no haya dos verdades: si mañana otra solapa fija un
 * estado, la barra de filtros se entera sola.
 */
export function estadoFijoDeTab(tab: TabStock): EstadoStock | undefined {
  return presetDeTab(tab).estado;
}

/**
 * Solapas que se dibujan con `items` y por lo tanto SÍ sienten el filtro de estado. "Por rubro" no:
 * se dibuja con `porRubro`, que el backend calcula sobre el set base sin drill-down. Ahí el control
 * quedaba habilitado y no movía un pixel del gráfico — el mismo pisado silencioso que resuelve
 * `estadoFijoDeTab`, pero al revés (control activo sin efecto en vez de elección pisada).
 */
export function estadoAplicaEnTab(tab: TabStock): boolean {
  return tab !== "rubro";
}

/** Por qué el filtro de estado está deshabilitado en esta solapa, o `undefined` si no lo está. */
export function motivoEstadoIgnorado(tab: TabStock): string | undefined {
  return estadoAplicaEnTab(tab)
    ? undefined
    : "Esta solapa se dibuja sobre el total por rubro: el estado no la afecta.";
}
