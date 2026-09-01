import type { AFijarDetalleDto, EstadoFijacion, StockCerealDto, TotalesCereal } from "../types";

/**
 * Filtro de vencimiento de fijación. Además de los estados del semáforo hay una opción compuesta
 * `urgente` (vencido o vence dentro de 30 días), que es la pregunta que la mesa hace de verdad:
 * "¿qué tengo que fijar ya?".
 */
export type FiltroVencimiento = "" | "urgente" | EstadoFijacion;

export const OPCIONES_VENCIMIENTO: { value: FiltroVencimiento; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "urgente", label: "Vencido o ≤30 días" },
  { value: "Vencido", label: "Vencido" },
  { value: "Naranja", label: "Vence en ≤30 días" },
  { value: "Amarillo", label: "Vence en 31-60 días" },
  { value: "Verde", label: "Vence en +60 días" },
  { value: "SinFecha", label: "Sin fecha de vencimiento" },
];

/** Cereales presentes en el reporte, en el orden en que los devuelve el backend (los más pesados primero). */
export function cerealesDe(data: StockCerealDto): string[] {
  return data.consolidado.map((c) => c.cereal);
}

/**
 * Acota TODO el reporte a un cereal —consolidado, planta 10, alertas y totales—. Es un filtro de
 * lectura completo: si se mira Soja, los KPIs también son de Soja. Con cereal vacío devuelve el
 * reporte tal cual (misma referencia, sin copiar).
 */
export function filtrarPorCereal(data: StockCerealDto, cereal: string): StockCerealDto {
  if (!cereal) return data;
  const consolidado = data.consolidado.filter((c) => c.cereal === cereal);
  const detallePlanta10 = data.detallePlanta10.filter((d) => d.cereal === cereal);
  return {
    ...data,
    consolidado,
    detallePlanta10,
    alertasDescarga: data.alertasDescarga.filter((a) => a.cereal === cereal),
    totales: recalcularTotales(consolidado, detallePlanta10),
  };
}

/**
 * Filtra las líneas de planta 10 por vencimiento de fijación. Aplica SOLO a las tablas de planta 10:
 * el consolidado y los KPIs siguen mostrando la existencia completa, porque el grano no deja de
 * estar en la planta porque su fijación venza más adelante.
 */
export function filtrarPorVencimiento(
  filas: AFijarDetalleDto[],
  filtro: FiltroVencimiento,
): AFijarDetalleDto[] {
  if (!filtro) return filas;
  if (filtro === "urgente")
    return filas.filter((f) => f.estado === "Vencido" || (f.diasParaVto !== null && f.diasParaVto <= 30));
  return filas.filter((f) => f.estado === filtro);
}

/** Rehace los totales sobre el subconjunto filtrado, con las mismas reglas que el backend. */
function recalcularTotales(
  consolidado: StockCerealDto["consolidado"],
  detalle: AFijarDetalleDto[],
): TotalesCereal {
  const vencidos = detalle.filter((d) => d.estado === "Vencido");
  const proximos = detalle.filter((d) => d.diasParaVto !== null && d.diasParaVto >= 0 && d.diasParaVto <= 30);
  const suma = (get: (c: StockCerealDto["consolidado"][number]) => number) =>
    consolidado.reduce((acc, c) => acc + get(c), 0);
  return {
    p15: suma((c) => c.p15),
    p20: suma((c) => c.p20),
    p10: suma((c) => c.p10),
    silobolsa: suma((c) => c.silobolsa),
    total: suma((c) => c.total),
    vencidoTn: vencidos.reduce((acc, d) => acc + d.aFijarTn, 0),
    vencidoContratos: vencidos.length,
    proximo30Tn: proximos.reduce((acc, d) => acc + d.aFijarTn, 0),
    proximo30Contratos: proximos.length,
  };
}
