import { parsearDecimalEsAr } from "@/shared/format/decimal";
import {
  CULTIVOS,
  type Cultivo,
  type HectareasPlan,
  type PlanSiembraFila,
  type PlanSiembraItem,
} from "../types";

export interface BorradorFila {
  planBase: HectareasPlan | null;
  revisionEsperada: number;
  textos: Partial<Record<Cultivo, string>>;
}

export type BorradorPlan = Record<string, BorradorFila>;

function entradaInicial(fila: PlanSiembraFila): BorradorFila {
  return {
    planBase: fila.plan ? { ...fila.plan } : null,
    revisionEsperada: fila.revision,
    textos: {},
  };
}

export function planBase(fila: PlanSiembraFila, borrador: BorradorPlan): HectareasPlan | null {
  return borrador[fila.cuit] ? borrador[fila.cuit].planBase : fila.plan;
}

export function textoHectareas(valor: number | null): string {
  return valor == null ? "" : String(valor).replace(".", ",");
}

export function editarCelda(
  borrador: BorradorPlan,
  fila: PlanSiembraFila,
  cultivo: Cultivo,
  texto: string,
): BorradorPlan {
  const entrada = borrador[fila.cuit] ?? entradaInicial(fila);
  return {
    ...borrador,
    [fila.cuit]: { ...entrada, textos: { ...entrada.textos, [cultivo]: texto } },
  };
}

export function finalizarEdicion(borrador: BorradorPlan, fila: PlanSiembraFila): BorradorPlan {
  const entrada = borrador[fila.cuit];
  if (!entrada) return borrador;
  const valores = valorHectareas(fila, borrador);
  if (CULTIVOS.some((cultivo) => valores[cultivo] !== (entrada.planBase?.[cultivo] ?? null)))
    return borrador;
  const siguiente = { ...borrador };
  delete siguiente[fila.cuit];
  return siguiente;
}

export function cancelarCelda(
  borrador: BorradorPlan,
  fila: PlanSiembraFila,
  cultivo: Cultivo,
): BorradorPlan {
  const entrada = borrador[fila.cuit];
  if (!entrada) return borrador;
  const textos = { ...entrada.textos };
  delete textos[cultivo];
  return finalizarEdicion({ ...borrador, [fila.cuit]: { ...entrada, textos } }, fila);
}

export function valorHectareas(fila: PlanSiembraFila, borrador: BorradorPlan): HectareasPlan {
  const entrada = borrador[fila.cuit];
  const base = entrada ? entrada.planBase : fila.plan;
  const valor = (cultivo: Cultivo) => {
    const texto = entrada?.textos[cultivo];
    return texto === undefined ? (base?.[cultivo] ?? null) : parsearDecimalEsAr(texto);
  };
  return {
    soja: valor("soja"),
    maiz: valor("maiz"),
    trigo: valor("trigo"),
    otro: valor("otro"),
  };
}

export function validarHectareas(texto: string): string | null {
  const valor = parsearDecimalEsAr(texto);
  if (valor === null) return null;
  if (!Number.isFinite(valor)) return "Ingresá un número válido.";
  if (valor < 0 || valor > 100000) return "Ingresá entre 0 y 100.000 ha.";
  if (Number(valor.toFixed(2)) !== valor) return "Usá hasta dos decimales.";
  return null;
}

export function erroresDelBorrador(
  filas: PlanSiembraFila[],
  borrador: BorradorPlan,
): Record<string, Partial<Record<Cultivo, string>>> {
  const errores: Record<string, Partial<Record<Cultivo, string>>> = {};
  for (const fila of filas) {
    const editadas = borrador[fila.cuit]?.textos;
    if (!editadas) continue;
    for (const cultivo of CULTIVOS) {
      const texto = editadas[cultivo];
      if (texto === undefined) continue;
      const error = validarHectareas(texto);
      if (error) (errores[fila.cuit] ??= {})[cultivo] = error;
    }
  }
  return errores;
}

export function cambiosDelPlan(
  filas: PlanSiembraFila[],
  borrador: BorradorPlan,
): PlanSiembraItem[] {
  return filas.flatMap((fila) => {
    const entrada = borrador[fila.cuit];
    if (!entrada) return [];
    const valores = valorHectareas(fila, borrador);
    const modificado = CULTIVOS.some(
      (cultivo) => valores[cultivo] !== (entrada.planBase?.[cultivo] ?? null),
    );
    return modificado
      ? [{ cuit: fila.cuit, ...valores, revisionEsperada: entrada.revisionEsperada }]
      : [];
  });
}

export function usarAnteriorEnFila(fila: PlanSiembraFila, borrador: BorradorPlan): BorradorPlan {
  if (!fila.anterior) return borrador;
  const entrada = borrador[fila.cuit] ?? entradaInicial(fila);
  return finalizarEdicion(
    {
      ...borrador,
      [fila.cuit]: {
        ...entrada,
        textos: Object.fromEntries(
          CULTIVOS.map((cultivo) => [cultivo, textoHectareas(fila.anterior?.[cultivo] ?? null)]),
        ),
      },
    },
    fila,
  );
}

export function completarVaciosConAnterior(
  filas: PlanSiembraFila[],
  borrador: BorradorPlan,
): BorradorPlan {
  let siguiente: BorradorPlan | undefined;
  for (const fila of filas) {
    if (!fila.anterior) continue;
    const entrada = (siguiente ?? borrador)[fila.cuit] ?? entradaInicial(fila);
    const actual = valorHectareas(fila, siguiente ?? borrador);
    const textos = { ...entrada.textos };
    let huboCambios = false;
    for (const cultivo of CULTIVOS) {
      if (actual[cultivo] === null && fila.anterior[cultivo] !== null) {
        textos[cultivo] = textoHectareas(fila.anterior[cultivo]);
        huboCambios = true;
      }
    }
    if (huboCambios) {
      siguiente ??= { ...borrador };
      siguiente[fila.cuit] = { ...entrada, textos };
    }
  }
  return siguiente ?? borrador;
}

export function erroresPorCuit(
  items: PlanSiembraItem[],
  fieldErrors: Record<string, string[]>,
): Record<string, Partial<Record<Cultivo, string>>> {
  const porCuit: Record<string, Partial<Record<Cultivo, string>>> = {};
  for (const [campo, mensajes] of Object.entries(fieldErrors)) {
    const coincidencia = /^Items\[(\d+)\]\.(Soja|Maiz|Trigo|Otro)$/i.exec(campo);
    if (!coincidencia) continue;
    const cuit = items[Number(coincidencia[1])]?.cuit;
    if (!cuit) continue;
    const cultivo = coincidencia[2].toLowerCase() as Cultivo;
    (porCuit[cuit] ??= {})[cultivo] = mensajes.join(" ");
  }
  return porCuit;
}
