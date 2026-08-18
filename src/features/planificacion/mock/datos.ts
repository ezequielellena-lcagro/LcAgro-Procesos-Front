/**
 * ⚠️ DATOS INVENTADOS — no salen de MacroGest ni de ninguna planilla real.
 *
 * Existen para poder mostrarle la pantalla al cliente y acordar QUÉ tiene que mostrar,
 * antes de construir el backend. Cuando exista el endpoint, este archivo se borra.
 *
 * Lo único que NO es inventado son los vendedores: la lista sale de cruzar las dos
 * decisiones que ya están tomadas en `appsettings.json` del backend:
 *
 *   Cuentas:VendedoresHabilitados          [2,3,5,8,10,16,18,20,22,23,26,36,37,38,39]
 *   − VolumenAcopiado:VendedoresExcluidos  [3 Trucco, 10 Galeotti, 20 ASL]
 */
import type { BayerSinCruzar, Vendedor } from "../types";

/** Fecha de corte fija: el mockup se ve siempre igual, no cambia según el día que se abra. */
export const FECHA_CORTE = new Date(2026, 7, 17); // 17-ago-2026

export const VENDEDORES: Vendedor[] = [
  {
    cod: 5, nombre: "MASSETTI FERNANDO", penetracion: 0.78,
    objetivoInsumos: 690000, realInsumos: 244800, previoInsumos: 588400,
    notaInsumos: "Suma la zona norte que dejó Hilaert.", estadoInsumos: "acordado",
    objetivoGranos: 18000, realGranos: 1180, previoGranos: 15240, notaGranos: "", estadoGranos: "acordado",
    bayer: 148300, bayerPrevio: 212900, siembra: 18400,
  },
  {
    cod: 2, nombre: "LC AGRO", penetracion: 0.85,
    objetivoInsumos: 583000, realInsumos: 201700, previoInsumos: 512400,
    notaInsumos: "", estadoInsumos: "acordado",
    objetivoGranos: 15500, realGranos: 1340, previoGranos: 13480, notaGranos: "", estadoGranos: "acordado",
    bayer: 112500, bayerPrevio: 98600, siembra: 14200, dudoso: true,
  },
  {
    cod: 16, nombre: "FARIAS, EDUARDO", penetracion: 0.61,
    objetivoInsumos: 512000, realInsumos: 118000, previoInsumos: 425300,
    notaInsumos: "Pendiente de reunión — cartera con mucho dormido.", estadoInsumos: "borrador",
    objetivoGranos: 13500, realGranos: 520, previoGranos: 11350, notaGranos: "", estadoGranos: "acordado",
    bayer: 91600, bayerPrevio: 84300, siembra: 12100,
  },
  {
    cod: 8, nombre: "MARTINEZ, NAHUEL", penetracion: 0.74,
    objetivoInsumos: 460000, realInsumos: 188900, previoInsumos: 388600,
    notaInsumos: "", estadoInsumos: "acordado",
    objetivoGranos: 12000, realGranos: 890, previoGranos: 10120, notaGranos: "", estadoGranos: "acordado",
    bayer: 74200, bayerPrevio: 69900, siembra: 9800,
  },
  {
    cod: 23, nombre: "GUERRERO RAMIRO", penetracion: 0.56,
    objetivoInsumos: 442000, realInsumos: 116800, previoInsumos: 361200,
    notaInsumos: "", estadoInsumos: "borrador",
    objetivoGranos: 11200, realGranos: 410, previoGranos: 9280, notaGranos: "", estadoGranos: "acordado",
    bayer: 68400, bayerPrevio: 71200, siembra: null,
  },
  {
    cod: 18, nombre: "ROSSO HORACIO", penetracion: 0.69,
    objetivoInsumos: 396000, realInsumos: 167300, previoInsumos: 334700,
    notaInsumos: "", estadoInsumos: "acordado",
    objetivoGranos: 10300, realGranos: 1050, previoGranos: 8640, notaGranos: "", estadoGranos: "acordado",
    bayer: 55800, bayerPrevio: 49100, siembra: 10300,
  },
  {
    cod: 22, nombre: "FERREYRA MARIANO", penetracion: 0.81,
    objetivoInsumos: 345000, realInsumos: 153600, previoInsumos: 298500,
    notaInsumos: "Cartera muy penetrada, poco lugar para crecer.", estadoInsumos: "acordado",
    objetivoGranos: 8700, realGranos: 720, previoGranos: 7510, notaGranos: "", estadoGranos: "acordado",
    bayer: 47600, bayerPrevio: 52300, siembra: 6900,
  },
  {
    // Objetivo POR DEBAJO del cierre anterior: dispara el aviso rojo en la carga.
    cod: 26, nombre: "ELADIO CERINO", penetracion: 0.64,
    objetivoInsumos: 268000, realInsumos: 134200, previoInsumos: 276900,
    notaInsumos: "", estadoInsumos: "acordado",
    objetivoGranos: 8300, realGranos: 640, previoGranos: 6940, notaGranos: "", estadoGranos: "acordado",
    bayer: 41300, bayerPrevio: 36800, siembra: 7600,
  },
  {
    cod: 38, nombre: "GUILLERMO BRAVIN", penetracion: 0.47,
    objetivoInsumos: 302000, realInsumos: 66400, previoInsumos: 241800,
    notaInsumos: "", estadoInsumos: "borrador",
    objetivoGranos: 7600, realGranos: 210, previoGranos: 6120, notaGranos: "", estadoGranos: "acordado",
    bayer: 24700, bayerPrevio: 31500, siembra: 5400,
  },
  {
    cod: 37, nombre: "GERMAN DEMARCHI", penetracion: 0.58,
    objetivoInsumos: 251000, realInsumos: 113900, previoInsumos: 205600,
    notaInsumos: "Arrancó en octubre, campaña anterior parcial.", estadoInsumos: "acordado",
    objetivoGranos: 7300, realGranos: 590, previoGranos: 5980, notaGranos: "", estadoGranos: "acordado",
    bayer: 29400, bayerPrevio: 22800, siembra: null,
  },
  {
    cod: 36, nombre: "Q + AGRO SRL", penetracion: 0.72,
    objetivoInsumos: 220000, realInsumos: 58900, previoInsumos: 187300,
    notaInsumos: "", estadoInsumos: "acordado",
    objetivoGranos: 5000, realGranos: 280, previoGranos: 4210, notaGranos: "", estadoGranos: "borrador",
    bayer: 18900, bayerPrevio: 16400, siembra: null, dudoso: true,
  },
  {
    // Objetivo copiado casi tal cual del año anterior: dispara el aviso ámbar.
    cod: 39, nombre: "SAN FRANCISCO", penetracion: 0.69,
    objetivoInsumos: 165000, realInsumos: 71300, previoInsumos: 163500,
    notaInsumos: "", estadoInsumos: "acordado",
    objetivoGranos: 4600, realGranos: 260, previoGranos: 3890, notaGranos: "", estadoGranos: "borrador",
    bayer: 21300, bayerPrevio: 19700, siembra: 4100, dudoso: true,
  },

  // Excluidos por decisión ya documentada en el backend. Siguen facturando y suman al total
  // de la empresa, pero no llevan objetivo ni entran en el seguimiento comercial.
  {
    cod: 3, nombre: "TRUCCO JUAN JOSE", penetracion: 0,
    objetivoInsumos: 0, realInsumos: 428600, previoInsumos: 496200, notaInsumos: "", estadoInsumos: "borrador",
    objetivoGranos: 0, realGranos: 0, previoGranos: 0, notaGranos: "", estadoGranos: "borrador",
    bayer: 0, bayerPrevio: 0, siembra: null, excluido: "sociedades vinculadas",
  },
  {
    cod: 10, nombre: "GALEOTTI JUAN PABLO", penetracion: 0,
    objetivoInsumos: 0, realInsumos: 87200, previoInsumos: 214800, notaInsumos: "", estadoInsumos: "borrador",
    objetivoGranos: 0, realGranos: 0, previoGranos: 0, notaGranos: "", estadoGranos: "borrador",
    bayer: 0, bayerPrevio: 0, siembra: null, excluido: "ya no trabaja",
  },
  {
    cod: 20, nombre: "ASL", penetracion: 0,
    objetivoInsumos: 0, realInsumos: 63400, previoInsumos: 151700, notaInsumos: "", estadoInsumos: "borrador",
    objetivoGranos: 0, realGranos: 0, previoGranos: 0, notaGranos: "", estadoGranos: "borrador",
    bayer: 0, bayerPrevio: 0, siembra: null, excluido: "canal discontinuado",
  },
];

/**
 * Filas de la planilla de Bayer que no cruzaron con `viajantes.descripcion`.
 * El cruce es por NOMBRE de texto libre porque esa planilla no trae el código de vendedor:
 * si el nombre no coincide letra por letra, la facturación no se imputa y nadie se entera.
 */
export const BAYER_SIN_CRUZAR: BayerSinCruzar[] = [
  { nombre: "F. Massetti", monto: 18700 },
  { nombre: "Galeotti, Juan P.", monto: 12400 },
  { nombre: "N. Martinez", monto: 7300 },
];
