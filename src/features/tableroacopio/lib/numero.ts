/**
 * Lee un número tipeado en es-AR. "" = null (vacío); basura = undefined (inválido). Coma decimal
 * ("1,5"); el punto vale como separador de miles sólo en grupos de tres ("100.000"), si no es decimal ("1.5").
 */
export function parsearNumero(
  texto: string,
  { negativos = false } = {},
): number | null | undefined {
  const t = texto.trim();
  if (t === "") return null;
  const normal = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : /^-?\d{1,3}(\.\d{3})+$/.test(t)
      ? t.replace(/\./g, "")
      : t;
  const n = Number(normal);
  if (Number.isNaN(n) || (!negativos && n < 0)) return undefined;
  return n;
}

/** 1.5 → "1,5"; null → "". */
export const aTexto = (n: number | null | undefined) =>
  n == null ? "" : n.toString().replace(".", ",");
