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
