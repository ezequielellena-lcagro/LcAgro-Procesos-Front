/** Formato de campaña entre la config (`campania_minima` = "20232024") y la posición ("2023-2024"). */

/** "20232024" → "2023-2024". Devuelve null si no son 8 dígitos de años consecutivos. */
export function desdeConfig(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const v = valor.trim().replace("-", "");
  if (!/^\d{8}$/.test(v)) return null;
  const a1 = Number(v.slice(0, 4));
  const a2 = Number(v.slice(4));
  if (a2 !== a1 + 1) return null;
  return `${v.slice(0, 4)}-${v.slice(4)}`;
}

/** "2023-2024" (o "20232024") → "20232024" para guardar en config. Null si es inválida. */
export function haciaConfig(campania: string): string | null {
  const v = campania.trim().replace("-", "");
  if (!/^\d{8}$/.test(v)) return null;
  const a1 = Number(v.slice(0, 4));
  const a2 = Number(v.slice(4));
  if (a2 !== a1 + 1) return null;
  return v;
}
