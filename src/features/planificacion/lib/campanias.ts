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
export const ZONA_HORARIA_PLANIFICACION = "America/Argentina/Buenos_Aires";

const partesFecha = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA_PLANIFICACION,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const fechaHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA_HORARIA_PLANIFICACION,
  dateStyle: "short",
  timeStyle: "short",
  hourCycle: "h23",
});

function anioYMesEnBuenosAires(instante: Date): { anio: number; mes: number } {
  const valores = Object.fromEntries(
    partesFecha
      .formatToParts(instante)
      .filter((parte) => parte.type !== "literal")
      .map((parte) => [parte.type, parte.value]),
  );
  return { anio: Number(valores.year), mes: Number(valores.month) };
}

export function inicioCampania(hoy: Date): Date {
  const { anio, mes } = anioYMesEnBuenosAires(hoy);
  const anioInicio = mes >= MES_INICIO ? anio : anio - 1;
  return new Date(Date.UTC(anioInicio, MES_INICIO - 1, 1, 3));
}

/** "2025-2026" para la campaña vigente a esa fecha (formato canónico de la API). */
export function claveCampania(hoy: Date, atras = 0): string {
  const a = inicioCampania(hoy).getUTCFullYear() - atras;
  return `${a}-${a + 1}`;
}

/** Campaña vigente y las anteriores, de más nueva a más vieja. */
export function ultimasCampanias(hoy: Date, cantidad = 3): string[] {
  return Array.from({ length: Math.max(0, cantidad) }, (_, atras) => claveCampania(hoy, atras));
}

/** Fecha y hora de un corte, siempre vistas en la zona comercial de La Clementina. */
export function fechaHoraPlanificacion(instante: string | Date): string {
  return fechaHora.format(typeof instante === "string" ? new Date(instante) : instante);
}
