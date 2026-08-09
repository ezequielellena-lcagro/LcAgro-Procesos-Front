/** Campaña vigente derivada del año en curso: en 2026 → "2025-2026". */
export function campaniaVigente(hoy: Date = new Date()): string {
  const anio = hoy.getFullYear();
  return `${anio - 1}-${anio}`;
}

/**
 * Campaña a mostrar: la elegida por el usuario; si no eligió, la vigente cuando está disponible, y
 * si no, la más reciente de la lista. Derivado — no hace falta estado ni efecto para sincronizarlo.
 */
export function resolverCampania(
  elegida: string | undefined,
  disponibles: string[] | undefined,
  hoy?: Date,
): string | undefined {
  if (elegida) return elegida;
  const vigente = campaniaVigente(hoy);
  return disponibles?.includes(vigente) ? vigente : disponibles?.[0];
}
