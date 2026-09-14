/**
 * Espejo de `ComprobanteFormato.Normalizar` (ADR-08). Pedido de venta y remito se tipean a mano,
 * con formato `NN-NNNNN`, y se guardan solo en esta app (en Fase 1 no se validan contra MacroGest).
 */
const PATRON = /^(\d{1,2})-(\d{1,5})$/;

/** "6-123" → "06-00123". Vacío/null es válido como "sin comprobante" (el campo es opcional acá). */
export function normalizarComprobante(valor: string | null | undefined): string | null {
  const v = valor?.trim();
  if (!v) return null;
  const m = PATRON.exec(v);
  if (!m) return null;
  const [, prefijo, sufijo] = m;
  return `${prefijo.padStart(2, "0")}-${sufijo.padStart(5, "0")}`;
}
