/**
 * Los tres calendarios del proceso, y la matemática de "cuánto va de la campaña".
 *
 * La distinción que sostiene toda la pantalla: **transcurrido por días** no es lo mismo que
 * **transcurrido por venta esperada**. La venta de insumos se concentra entre agosto y diciembre
 * (siembra de gruesa) y el grano entra con la cosecha (marzo a junio). Proyectar dividiendo por
 * días transcurridos miente en los extremos de la campaña, y miente mucho.
 */
import type { Calendario, ContextoCampania, LineaCalendario } from "../types";

/** Peso de cada mes dentro de la campaña de insumos (abr–mar), desde abril. */
const CURVA_INSUMOS = [0.04, 0.07, 0.08, 0.06, 0.09, 0.13, 0.16, 0.13, 0.09, 0.06, 0.05, 0.04];
/** Peso de cada mes dentro de la campaña de granos (jul–jun), desde julio. */
const CURVA_GRANOS = [0.03, 0.03, 0.02, 0.02, 0.03, 0.1, 0.12, 0.05, 0.08, 0.2, 0.2, 0.12];

export const CALENDARIOS: Record<LineaCalendario, Calendario> = {
  insumos: {
    linea: "insumos",
    nombre: "Insumos · La Clementina",
    rango: "1-abr a 31-mar",
    mesInicio: 4,
    fuente: "MacroGest · ventas1",
    curva: CURVA_INSUMOS,
    esMacroGest: true,
  },
  granos: {
    linea: "granos",
    nombre: "Granos originados · acopio",
    rango: "1-jul a 30-jun",
    mesInicio: 7,
    fuente: "MacroGest · cuenta_corriente_sincro (CEG)",
    curva: CURVA_GRANOS,
    esMacroGest: true,
  },
  bayer: {
    linea: "bayer",
    nombre: "Ventas agro Bayer",
    rango: "1-ene a 31-dic",
    mesInicio: 1,
    fuente: "Planilla Bayer/Monsanto · no es MacroGest",
    curva: null,
    esMacroGest: false,
  },
};

export const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Fecha en que arrancó la campaña vigente para un mes de inicio dado. */
export function inicioCampania(mesInicio: number, hoy: Date): Date {
  const anio = hoy.getMonth() + 1 >= mesInicio ? hoy.getFullYear() : hoy.getFullYear() - 1;
  return new Date(anio, mesInicio - 1, 1);
}

/** "2026/2027" para campañas de dos años; "2026" para el año calendario. */
export function claveCampania(mesInicio: number, hoy: Date): string {
  if (mesInicio === 1) return String(hoy.getFullYear());
  const a = inicioCampania(mesInicio, hoy).getFullYear();
  return `${a}/${a + 1}`;
}

/** Clave de la campaña anterior a la vigente. */
export function claveCampaniaPrevia(mesInicio: number, hoy: Date): string {
  if (mesInicio === 1) return String(hoy.getFullYear() - 1);
  const a = inicioCampania(mesInicio, hoy).getFullYear();
  return `${a - 1}/${a}`;
}

/** Fracción transcurrida contando días. Es lo que hace un run-rate ingenuo. */
export function fraccionLineal(mesInicio: number, hoy: Date): number {
  const ini = inicioCampania(mesInicio, hoy);
  const fin = new Date(ini.getFullYear() + 1, ini.getMonth(), 1);
  return (hoy.getTime() - ini.getTime()) / (fin.getTime() - ini.getTime());
}

/**
 * Fracción transcurrida contando la VENTA esperada acumulada hasta hoy.
 * Es el número contra el que hay que medir el avance de un vendedor.
 */
export function fraccionEstacional(mesInicio: number, hoy: Date, curva: number[]): number {
  const ini = inicioCampania(mesInicio, hoy);
  const mesesEnteros = (hoy.getFullYear() - ini.getFullYear()) * 12 + (hoy.getMonth() - ini.getMonth());
  const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();

  let acum = 0;
  for (let i = 0; i < mesesEnteros; i++) acum += curva[i] ?? 0;
  acum += (curva[mesesEnteros] ?? 0) * ((hoy.getDate() - 1) / diasDelMes);
  return acum;
}

/** Contexto de las tres campañas a una fecha de corte. */
export function contextoCampanias(hoy: Date): Record<LineaCalendario, ContextoCampania> {
  const armar = (cal: Calendario): ContextoCampania => {
    const lineal = fraccionLineal(cal.mesInicio, hoy);
    return {
      clave: claveCampania(cal.mesInicio, hoy),
      lineal,
      estacional: cal.curva ? fraccionEstacional(cal.mesInicio, hoy, cal.curva) : lineal,
    };
  };
  return {
    insumos: armar(CALENDARIOS.insumos),
    granos: armar(CALENDARIOS.granos),
    bayer: armar(CALENDARIOS.bayer),
  };
}

/**
 * Reparte un acumulado real entre los meses ya transcurridos, siguiendo la curva.
 * Solo para el gráfico del detalle: da una forma verosímil sin inventar un dato por mes.
 */
export function serieMensual(
  realAcumulado: number,
  objetivo: number,
  curva: number[],
  mesInicio: number,
  hoy: Date,
  semilla: number,
) {
  const ini = inicioCampania(mesInicio, hoy);
  const mesesEnteros = (hoy.getFullYear() - ini.getFullYear()) * 12 + (hoy.getMonth() - ini.getMonth());
  const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();

  // Variación estable por vendedor: el mismo vendedor da siempre el mismo gráfico.
  const jitter = (m: number) => {
    const x = Math.sin(semilla * 12.9898 + m * 78.233) * 43758.5453;
    return 0.82 + 0.36 * (x - Math.floor(x));
  };

  const pesos = curva.map((c, m) => {
    if (m < mesesEnteros) return c * jitter(m);
    if (m === mesesEnteros) return c * ((hoy.getDate() - 1) / diasDelMes) * jitter(m);
    return 0;
  });
  const suma = pesos.reduce((a, b) => a + b, 0);

  return curva.map((c, m) => ({
    mes: MESES_CORTOS[(mesInicio - 1 + m) % 12],
    objetivo: objetivo * c,
    real: suma > 0 ? (realAcumulado * pesos[m]) / suma : 0,
    esActual: m === mesesEnteros,
  }));
}
