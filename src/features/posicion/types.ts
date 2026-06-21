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
}

export type TipoAjuste = "arrastre" | "semilla" | "canje" | "produccion_propia";
export type SignoAjuste = "+" | "-";

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
  { value: "semilla", label: "Semilla" },
  { value: "canje", label: "Canje" },
  { value: "produccion_propia", label: "Producción propia" },
];
