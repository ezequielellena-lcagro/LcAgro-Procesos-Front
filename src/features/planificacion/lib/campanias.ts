/**
 * La campaña comercial y cuánto va de ella.
 *
 * El cliente lo cerró en la reunión del 2026-08-18: **una sola campaña, 1-abr a 31-mar, por
 * rango de fechas y para todo** — insumos, granos y Bayer.
 *
 *   "Siempre usamos un período que es del 1 de abril al 31 de marzo, en todo lo que es
 *    MacroGest. Tanto los granos como la facturación de insumos tienen ese período,
 *    independientemente del tipo de grano."
 *
 * Y sobre el campo `campana` de MacroGest, que la versión anterior de esta pantalla usaba:
 *
 *   "No le damos tanta bola a lo que diga el campo campaña... Yo no me pongo a mirar:
 *    es cuánto entregó de tal fecha a tal fecha."
 */

/** Mes en que arranca la campaña comercial. */
export const MES_INICIO = 4;

export function inicioCampania(hoy: Date): Date {
  const anio = hoy.getMonth() + 1 >= MES_INICIO ? hoy.getFullYear() : hoy.getFullYear() - 1;
  return new Date(anio, MES_INICIO - 1, 1);
}

/** "2025-2026" para la campaña vigente a esa fecha (formato canónico de la API). */
export function claveCampania(hoy: Date, atras = 0): string {
  const a = inicioCampania(hoy).getFullYear() - atras;
  return `${a}-${a + 1}`;
}

/** Campaña vigente y las anteriores, de más nueva a más vieja. */
export function ultimasCampanias(hoy: Date, cantidad = 3): string[] {
  return Array.from({ length: Math.max(0, cantidad) }, (_, atras) => claveCampania(hoy, atras));
}
