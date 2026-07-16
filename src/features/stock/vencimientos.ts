import type { EstadoVencimiento, StockItem } from "./types";

/** Estados que ameritan acción: el resto de los lotes del artículo no se muestran en la solapa. */
const ESTADOS_ACCIONABLES: EstadoVencimiento[] = ["Vencido", "Critico", "Alerta"];

/** Una fila de la tabla de Vencimientos: un LOTE, no un artículo. */
export interface FilaVencimiento {
  key: string;
  nombreProducto: string;
  depositoNombre: string;
  serie: string;
  fechaVencimiento: string | null;
  diasParaVencer: number | null;
  stockActual: number;
  valorUsd: number;
  estadoVenc: EstadoVencimiento;
}

/** `diasParaVencer` ascendente (más urgente primero) con los "sin fecha" al final. */
function porUrgencia(a: FilaVencimiento, b: FilaVencimiento): number {
  if (a.diasParaVencer === null) return b.diasParaVencer === null ? 0 : 1;
  if (b.diasParaVencer === null) return -1;
  return a.diasParaVencer - b.diasParaVencer;
}

/**
 * Aplana `items` → `lotes` dejando solo los lotes accionables, ordenados por urgencia. El backend
 * ya filtró los artículos (por su peor lote); acá se muestran únicamente los lotes problemáticos
 * de cada uno.
 */
export function filasDeVencimiento(items: StockItem[]): FilaVencimiento[] {
  return items
    .flatMap((item) =>
      item.lotes
        .filter((lote) => ESTADOS_ACCIONABLES.includes(lote.estadoVenc))
        .map((lote) => ({
          key: `${item.deposito}-${item.codigoArticulo}-${lote.serie}`,
          nombreProducto: item.nombreProducto,
          depositoNombre: item.depositoNombre,
          serie: lote.serie,
          fechaVencimiento: lote.fechaVencimiento,
          diasParaVencer: lote.diasParaVencer,
          stockActual: lote.stockActual,
          // El lote no trae valor: se valoriza con el precio del artículo.
          valorUsd: lote.stockActual * item.precioUsd,
          estadoVenc: lote.estadoVenc,
        })),
    )
    .sort(porUrgencia);
}
