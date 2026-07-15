import type { CuentasFiltros } from "../types";

export const cuentasKeys = {
  all: ["cuentas"] as const,
  lists: () => [...cuentasKeys.all, "list"] as const,
  list: (f: CuentasFiltros) => [...cuentasKeys.lists(), f] as const,
  facturas: (cuenta: number, umbralAvencer?: number) =>
    [...cuentasKeys.all, "facturas-contado", cuenta, umbralAvencer ?? null] as const,
};
