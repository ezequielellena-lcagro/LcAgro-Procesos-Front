import { campaniaVigente } from "@/shared/format/campania";

export const filtrosComercialesVacios = { producto: "", campania: "" };
export type FiltrosComerciales = typeof filtrosComercialesVacios;
/** Con qué arrancan los filtros de Logística: la campaña vigente, que es la que se trabaja. */
export function filtrosComercialesIniciales(): FiltrosComerciales {
  return { ...filtrosComercialesVacios, campania: campaniaVigente() };
}

/** Parámetros para los listados propios, que manejan la campaña como `2025-2026`. */
export function paramsComerciales(f: FiltrosComerciales) {
  return {
    producto: f.producto ? Number(f.producto) : undefined,
    campania: f.campania || undefined,
  };
}

/** Parámetros para los listados de MacroGest, que manejan la campaña como `20252026`. */
export function paramsComercialesErp(f: FiltrosComerciales) {
  return {
    producto: f.producto ? Number(f.producto) : undefined,
    campania: f.campania ? Number(f.campania.replace("-", "")) : undefined,
  };
}
