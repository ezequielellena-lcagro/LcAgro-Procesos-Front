import type { ComisionesFiltros } from "../types";

export const comisionesKeys = {
  all: ["comisiones"] as const,
  lists: () => [...comisionesKeys.all, "list"] as const,
  list: (f: ComisionesFiltros) => [...comisionesKeys.lists(), f] as const,
  resumenes: () => [...comisionesKeys.all, "resumen"] as const,
  resumen: (f: { anio: number; mes: number; vendNro?: number }) =>
    [...comisionesKeys.resumenes(), f] as const,
  /** Correcciones manuales de costo por artículo (no dependen del período). */
  costos: () => [...comisionesKeys.all, "costos"] as const,
};
