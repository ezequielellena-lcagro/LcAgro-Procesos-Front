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

/** Peso de cada mes dentro de la campaña, desde abril. La venta se concentra ago–dic. */
export const CURVA = [0.04, 0.07, 0.08, 0.06, 0.09, 0.13, 0.16, 0.13, 0.09, 0.06, 0.05, 0.04];

export function inicioCampania(hoy: Date): Date {
  const anio = hoy.getMonth() + 1 >= MES_INICIO ? hoy.getFullYear() : hoy.getFullYear() - 1;
  return new Date(anio, MES_INICIO - 1, 1);
}

/** "2025/2026" para la campaña vigente a esa fecha. */
export function claveCampania(hoy: Date, atras = 0): string {
  const a = inicioCampania(hoy).getFullYear() - atras;
  return `${a}/${a + 1}`;
}

/** Fracción transcurrida contando días. Es lo que hace un run-rate ingenuo. */
export function fraccionLineal(hoy: Date): number {
  const ini = inicioCampania(hoy);
  const fin = new Date(ini.getFullYear() + 1, ini.getMonth(), 1);
  return (hoy.getTime() - ini.getTime()) / (fin.getTime() - ini.getTime());
}

/**
 * Fracción transcurrida contando la VENTA esperada, no los días. Es el número contra el
 * que hay que medir el avance: en agosto nadie lleva el 38 % de la campaña vendido.
 */
export function fraccionEstacional(hoy: Date): number {
  const ini = inicioCampania(hoy);
  const meses = (hoy.getFullYear() - ini.getFullYear()) * 12 + (hoy.getMonth() - ini.getMonth());
  const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();

  let acum = 0;
  for (let i = 0; i < meses; i++) acum += CURVA[i] ?? 0;
  return acum + (CURVA[meses] ?? 0) * ((hoy.getDate() - 1) / diasDelMes);
}
