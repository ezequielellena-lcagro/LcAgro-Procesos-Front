import type { PrestamoFiltros, ResumenFiltros, VencimientoFiltros } from "../types";

export const prestamosKeys = {
  all: ["prestamos"] as const,
  lists: () => [...prestamosKeys.all, "list"] as const,
  list: (f: PrestamoFiltros) => [...prestamosKeys.lists(), f] as const,
  detalles: () => [...prestamosKeys.all, "detalle"] as const,
  detalle: (id: number) => [...prestamosKeys.detalles(), id] as const,
  vencimientos: () => [...prestamosKeys.all, "vencimientos"] as const,
  vencimiento: (f: VencimientoFiltros) => [...prestamosKeys.vencimientos(), f] as const,
  resumenes: () => [...prestamosKeys.all, "resumen"] as const,
  resumen: (f: ResumenFiltros) => [...prestamosKeys.resumenes(), f] as const,
  /** Bancos y líneas: no dependen de ningún filtro. */
  catalogos: () => [...prestamosKeys.all, "catalogos"] as const,
  /** Cruce contra MacroGest. */
  conciliacion: () => [...prestamosKeys.all, "conciliacion"] as const,
};
