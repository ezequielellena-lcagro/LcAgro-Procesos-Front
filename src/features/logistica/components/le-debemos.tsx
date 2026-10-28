import { fecha, hoy } from "../format";
import type { Pedido } from "../types";

/** Días entre una fecha ISO y hoy: positivo = ya pasó, negativo = falta. */
function diasDesde(desde: string): number {
  return Math.round(
    (Date.parse(`${hoy()}T12:00:00Z`) - Date.parse(`${desde.slice(0, 10)}T12:00:00Z`)) / 86400000,
  );
}

/**
 * Hace cuánto se le debe cereal al productor: desde el inicio del período de entrega de la
 * preventa del pedido. Semáforo con los cortes del mockup del área usuaria (2026-10-20): rojo
 * arriba de 180 días, naranja entre 90 y 180.
 */
export function LeDebemos({ pedido }: { pedido: Pedido }) {
  // Sin preventa no se le debe nada: la columna de al lado ya lo dice.
  if (!pedido.preventa) return <span className="text-ink-soft">—</span>;
  if (!pedido.preventaEntregaDesde) return <span className="text-ink-soft">Sin dato</span>;
  const d = diasDesde(pedido.preventaEntregaDesde);
  if (d <= 0)
    return (
      <span className="whitespace-nowrap text-ink-soft">
        Entrega desde {fecha(pedido.preventaEntregaDesde)}
      </span>
    );
  const tono = d > 180 ? "text-rojo" : d >= 90 ? "text-clementina-deep" : "text-ink";
  return (
    <span className={`whitespace-nowrap font-medium ${tono}`}>
      {d >= 90 ? "● " : ""}
      {d} {d === 1 ? "día" : "días"}
    </span>
  );
}
