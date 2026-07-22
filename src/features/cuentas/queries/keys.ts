import type { CuentasFiltros, FacturasMoraFiltros } from "../types";

export const cuentasKeys = {
  all: ["cuentas"] as const,
  lists: () => [...cuentasKeys.all, "list"] as const,
  list: (f: CuentasFiltros) => [...cuentasKeys.lists(), f] as const,
  mora: (f: FacturasMoraFiltros) => [...cuentasKeys.all, "mora", f] as const,
};
