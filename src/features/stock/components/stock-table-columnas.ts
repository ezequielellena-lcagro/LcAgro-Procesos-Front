import { cn } from "@/lib/utils";

/**
 * Las dos primeras columnas quedan FIJAS al hacer scroll horizontal: la tabla tiene 13 columnas y la
 * app dos sidebars, así que en un notebook de 1366px hay que scrollear para llegar a "Disponible" —
 * y sin esto se perdía de qué artículo era el número. Van con fondo propio (el hover no las pinta).
 */
export const STICKY_CODIGO = "sticky left-0 z-10 w-24";
export const STICKY_PRODUCTO = "sticky left-24 z-10 max-w-[18rem]";

export interface Encabezado {
  label: string;
  className?: string;
  title?: string;
}

/**
 * Encabezados de la tabla de Stock, en orden. `COLUMNAS` sale de acá: los `colSpan` del encabezado
 * de grupo y del detalle de lotes no pueden quedar desincronizados a mano al agregar una columna.
 *
 * Decisión de legibilidad: la disponibilidad son CUATRO números (stock, por llegar, facturado,
 * sin facturar) y la tabla ya venía cargada. Se muestran tres columnas — "Por llegar",
 * "Comprometido" (facturado + sin facturar, con el desglose en el `title`) y "Disponible" — en vez
 * de cuatro: facturado y sin facturar se leen siempre juntos (ambos restan y ninguno se puede
 * vender), mientras que "por llegar" suma y hay que verlo aparte para no confundir un cero de
 * stock con un quiebre. "Disponible" es la columna estrella y va destacada.
 */
export const ENCABEZADOS: Encabezado[] = [
  { label: "Código", className: cn(STICKY_CODIGO, "text-left") },
  { label: "Producto", className: cn(STICKY_PRODUCTO, "text-left") },
  { label: "Rubro", className: "text-left" },
  { label: "Un.", className: "text-left" },
  { label: "Stock", className: "text-right" },
  { label: "Por llegar", className: "text-right", title: "Pedidos de compra pendientes de ingreso." },
  {
    label: "Comprom.",
    className: "text-right",
    title: "Vendido y todavía en el galpón: facturado + sin facturar.",
  },
  {
    label: "Disponible",
    className: "whitespace-nowrap bg-panel text-right text-ink",
    title: "Stock + por llegar − comprometido. En rojo cuando es negativo (sobreventa).",
  },
  { label: "Valor USD", className: "text-right" },
  {
    label: "Días cob.",
    className: "text-right",
    title: "Días que cubre el DISPONIBLE del artículo, no el stock físico.",
  },
  { label: "Mínimo", className: "text-right" },
  { label: "Vence", className: "text-center" },
  { label: "Estado", className: "text-center" },
];

/** Cantidad de columnas de la tabla (para los `colSpan`). */
export const COLUMNAS = ENCABEZADOS.length;
