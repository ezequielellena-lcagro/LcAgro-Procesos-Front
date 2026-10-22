import { parsearDecimalEsAr } from "@/shared/format/decimal";
import type {
  GuardarPorcentajeObjetivoRequest,
  IndicadorObjetivo,
  PorcentajeObjetivo,
  TipoObjetivo,
} from "../types";

export const INDICADORES_OBJETIVO: { id: IndicadorObjetivo; nombre: string; admiteNivel: boolean }[] = [
  { id: "facturacion", nombre: "Facturación general USD", admiteNivel: false },
  { id: "fertilizantes", nombre: "Facturación fertilizantes USD", admiteNivel: false },
  { id: "semilla_trigo_fiscalizada", nombre: "Semilla fiscalizada de trigo (bolsas)", admiteNivel: false },
  { id: "semilla_soja_fiscalizada", nombre: "Semilla fiscalizada de soja (bolsas)", admiteNivel: false },
  { id: "margen_bruto", nombre: "Margen bruto", admiteNivel: true },
  { id: "market_share", nombre: "Market share de clientes", admiteNivel: true },
];

export interface EntradaPorcentaje {
  texto: string;
  tipo: TipoObjetivo;
}

/** Sólo los indicadores tocados; el resto se muestra como está guardado. */
export type BorradorPorcentajes = Partial<Record<IndicadorObjetivo, EntradaPorcentaje>>;

const textoDe = (valor: number) => String(valor).replace(".", ",");

export function entradaPorcentaje(
  guardados: PorcentajeObjetivo[],
  borrador: BorradorPorcentajes,
  indicador: IndicadorObjetivo,
): EntradaPorcentaje {
  const guardado = guardados.find((item) => item.indicador === indicador);
  return borrador[indicador] ?? {
    texto: guardado ? textoDe(guardado.porcentaje) : "",
    tipo: guardado?.tipo ?? "crecimiento",
  };
}

/** Vacío no es error: deja al indicador sin objetivo. */
export function validarPorcentaje(texto: string, tipo: TipoObjetivo): string | null {
  const valor = parsearDecimalEsAr(texto);
  if (valor === null) return null;
  if (Number.isNaN(valor)) return "Ingresá un número, por ejemplo 13 o 12,5.";
  if (Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-9) return "Hasta dos decimales.";
  if (tipo === "nivel" && (valor < 0 || valor > 100)) return "Un nivel va de 0 a 100 %.";
  if (tipo === "crecimiento" && (valor < -100 || valor > 1000)) return "Un crecimiento va de -100 a 1000 %.";
  return null;
}

export function erroresPorcentajes(borrador: BorradorPorcentajes): Partial<Record<IndicadorObjetivo, string>> {
  const errores: Partial<Record<IndicadorObjetivo, string>> = {};
  for (const { id } of INDICADORES_OBJETIVO) {
    const entrada = borrador[id];
    const error = entrada ? validarPorcentaje(entrada.texto, entrada.tipo) : null;
    if (error) errores[id] = error;
  }
  return errores;
}

/** Lo que cambió contra lo guardado, con la revisión que se vio. Vaciar un guardado lo borra. */
export function cambiosPorcentajes(
  guardados: PorcentajeObjetivo[],
  borrador: BorradorPorcentajes,
): GuardarPorcentajeObjetivoRequest[] {
  return INDICADORES_OBJETIVO.flatMap(({ id }): GuardarPorcentajeObjetivoRequest[] => {
    const entrada = borrador[id];
    if (!entrada) return [];
    const guardado = guardados.find((item) => item.indicador === id);
    const valor = parsearDecimalEsAr(entrada.texto);
    if (valor === null) {
      return guardado
        ? [{ indicador: id, tipo: null, porcentaje: null, revisionEsperada: guardado.revision }]
        : [];
    }
    if (Number.isNaN(valor)) return [];
    if (guardado && guardado.porcentaje === valor && guardado.tipo === entrada.tipo) return [];
    return [{ indicador: id, tipo: entrada.tipo, porcentaje: valor, revisionEsperada: guardado?.revision ?? 0 }];
  });
}
