/**
 * Matriz de segmentación, potencial de mercado y derivados del productor.
 *
 * La matriz sale de la hoja `Matriz Productor` del Excel del cliente. Dos cosas que el
 * análisis del archivo dejó a la vista y que la app corrige:
 *
 *  1. La matriz define **seis** criterios (100 pts) pero el Excel solo calcula **cinco**:
 *     "Rentabilidad LC" (20 pts) está definido y nunca se computa, así que el score real
 *     se normaliza sobre 80. La app sí puede calcularlo — la rentabilidad por línea ya sale
 *     del módulo de Comisiones — por eso el criterio existe acá con `activo` conmutable.
 *  2. El cliente pidió explícitamente que la matriz sea configurable ("eso también lo podés
 *     configurar"), así que los pesos son estado de la pantalla, no constantes.
 */
import type {
  CostoCultivo,
  CriterioMatriz,
  Cultivo,
  Productor,
  ProductorCalculado,
  Segmento,
} from "../types";

/** Los seis criterios de la hoja `Matriz Productor`, con sus pesos y bandas originales. */
export const CRITERIOS: CriterioMatriz[] = [
  { id: "lc", nombre: "Facturación LC", peso: 25, bandas: ["> 100 K", "99–50 K", "49–20 K", "< 20 K"], activo: true },
  { id: "rentabilidad", nombre: "Rentabilidad LC", peso: 20, bandas: ["> 15 %", "15–10 %", "10–8 %", "< 8 %"], activo: false },
  { id: "bayer", nombre: "Facturación Bayer", peso: 20, bandas: ["> 100 K", "99–50 K", "49–20 K", "< 20 K"], activo: true },
  { id: "mix", nombre: "Mix de sub-rubros", peso: 15, bandas: ["4 o más", "3", "2", "1"], activo: true },
  { id: "has", nombre: "Has trabajadas", peso: 10, bandas: ["> 1000", "999–500", "499–200", "< 200"], activo: true },
  { id: "canje", nombre: "Canje cerealero", peso: 10, bandas: ["> 1000 tn", "999–500", "499–100", "< 100"], activo: true },
];

/** Cortes de segmento, tal como los define el cliente. */
export const CORTES: { segmento: Segmento; desde: number; etiqueta: string }[] = [
  { segmento: "A", desde: 75, etiqueta: "Premium" },
  { segmento: "B", desde: 50, etiqueta: "Clave" },
  { segmento: "C", desde: 20, etiqueta: "Estándar" },
  { segmento: "D", desde: 0, etiqueta: "Marginal" },
];

export const CULTIVOS: Cultivo[] = ["soja", "maiz", "trigo", "otro"];

export const NOMBRE_CULTIVO: Record<Cultivo, string> = {
  soja: "Soja",
  maiz: "Maíz",
  trigo: "Trigo",
  otro: "Otro",
};

/** Costo de insumos por hectárea de un cultivo: quintales × precio del grano ÷ 10. */
export const costoPorHa = (c: CostoCultivo) => (c.qqInsumo * c.precioTn) / 10;

/** Cuánto va a gastar el productor en insumos esta campaña, según su plan de siembra. */
export function mercadoDe(p: Productor, costos: Record<Cultivo, CostoCultivo>): number {
  return CULTIVOS.reduce((total, c) => total + (p.has[c] ?? 0) * costoPorHa(costos[c]), 0);
}

export const hasTotalDe = (p: Productor) => CULTIVOS.reduce((t, c) => t + (p.has[c] ?? 0), 0);

/**
 * Score 0–100. Suma los puntos de los criterios activos y normaliza sobre el peso disponible:
 * apagar un criterio no debe hundir a todos los productores, solo cambiar el reparto.
 */
export function scoreDe(p: Productor, criterios: CriterioMatriz[]): number {
  const activos = criterios.filter((c) => c.activo);
  const pesoTotal = activos.reduce((t, c) => t + c.peso, 0);
  if (pesoTotal === 0) return 0;

  const obtenidos = activos.reduce((t, c) => {
    if (c.id === "rentabilidad") {
      // Todavía no llega del backend. Se aproxima con el mix, que es el mejor proxy
      // disponible en el mockup; en la app real sale de la rentabilidad por línea.
      return t + Math.min(p.mix / 4, 1) * c.peso;
    }
    const base = CRITERIOS.find((x) => x.id === c.id)?.peso ?? c.peso;
    const proporcion = base > 0 ? p.pts[c.id] / base : 0;
    return t + proporcion * c.peso;
  }, 0);

  return Math.round((obtenidos / pesoTotal) * 100);
}

export function segmentoDe(score: number): Segmento {
  return CORTES.find((c) => score >= c.desde)?.segmento ?? "D";
}

/** Deja el productor con todo lo derivado listo para mostrar. */
export function calcular(
  p: Productor,
  costos: Record<Cultivo, CostoCultivo>,
  criterios: CriterioMatriz[],
): ProductorCalculado {
  const mercado = mercadoDe(p, costos);
  const total = p.lc + p.bayer;
  const totalPrev = p.lcPrev + p.bayerPrev;
  const score = scoreDe(p, criterios);

  return {
    ...p,
    hasTotal: hasTotalDe(p),
    mercado,
    total,
    totalPrev,
    participacion: mercado > 0 ? total / mercado : 0,
    oportunidad: Math.max(0, mercado - total),
    score,
    segmentoCalculado: segmentoDe(score),
    variacion: totalPrev > 0 ? total / totalPrev - 1 : null,
  };
}

/** Color del segmento. A y B son cartera a defender; C y D, a desarrollar. */
export const TONO_SEGMENTO: Record<Segmento, string> = {
  A: "bg-verde/15 text-verde",
  B: "bg-clementina/20 text-clementina-deep",
  C: "bg-slate-brand/10 text-slate-brand",
  D: "bg-panel-soft text-ink-soft",
};
