import type { CultivoMarket, MarketShareCultivoResponse } from "../types";

/** Nombre del cultivo para encabezados de tabla y etiquetas de los campos. */
export const NOMBRES_MARKET: Record<CultivoMarket, string> = {
  soja: "Soja",
  maiz: "Maíz",
  trigo: "Trigo",
};

const FILA_VACIA: Omit<MarketShareCultivoResponse, "cultivo"> = {
  qqInsumoHa: null,
  precioUsdTn: null,
  costoUsdHa: null,
  rindeTnHa: null,
  revision: 0,
  modificadoPor: null,
  modificadoEl: null,
};

/** Fila del cultivo, o una vacía si el backend todavía no la devolvió. */
export function filaMarket(
  cultivos: MarketShareCultivoResponse[],
  cultivo: CultivoMarket,
): MarketShareCultivoResponse {
  return cultivos.find((item) => item.cultivo === cultivo) ?? { ...FILA_VACIA, cultivo };
}

/** true si la campaña todavía no tiene ningún parámetro cargado: habilita copiar la anterior. */
export function sinDatosMarket(cultivos: MarketShareCultivoResponse[]): boolean {
  return cultivos.every(
    (fila) => fila.qqInsumoHa === null && fila.precioUsdTn === null && fila.rindeTnHa === null,
  );
}

/** "2026-2027" → "2026/27". */
export function etiquetaCampania(campania: string): string {
  return campania.slice(0, 4) + "/" + campania.slice(-2);
}

/** Costo USD/ha = qq insumo/ha × precio USD/tn ÷ 10. null si falta algún valor. */
export function costoUsdHa(qq: number | null, precio: number | null): number | null {
  return qq !== null && precio !== null && Number.isFinite(qq) && Number.isFinite(precio)
    ? (qq * precio) / 10
    : null;
}
