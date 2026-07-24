import { numero } from "@/shared/format/format";
import type { StockItem } from "./types";

/** Lo que ya tiene dueño y sigue en el galpón: facturado + sin facturar. RESTA del disponible. */
export function comprometido(item: StockItem): number {
  return item.ventaFacturados + item.ventaSinFacturar;
}

/** Sobreventa: hay más vendido que stock + pedidos por llegar. El backend NO lo pisa en 0. */
export function haySobreventa(item: StockItem): boolean {
  return item.totalDisponible < 0;
}

/** Desglose del comprometido, para el `title` de la celda agrupada. */
export function detalleComprometido(item: StockItem): string {
  return `Facturado: ${numero(item.ventaFacturados)} · Sin facturar: ${numero(item.ventaSinFacturar)}`;
}

/**
 * La cuenta completa, para el `title` de la celda Disponible: el usuario tiene que poder
 * reconstruir el número sin salir de la fila.
 */
export function detalleDisponible(item: StockItem): string {
  const cuenta =
    `${numero(item.stockActual)} en stock` +
    ` + ${numero(item.pedidosCompras)} por llegar` +
    ` − ${numero(comprometido(item))} comprometido` +
    ` = ${numero(item.totalDisponible)}`;
  return haySobreventa(item) ? `${cuenta}. Sobreventa: hay más vendido que existencias.` : cuenta;
}

/**
 * true cuando la cobertura sobre el stock FÍSICO promete más días que la del disponible, es decir
 * cuando parte del stock ya tiene dueño. Es el caso DICAMBA: 20 días de "cobertura" con 30 litros
 * vendibles. La tabla muestra siempre la del disponible; esto sirve para explicar la diferencia.
 */
export function coberturaEsOptimista(item: StockItem): boolean {
  return (
    item.diasCobertura !== null &&
    item.diasCoberturaDisponible !== null &&
    item.diasCoberturaDisponible < item.diasCobertura
  );
}

/** `title` de la celda de cobertura: qué número es y, si difiere, cuánto prometía el físico. */
export function detalleCobertura(item: StockItem): string {
  if (item.diasCoberturaDisponible === null)
    return "Sin ventas en la ventana: no hay ritmo con el que calcular la cobertura.";
  const base =
    `Días de venta que cubre el DISPONIBLE del artículo (sumando todos los depósitos).` +
    ` El semáforo de Estado se calcula con este número.`;
  return coberturaEsOptimista(item)
    ? `${base} Sobre el stock físico serían ${item.diasCobertura} días, pero parte ya está vendida.`
    : base;
}
