import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toAppError } from "@/lib/api-error";
import {
  obtenerDetalleProductorSnapshot,
  obtenerDetalleProductorTablero,
  obtenerTablero,
  obtenerTableroSnapshot,
} from "../api";
import type { CorteConsultaPlanificacion, TableroFiltros } from "../types";
import {
  claveCortePlanificacion,
  CORTE_VIVO_PLANIFICACION,
  planificacionKeys,
} from "./keys";

const invalidacionesShaEnCursoPorCliente = new WeakMap<QueryClient, Set<string>>();

function claveRecuperacionSha(campania: string, corte: CorteConsultaPlanificacion): string | null {
  if (corte.modo !== "snapshot") return null;
  return `${campania}:${corte.snapshot.id}:${corte.snapshot.sha256}`;
}

function invalidacionesShaEnCurso(queryClient: QueryClient): Set<string> {
  const existentes = invalidacionesShaEnCursoPorCliente.get(queryClient);
  if (existentes) return existentes;

  const nuevas = new Set<string>();
  invalidacionesShaEnCursoPorCliente.set(queryClient, nuevas);
  return nuevas;
}

async function consultarFotoConRecuperacion<T>(
  queryClient: QueryClient,
  campania: string,
  corte: CorteConsultaPlanificacion,
  consulta: () => Promise<T>,
): Promise<T> {
  const clave = claveRecuperacionSha(campania, corte);

  try {
    return await consulta();
  } catch (error) {
    if (clave && toAppError(error).status === 409) {
      const invalidaciones = invalidacionesShaEnCurso(queryClient);
      if (!invalidaciones.has(clave)) {
        invalidaciones.add(clave);
        try {
          await queryClient.invalidateQueries({
            queryKey: planificacionKeys.listadoSnapshots(campania),
            exact: true,
          });
        } finally {
          invalidaciones.delete(clave);
        }
      }
    }
    throw error;
  }
}

function reintentarConsulta(intentosFallidos: number, error: unknown): boolean {
  return toAppError(error).status !== 409 && intentosFallidos < 3;
}

/**
 * Conserva la página previa al paginar o filtrar dentro de una campaña, pero nunca muestra números
 * de una campaña anterior mientras vuela la nueva consulta.
 */
export function esMismoCorteTablero(
  queryKeyPrevia: readonly unknown[] | undefined,
  campania: string,
  corte: CorteConsultaPlanificacion,
): boolean {
  return (
    queryKeyPrevia?.[2] === campania &&
    queryKeyPrevia?.[3] === claveCortePlanificacion(corte)
  );
}

export function useTableroPlanificacion(
  filtros: TableroFiltros,
  corte: CorteConsultaPlanificacion = CORTE_VIVO_PLANIFICACION,
) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: planificacionKeys.tablero(filtros, corte),
    queryFn: async () => {
      if (corte.modo === "vivo") return obtenerTablero(filtros);
      if (corte.modo === "snapshot-pendiente") {
        throw new Error("No se puede consultar una foto sin sus metadatos.");
      }
      return consultarFotoConRecuperacion(queryClient, filtros.campania, corte, async () =>
        (await obtenerTableroSnapshot(corte.snapshot, filtros)).tablero
      );
    },
    placeholderData: (previos, queryPrevia) =>
      esMismoCorteTablero(queryPrevia?.queryKey, filtros.campania, corte)
        ? previos
        : undefined,
    enabled: corte.modo !== "snapshot-pendiente",
    retry: reintentarConsulta,
  });
}

export function useProductorTableroDetalle(
  productorId: number | undefined,
  campania: string,
  corte: CorteConsultaPlanificacion = CORTE_VIVO_PLANIFICACION,
) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: planificacionKeys.detalle(productorId, campania, corte),
    queryFn: async () => {
      if (corte.modo === "vivo") return obtenerDetalleProductorTablero(productorId!, campania);
      if (corte.modo === "snapshot-pendiente") {
        throw new Error("No se puede consultar una foto sin sus metadatos.");
      }
      return consultarFotoConRecuperacion(queryClient, campania, corte, async () =>
        (await obtenerDetalleProductorSnapshot(corte.snapshot, productorId!)).detalle
      );
    },
    enabled:
      productorId !== undefined &&
      productorId > 0 &&
      campania.length > 0 &&
      corte.modo !== "snapshot-pendiente",
    retry: reintentarConsulta,
  });
}
