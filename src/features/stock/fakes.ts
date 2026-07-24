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

/**
 * Artículo × depósito con valores neutros. `totalDisponible` NO se deriva: los tests que
 * ejercitan la sobreventa necesitan poder ponerlo negativo a mano, igual que lo manda el backend.
 */
export function fakeStockItem(
  p: Partial<StockItem> & Pick<StockItem, "deposito" | "codigoArticulo">,
): StockItem {
  return {
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
    ...p,
  };
}
