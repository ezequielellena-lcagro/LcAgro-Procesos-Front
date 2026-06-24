import type { CultivoSemilla, SemillaFiltros } from "../types";

export const semillaKeys = {
  all: ["semilla"] as const,
  ventas: (f: SemillaFiltros) => [...semillaKeys.all, "ventas", f] as const,
  articulos: () => [...semillaKeys.all, "articulos"] as const,
  variedades: (cultivo: CultivoSemilla) => [...semillaKeys.all, "variedades", cultivo] as const,
};
