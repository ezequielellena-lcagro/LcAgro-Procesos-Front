import type { ExportColumn } from "@/shared/export/export-types";
import type { BaseObjetivosResponse, IndicadoresBase, IndicadoresObjetivo } from "../types";

type TipoLinea = "vendedor" | "fuera" | "ajuste" | "total";

/** Lo real de la campaña base o el objetivo de la siguiente, con las mismas columnas. */
export type VistaObjetivos = "real" | "objetivo";

export interface LineaObjetivos {
  tipo: TipoLinea;
  etiqueta: string;
  sucursal: string | null;
  /** Null sólo en el ajuste de redondeo, que trae su importe en `ajusteUsd`. */
  indicadores: IndicadoresBase | null;
  /** Null en el ajuste de redondeo: no tiene objetivo propio. */
  objetivo: IndicadoresObjetivo | null;
  ajusteUsd?: number;
}

export type ColumnaObjetivos = ExportColumn<LineaObjetivos> & { key: string };

/** "2026-2027" → "2025-2026": los objetivos de una campaña se fijan sobre lo real de la anterior. */
export function campaniaAnterior(codigo: string): string {
  const inicio = Number(codigo.slice(0, 4));
  return `${inicio - 1}-${inicio}`;
}

const conMovimiento = (indicadores: IndicadoresBase) =>
  indicadores.facturacionUsd !== 0 || indicadores.fertilizantesUsd !== 0 ||
  indicadores.semillaTrigoFiscalizadaBolsas !== 0 || indicadores.semillaSojaFiscalizadaBolsas !== 0 ||
  indicadores.rentabilidadUsd !== 0;

/** Vendedores en el orden del servidor (mayor facturación primero), después fuera, ajuste y TOTAL. */
export function armarLineasObjetivos(data: BaseObjetivosResponse): LineaObjetivos[] {
  const lineas: LineaObjetivos[] = data.vendedores.map((vendedor) => ({
    tipo: "vendedor",
    etiqueta: vendedor.vendedor,
    sucursal: vendedor.sucursal,
    indicadores: vendedor.indicadores,
    objetivo: vendedor.objetivo,
  }));
  if (data.fueraDeCarteras && conMovimiento(data.fueraDeCarteras)) {
    lineas.push({
      tipo: "fuera",
      etiqueta: "Fuera de carteras",
      sucursal: null,
      indicadores: data.fueraDeCarteras,
      objetivo: data.objetivoFueraDeCarteras,
    });
  }
  if (data.ajusteRedondeoUsd !== 0) {
    lineas.push({
      tipo: "ajuste",
      etiqueta: "Ajuste de redondeo",
      sucursal: null,
      indicadores: null,
      objetivo: null,
      ajusteUsd: data.ajusteRedondeoUsd,
    });
  }
  lineas.push({ tipo: "total", etiqueta: "TOTAL", sucursal: null, indicadores: data.total, objetivo: data.objetivoTotal });
  return lineas;
}

const porcentaje = (valor: number | null | undefined) => (valor == null ? null : valor * 100);

export function columnasObjetivos(vista: VistaObjetivos = "real"): ColumnaObjetivos[] {
  const vendedor: ColumnaObjetivos[] = [
    { key: "vendedor", header: "Vendedor", get: (l) => l.etiqueta },
    { key: "sucursal", header: "Sucursal", get: (l) => l.sucursal },
  ];
  if (vista === "objetivo") {
    // El ajuste de redondeo no tiene objetivo: queda sin dato en todas sus columnas.
    return [
      ...vendedor,
      { key: "facturacion", header: "Facturación USD", get: (l) => l.objetivo?.facturacionUsd ?? null, format: "usd" },
      { key: "fertilizantes", header: "Fertilizantes USD", get: (l) => l.objetivo?.fertilizantesUsd ?? null, format: "usd" },
      { key: "trigo", header: "Semilla trigo fisc. (bolsas)", get: (l) => l.objetivo?.semillaTrigoFiscalizadaBolsas ?? null, format: "number" },
      { key: "soja", header: "Semilla soja fisc. (bolsas)", get: (l) => l.objetivo?.semillaSojaFiscalizadaBolsas ?? null, format: "number" },
      { key: "rentabilidad", header: "Rentabilidad USD", get: (l) => l.objetivo?.rentabilidadUsd ?? null, format: "usd" },
      { key: "margen", header: "Margen bruto", get: (l) => porcentaje(l.objetivo?.margenBruto), format: "percent" },
      { key: "marketShare", header: "Market share", get: (l) => porcentaje(l.objetivo?.marketShare), format: "percent" },
    ];
  }
  return [
    ...vendedor,
    { key: "facturacion", header: "Facturación USD", get: (l) => l.indicadores?.facturacionUsd ?? l.ajusteUsd ?? null, format: "usd" },
    { key: "fertilizantes", header: "Fertilizantes USD", get: (l) => l.indicadores?.fertilizantesUsd ?? null, format: "usd" },
    { key: "trigo", header: "Semilla trigo fisc. (bolsas)", get: (l) => l.indicadores?.semillaTrigoFiscalizadaBolsas ?? null, format: "number" },
    { key: "soja", header: "Semilla soja fisc. (bolsas)", get: (l) => l.indicadores?.semillaSojaFiscalizadaBolsas ?? null, format: "number" },
    { key: "rentabilidad", header: "Rentabilidad USD", get: (l) => l.indicadores?.rentabilidadUsd ?? null, format: "usd" },
    { key: "margen", header: "Margen bruto", get: (l) => porcentaje(l.indicadores?.margenBruto), format: "percent" },
    { key: "mercado", header: "Mercado USD", get: (l) => l.indicadores?.mercadoUsd ?? null, format: "usd" },
    { key: "marketShare", header: "Market share", get: (l) => porcentaje(l.indicadores?.marketShare), format: "percent" },
  ];
}

/** Criterio de cálculo. Como en el Consolidado, va sólo en el PDF, que se lee fuera del sistema. */
export const NOTAS_OBJETIVOS = [
  "Base: lo real de la campaña, del 1-abr al 31-mar, con la misma regla de facturación que Comisiones.",
  "Atribución: todo lo de un CUIT va al vendedor dueño de su cartera, como en el Consolidado.",
  "Fertilizantes: rubro 210 de MacroGest. Semillas fiscalizadas: rubros 100 (trigo) y 101 (soja), subrubro «Semilla fiscalizada», en bolsas.",
  "Margen bruto: rentabilidad ÷ facturación, con los costos corregidos de Comisiones.",
  "Market share: facturación de los productores con plan de siembra ÷ su mercado (hectáreas × costo de insumos de Market Share).",
];

/** Cómo se calculó el objetivo, para el PDF de la vista objetivo. */
export const NOTAS_OBJETIVO_CALCULO = [
  "Objetivo: lo real de la campaña base × (1 + porcentaje). Margen y market share pueden fijarse como nivel a alcanzar.",
  "La rentabilidad objetivo es la facturación objetivo × el margen objetivo. Sin porcentaje cargado o sin base, queda sin dato.",
];
