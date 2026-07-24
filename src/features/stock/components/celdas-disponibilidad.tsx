import { cn } from "@/lib/utils";
import { numero } from "@/shared/format/format";
import {
  coberturaEsOptimista,
  comprometido,
  detalleCobertura,
  detalleComprometido,
  detalleDisponible,
  haySobreventa,
} from "../disponibilidad";
import type { StockItem } from "../types";

/** Los ceros se apagan para que la vista se lea por lo que SÍ tiene movimiento. */
function cantidadCls(valor: number): string {
  return valor === 0 ? "text-ink-soft" : "text-ink";
}

/** Mercadería comprada que todavía no llegó: suma al disponible. */
export function PorLlegarCelda({ item }: { item: StockItem }) {
  return (
    <span
      className={cn("tabular", cantidadCls(item.pedidosCompras))}
      title="Pedidos de compra pendientes de ingreso (suman al disponible)."
    >
      {numero(item.pedidosCompras)}
    </span>
  );
}

/**
 * Facturado + sin facturar en una sola columna: el desglose va en el `title`.
 * Son dos números que se leen siempre juntos y la tabla ya tiene muchas columnas.
 */
export function ComprometidoCelda({ item }: { item: StockItem }) {
  const total = comprometido(item);
  return (
    <span className={cn("tabular", cantidadCls(total))} title={detalleComprometido(item)}>
      {numero(total)}
    </span>
  );
}

/**
 * La columna estrella: lo que realmente se puede vender hoy.
 * En rojo cuando es negativa, porque eso es sobreventa (ya se vendió más de lo que hay).
 */
export function DisponibleCelda({ item }: { item: StockItem }) {
  const sobreventa = haySobreventa(item);
  return (
    <span
      data-testid={`disponible-${item.deposito}-${item.codigoArticulo}`}
      className={cn(
        "inline-flex rounded-md px-1.5 py-0.5 tabular font-semibold",
        sobreventa ? "bg-rojo-bg text-rojo" : "text-ink",
      )}
      title={detalleDisponible(item)}
    >
      {numero(item.totalDisponible)}
    </span>
  );
}

/**
 * Días de cobertura sobre el DISPONIBLE, que es con lo que el backend clasifica el Estado.
 * Cuando el físico prometía más días (porque parte del stock ya está vendido) se marca con un
 * asterisco y el `title` cuenta las dos cifras: si no, la fila mostraría dos señales contradictorias.
 */
export function CoberturaCelda({ item }: { item: StockItem }) {
  const optimista = coberturaEsOptimista(item);
  return (
    <span
      data-testid={`cobertura-${item.deposito}-${item.codigoArticulo}`}
      className={cn("tabular", optimista && "text-ink-soft")}
      title={detalleCobertura(item)}
    >
      {item.diasCoberturaDisponible ?? "—"}
      {optimista && <span aria-hidden="true">*</span>}
    </span>
  );
}
