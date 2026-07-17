/** Posición por campaña + cereal (espeja PosicionDto del backend). La API ya aplicó los ajustes:
 * `posicionFinal` es la definitiva. Precios y márgenes pueden venir null. */
export interface PosicionDto {
  campania: string;
  cereal: string;
  tnCompra: number;
  precioCompra: number | null;
  tnVenta: number;
  precioVenta: number | null;
  tnCalzadas: number;
  margenUsdTn: number | null;
  margenPct: number | null;
  resultadoUsd: number;
  posicionSinAjustes: number;
  posicionFinal: number;
  ajustesDetalle: AjusteAplicado[];

  /** CONSOLIDADO: los ajustes imputados a su lado ('+' suma a compras, '−' a ventas), con precio
   * PONDERADO. Es lo que el cliente controla contra su planilla; `posicionFinal` = compra − venta total. */
  tnCompraTotal: number;
  precioCompraTotal: number | null;
  tnVentaTotal: number;
  precioVentaTotal: number | null;
  margenTotalUsdTn: number | null;
}

export type TipoAjuste =
  | "arrastre"
  | "arrastre_inicial"
  | "semilla"
  | "canje"
  | "produccion_propia"
  | "ganancia_acopio"
  | "bioceres";
export type SignoAjuste = "+" | "-";

/** Sub-fila de ajuste agregada por tipo (espeja AjusteAplicadoDto del backend). */
export interface AjusteAplicado {
  tipo: TipoAjuste;
  tn: number;            // firmada (con signo)
  precioUsd: number | null;
}

export interface AjusteDto {
  id: number;
  campania: string;
  cereal: string;
  tipo: TipoAjuste;
  tn: number;
  precioUsd: number | null;
  signo: SignoAjuste;
  nota: string | null;
  tnFirmadas: number;
  fechaAlta: string;
}

/** Alerta: contratos con precio anómalo (fuera de rango) que la posición no cuenta (espeja DescartadoDto). */
export interface DescartadoDto {
  campania: string;
  cereal: string;
  lado: "compra" | "venta";
  contratos: number;
  tn: number;
}

/** Payload de alta/edición (espeja AjusteRequest del backend). */
export interface AjusteInput {
  campania: string;
  cereal: string;
  tipo: TipoAjuste;
  tn: number;
  precioUsd: number | null;
  signo: SignoAjuste;
  nota: string | null;
}

/** Vocabulario canónico de cereales (debe coincidir con MapeoCereales del backend). */
export const CEREALES = ["Maíz", "Trigo", "Sorgo", "Soja", "Girasol", "Colza"] as const;

export const TIPOS_AJUSTE: { value: TipoAjuste; label: string }[] = [
  { value: "arrastre", label: "Arrastre" },
  { value: "arrastre_inicial", label: "Arrastre inicial" },
  { value: "semilla", label: "Semilla" },
  { value: "canje", label: "Canje" },
  { value: "produccion_propia", label: "Producción propia" },
  { value: "ganancia_acopio", label: "Ganancia acopio" },
  { value: "bioceres", label: "Bioceres" },
];

/** Tipos que se cargan en el diálogo de ajustes manuales. El `arrastre` es automático (lo calcula el
 * sistema) y el `arrastre_inicial` (semilla/override del encadenado) se gestiona en su propia pestaña. */
export const TIPOS_AJUSTE_MANUAL = TIPOS_AJUSTE.filter(
  (t) => t.value !== "arrastre" && t.value !== "arrastre_inicial",
);
