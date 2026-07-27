import type { ContadoFiltros, CuentasFiltros } from "../types";

export const cuentasKeys = {
  all: ["cuentas"] as const,
  lists: () => [...cuentasKeys.all, "list"] as const,
  list: (f: CuentasFiltros) => [...cuentasKeys.lists(), f] as const,
  contado: (f: ContadoFiltros) => [...cuentasKeys.all, "contado", f] as const,
};
