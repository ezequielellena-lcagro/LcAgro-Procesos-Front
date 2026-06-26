import type { StockFiltros } from "../types";

export const stockKeys = {
  all: ["stock"] as const,
  lists: () => [...stockKeys.all, "list"] as const,
  list: (f: StockFiltros) => [...stockKeys.lists(), f] as const,
  filtros: () => [...stockKeys.all, "filtros"] as const,
};
