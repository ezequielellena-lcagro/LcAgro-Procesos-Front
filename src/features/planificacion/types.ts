/**
 * Planificación de Ventas por Vendedor — tipos del feature.
 *
 * ⚠️ PANTALLA MOCKUP: hoy se alimenta de datos inventados (`mock/datos.ts`), sin API.
 * Existe para acordar con el negocio QUÉ muestra la pantalla antes de construirla.
 * Cuando exista el endpoint, estos tipos son el contrato a espejar.
 */

/** Cada línea de negocio corre con su propio almanaque. Nunca se suman entre sí. */
export type LineaCalendario = "insumos" | "granos" | "bayer";

/** Línea que admite objetivo comercial (Bayer y plan de siembra son informativos). */
export type LineaObjetivo = "insumos" | "granos";

/** Un objetivo se propone (borrador) y recién después se acuerda con el gerente comercial. */
export type EstadoObjetivo = "acordado" | "borrador";

export interface Calendario {
  linea: LineaCalendario;
  nombre: string;
  rango: string;
  /** Mes en que arranca la campaña (1–12). 1 = año calendario. */
  mesInicio: number;
  fuente: string;
  /** Peso de cada mes dentro de la campaña, desde `mesInicio`. Suma 1. */
  curva: number[] | null;
  esMacroGest: boolean;
}

export interface ContextoCampania {
  clave: string;
  /** Fracción transcurrida contando DÍAS. */
  lineal: number;
  /** Fracción transcurrida contando VENTA esperada según la curva estacional. */
  estacional: number;
}

export interface Vendedor {
  /** `viajantes.codigo` de MacroGest. */
  cod: number;
  /** `viajantes.descripcion`. */
  nombre: string;
  /** Penetración de cartera: qué proporción de sus productores le operó. */
  penetracion: number;

  objetivoInsumos: number;
  realInsumos: number;
  previoInsumos: number;
  notaInsumos: string;
  estadoInsumos: EstadoObjetivo;

  objetivoGranos: number;
  realGranos: number;
  previoGranos: number;
  notaGranos: string;
  estadoGranos: EstadoObjetivo;

  /** Facturación Bayer del año calendario en curso y del anterior. Informativa. */
  bayer: number;
  bayerPrevio: number;

  /** Toneladas potenciales del plan de siembra. `null` = no se cargó. */
  siembra: number | null;

  /** Motivo por el que no se le fija objetivo. Espeja `VolumenAcopiado:VendedoresExcluidos`. */
  excluido?: string;
  /** Falta confirmar con el cliente si es una persona con cartera o una boca/entidad. */
  dudoso?: boolean;
}

/** Fila de la planilla de Bayer cuyo nombre no cruzó con `viajantes.descripcion`. */
export interface BayerSinCruzar {
  nombre: string;
  monto: number;
}

/** Aviso de validación sobre un objetivo cargado. */
export interface AvisoObjetivo {
  nivel: "error" | "warn";
  texto: string;
}
