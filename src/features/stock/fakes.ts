import type { StockItem, StockLote } from "./types";

/**
 * Fixtures de Stock para los tests. Viven en un solo lugar a propósito: `StockItem` tiene muchos
 * campos y cada vez que el backend suma uno hay que tocar un único archivo, no cada test.
 */

export function fakeLote(p: Partial<StockLote> & Pick<StockLote, "serie">): StockLote {
  return {
    stockActual: 10,
    fechaIngreso: "2026-01-01",
    fechaVencimiento: "2026-08-01",
    diasParaVencer: 16,
    estadoVenc: "Critico",
    diasEnStock: 100,
    semaforoRotacion: "Amarillo",
    ...p,
  };
}

/** Valores neutros de un artículo × depósito. Los campos derivados se recalculan después. */
const DEFAULTS = {
  depositoNombre: "San Jorge",
  tipoDeposito: "Propio",
  nombreProducto: "PRODUCTO",
  rubro: 200,
  rubroDesc: "HERBICIDAS",
  unidad: "LT",
  stockActual: 100,
  precioUsd: 1,
  valorUsd: 100,
  pedidosCompras: 0,
  ventaFacturados: 0,
  ventaSinFacturar: 0,
  totalDisponible: 100,
  ventaDiaria: 1,
  diasCobertura: 50,
  diasCoberturaDisponible: 50,
  estado: "Ok",
  nivelMinimo: 0,
  bajoMinimo: false,
  estadoVenc: "SinFecha",
  proximoVencimiento: null,
  unidadesVencidas: 0,
  unidadesCriticas: 0,
  valorUsdVencido: 0,
  diasEnStockMax: null,
  diasEnStockPromedio: null,
  semaforoRotacion: "SinDato",
  lotes: [],
} satisfies Omit<StockItem, "deposito" | "codigoArticulo">;

/**
 * Artículo × depósito para los tests.
 *
 * Los dos campos DERIVADOS se calculan, no se copian del default: así un fixture no puede describir
 * una fila que el backend nunca podría emitir (un `totalDisponible: -60` con todo en cero, por
 * ejemplo, que hacía pasar el test de sobreventa sin ejercitar la aritmética del contrato).
 *
 * - `totalDisponible` = `stock + porLlegar − facturado − sinFacturar`, la fórmula del backend: la
 *   sobreventa se arma poniendo `ventaFacturados`, no un número negativo a mano.
 * - `diasCoberturaDisponible` cae en `diasCobertura` (el caso sin nada comprometido).
 *
 * Pasarlos explícitos sigue siendo posible como escape hatch, pero queda como decisión visible.
 */
export function fakeStockItem(
  p: Partial<StockItem> & Pick<StockItem, "deposito" | "codigoArticulo">,
): StockItem {
  const base: StockItem = { ...DEFAULTS, ...p };
  return {
    ...base,
    totalDisponible:
      p.totalDisponible ??
      base.stockActual + base.pedidosCompras - base.ventaFacturados - base.ventaSinFacturar,
    diasCoberturaDisponible:
      p.diasCoberturaDisponible !== undefined ? p.diasCoberturaDisponible : base.diasCobertura,
  };
}
