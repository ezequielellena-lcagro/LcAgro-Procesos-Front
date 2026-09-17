/** Acepta decimales es-AR y de teclado numérico; null conserva la diferencia entre vacío y cero. */
export function parsearDecimalEsAr(texto: string): number | null {
  const valor = texto.trim();
  if (!valor) return null;

  const conSeparadorDeMiles = /^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(valor);
  const conComaDecimal = /^[+-]?\d+(?:,\d+)?$/.test(valor);
  const conPuntoDecimal = /^[+-]?\d+\.\d+$/.test(valor);
  if (!conSeparadorDeMiles && !conComaDecimal && !conPuntoDecimal) return NaN;

  const normalizado = conSeparadorDeMiles
    ? valor.replaceAll(".", "").replace(",", ".")
    : valor.replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : NaN;
}
