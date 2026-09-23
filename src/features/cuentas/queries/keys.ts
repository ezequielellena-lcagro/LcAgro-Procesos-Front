import type { ContadoFiltros, CuentasFiltros } from "../types";

export const cuentasKeys = {
  all: ["cuentas"] as const,
  lists: () => [...cuentasKeys.all, "list"] as const,
  list: (f: CuentasFiltros) => [...cuentasKeys.lists(), f] as const,
  contado: (f: ContadoFiltros) => [...cuentasKeys.all, "contado", f] as const,
  // Histórico mensual. `cierre()` es el prefijo: invalidarlo alcanza estado, períodos y detalles.
  cierre: () => [...cuentasKeys.all, "cierre"] as const,
  cierreEstado: () => [...cuentasKeys.cierre(), "estado"] as const,
  cierrePeriodos: () => [...cuentasKeys.cierre(), "periodos"] as const,
  cierrePeriodo: (anio: number, mes: number, revision?: number) =>
    [...cuentasKeys.cierre(), "periodo", anio, mes, revision ?? "vigente"] as const,
  cierreRevisiones: (anio: number, mes: number) =>
    [...cuentasKeys.cierre(), "revisiones", anio, mes] as const,
  cierreDiff: (anio: number, mes: number) => [...cuentasKeys.cierre(), "diff", anio, mes] as const,
};
