import { parsearDecimalEsAr } from "@/shared/format/decimal";
import {
  CULTIVOS_MARKET,
  type CultivoMarket,
  type GuardarMarketShareCultivoRequest,
  type MarketShareCultivoResponse,
} from "../types";

export const CAMPOS_MARKET = ["qqInsumoHa", "precioUsdTn", "rindeTnHa"] as const;
export type CampoMarket = (typeof CAMPOS_MARKET)[number];
type Valores = Record<CampoMarket, number | null>;
type Textos = Record<CampoMarket, string>;

export interface BorradorCultivo {
  base: Valores;
  revisionEsperada: number;
  textos: Textos;
}

export type BorradorMarketShare = Partial<Record<CultivoMarket, BorradorCultivo>>;

export function textoMarket(valor: number | null): string {
  return valor === null ? "" : String(valor).replace(".", ",");
}

function valoresFila(fila: MarketShareCultivoResponse): Valores {
  return {
    qqInsumoHa: fila.qqInsumoHa,
    precioUsdTn: fila.precioUsdTn,
    rindeTnHa: fila.rindeTnHa,
  };
}

function inicial(fila: MarketShareCultivoResponse): BorradorCultivo {
  const base = valoresFila(fila);
  return {
    base,
    revisionEsperada: fila.revision,
    textos: {
      qqInsumoHa: textoMarket(base.qqInsumoHa),
      precioUsdTn: textoMarket(base.precioUsdTn),
      rindeTnHa: textoMarket(base.rindeTnHa),
    },
  };
}

export function textoCampo(
  fila: MarketShareCultivoResponse,
  borrador: BorradorMarketShare,
  campo: CampoMarket,
): string {
  return borrador[fila.cultivo]?.textos[campo] ?? textoMarket(fila[campo]);
}

export function valorCampo(
  fila: MarketShareCultivoResponse,
  borrador: BorradorMarketShare,
  campo: CampoMarket,
): number | null {
  const entrada = borrador[fila.cultivo];
  return entrada ? parsearDecimalEsAr(entrada.textos[campo]) : fila[campo];
}

export function editarMarketShare(
  borrador: BorradorMarketShare,
  fila: MarketShareCultivoResponse,
  campo: CampoMarket,
  texto: string,
): BorradorMarketShare {
  const entrada = borrador[fila.cultivo] ?? inicial(fila);
  return {
    ...borrador,
    [fila.cultivo]: { ...entrada, textos: { ...entrada.textos, [campo]: texto } },
  };
}

function valoresEntrada(entrada: BorradorCultivo): Valores {
  return {
    qqInsumoHa: parsearDecimalEsAr(entrada.textos.qqInsumoHa),
    precioUsdTn: parsearDecimalEsAr(entrada.textos.precioUsdTn),
    rindeTnHa: parsearDecimalEsAr(entrada.textos.rindeTnHa),
  };
}

function tieneCambios(entrada: BorradorCultivo): boolean {
  const valores = valoresEntrada(entrada);
  return CAMPOS_MARKET.some((campo) => valores[campo] !== entrada.base[campo]);
}

export function finalizarMarketShare(
  borrador: BorradorMarketShare,
  cultivo: CultivoMarket,
): BorradorMarketShare {
  const entrada = borrador[cultivo];
  if (!entrada || tieneCambios(entrada)) return borrador;
  const siguiente = { ...borrador };
  delete siguiente[cultivo];
  return siguiente;
}

export function copiarMarketShare(
  borrador: BorradorMarketShare,
  destino: MarketShareCultivoResponse[],
  origen: MarketShareCultivoResponse[],
): BorradorMarketShare {
  let siguiente = borrador;
  for (const cultivo of CULTIVOS_MARKET) {
    const fila = destino.find((item) => item.cultivo === cultivo);
    const previa = origen.find((item) => item.cultivo === cultivo);
    if (!fila || !previa || CAMPOS_MARKET.some((campo) => previa[campo] === null)) continue;
    const entrada = siguiente[cultivo] ?? inicial(fila);
    siguiente = finalizarMarketShare(
      {
        ...siguiente,
        [cultivo]: {
          ...entrada,
          textos: {
            qqInsumoHa: textoMarket(previa.qqInsumoHa),
            precioUsdTn: textoMarket(previa.precioUsdTn),
            rindeTnHa: textoMarket(previa.rindeTnHa),
          },
        },
      },
      cultivo,
    );
  }
  return siguiente;
}

const LIMITES: Record<CampoMarket, { maximo: number; decimales: number }> = {
  qqInsumoHa: { maximo: 1000, decimales: 3 },
  precioUsdTn: { maximo: 100000, decimales: 2 },
  rindeTnHa: { maximo: 50, decimales: 3 },
};

export function validarCampoMarket(texto: string, campo: CampoMarket): string | null {
  const valor = parsearDecimalEsAr(texto);
  if (valor === null) return "Completá este valor.";
  if (!Number.isFinite(valor)) return "Ingresá un número válido.";
  const { maximo, decimales } = LIMITES[campo];
  if (valor < 0 || valor > maximo)
    return "Ingresá entre 0 y " + maximo.toLocaleString("es-AR") + ".";
  if (Number(valor.toFixed(decimales)) !== valor) return "Usá hasta " + decimales + " decimales.";
  return null;
}

export type ErroresMarket = Partial<Record<CultivoMarket, Partial<Record<CampoMarket, string>>>>;

export function erroresMarket(borrador: BorradorMarketShare): ErroresMarket {
  const errores: ErroresMarket = {};
  for (const cultivo of CULTIVOS_MARKET) {
    const entrada = borrador[cultivo];
    if (!entrada || !tieneCambios(entrada)) continue;
    for (const campo of CAMPOS_MARKET) {
      const error = validarCampoMarket(entrada.textos[campo], campo);
      if (error) (errores[cultivo] ??= {})[campo] = error;
    }
  }
  return errores;
}

export function cambiosMarket(borrador: BorradorMarketShare): GuardarMarketShareCultivoRequest[] {
  const cambios: GuardarMarketShareCultivoRequest[] = [];
  for (const cultivo of CULTIVOS_MARKET) {
    const entrada = borrador[cultivo];
    if (!entrada || !tieneCambios(entrada)) continue;
    const valores = valoresEntrada(entrada);
    if (CAMPOS_MARKET.some((campo) => validarCampoMarket(entrada.textos[campo], campo))) continue;
    cambios.push({
      cultivo,
      qqInsumoHa: valores.qqInsumoHa!,
      precioUsdTn: valores.precioUsdTn!,
      rindeTnHa: valores.rindeTnHa!,
      revisionEsperada: entrada.revisionEsperada,
    });
  }
  return cambios;
}

export function cultivosEditados(borrador: BorradorMarketShare): number {
  return CULTIVOS_MARKET.filter((cultivo) => {
    const entrada = borrador[cultivo];
    return entrada && tieneCambios(entrada);
  }).length;
}
