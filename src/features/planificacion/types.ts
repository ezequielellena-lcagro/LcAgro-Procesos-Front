/**
 * Planificación de Ventas — tipos del feature.
 *
 * ⚠️ PANTALLA MOCKUP: hoy se alimenta de `mock/datos.ts`, sin API. Existe para acordar con
 * el negocio QUÉ muestra la pantalla antes de construirla.
 *
 * La unidad de análisis es el **PRODUCTOR**, no el vendedor. El modelo es participación de
 * bolsillo: del plan de siembra sale cuánto va a gastar el productor en insumos (su mercado),
 * contra eso se pone lo que le vendimos (La Clementina + Bayer), y la diferencia es la
 * oportunidad. La lectura por vendedor es una agregación de esto, no al revés.
 */

export type Cultivo = "soja" | "maiz" | "trigo" | "otro";

/** A = premium, B = clave, C = estándar, D = marginal. Sale del score, no se carga a mano. */
export type Segmento = "A" | "B" | "C" | "D";

/** Por dónde le compra el productor. Es donde se lee la oportunidad de venta cruzada. */
export type Canal = "Solo LC" | "Solo Bayer" | "Ambos";

/**
 * Costo de insumos de un cultivo. `costo USD/ha = qqInsumo × precioTn ÷ 10`.
 * Es lo que convierte hectáreas en dinero: sin esto no hay potencial que calcular.
 */
export interface CostoCultivo {
  cultivo: Cultivo;
  /** Quintales de insumo que consume una hectárea de este cultivo. */
  qqInsumo: number;
  /** Precio estimado del grano, USD por tonelada. */
  precioTn: number;
  /** Rinde esperado, toneladas por hectárea. */
  rindeTnHa: number;
}

export interface Productor {
  id: number;
  nombre: string;
  /** `viajantes.descripcion` de MacroGest. */
  vendedor: string;
  segmento: Segmento;
  canal: Canal;
  /** Plan de siembra: hectáreas por cultivo. Se carga a mano — MacroGest no lo tiene. */
  has: Record<Cultivo, number>;
  /** Cantidad de sub-rubros distintos que compró. Criterio de la matriz. */
  mix: number;
  /** Facturación de La Clementina en la campaña vigente (USD). */
  lc: number;
  /** Facturación de Bayer por nuestro canal en la campaña vigente (USD). */
  bayer: number;
  lcPrev: number;
  bayerPrev: number;
  /** Puntos ya asignados por criterio (en la app los calcula la matriz). */
  pts: { lc: number; bayer: number; mix: number; has: number; canje: number };
}

/** Un criterio de la matriz de segmentación, con su peso. */
export interface CriterioMatriz {
  id: keyof Productor["pts"] | "rentabilidad";
  nombre: string;
  /** Peso en puntos. El score se normaliza sobre la suma de los criterios activos. */
  peso: number;
  /** Etiquetas de las cuatro bandas, de mayor a menor. */
  bandas: [string, string, string, string];
  /**
   * `false` = definido en la matriz del cliente pero **no calculado** en el Excel de hoy.
   * La app sí puede calcularlo: la rentabilidad por línea ya sale del módulo de Comisiones.
   */
  activo: boolean;
}

/**
 * Objetivo de campaña. El cliente NO carga un número por vendedor: carga un porcentaje de
 * crecimiento por línea y el sistema lo baja a cada uno sobre su cierre anterior.
 */
export interface ObjetivoLinea {
  id: string;
  nombre: string;
  unidad: string;
  /** Crecimiento pedido sobre la campaña anterior (0,13 = +13 %). */
  crecimiento: number;
  /** Sobre qué facturación se aplica. */
  base: "lc" | "bayer" | "total";
}

/** Productor con todo lo derivado ya calculado. */
export interface ProductorCalculado extends Productor {
  hasTotal: number;
  /** Cuánto va a gastar en insumos esta campaña, según su plan de siembra. */
  mercado: number;
  total: number;
  totalPrev: number;
  /** (LC + Bayer) ÷ mercado. La participación de bolsillo. */
  participacion: number;
  /** Mercado − vendido: lo que se le podría vender y no se le vende. */
  oportunidad: number;
  score: number;
  segmentoCalculado: Segmento;
  variacion: number | null;
}
