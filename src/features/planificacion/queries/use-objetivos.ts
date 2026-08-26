import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toAppError } from "@/lib/api-error";
import {
  acordarObjetivo,
  guardarObjetivos,
  obtenerObjetivos,
  previsualizarObjetivos,
} from "../api";
import type {
  AcuerdoObjetivoVendedorRequest,
  GuardadoObjetivosDto,
  ObjetivosConsulta,
  ObjetivosRequest,
} from "../types";
import { planificacionKeys } from "./keys";

export function useObjetivos(consulta: ObjetivosConsulta) {
  return useQuery({
    queryKey: planificacionKeys.objetivo(consulta),
    queryFn: () => obtenerObjetivos(consulta),
  });
}

/** Calcula una propuesta sin persistirla ni alterar ninguna revisión cacheada. */
export function usePrevisualizarObjetivos() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { silentError: true },
    mutationFn: previsualizarObjetivos,
    onError: (error, request: ObjetivosRequest) =>
      manejarConflictoObjetivos(queryClient, request, error),
  });
}

async function refrescarObjetivos(
  queryClient: ReturnType<typeof useQueryClient>,
  request: { campania: string },
  propagarError = false,
) {
  // La escritura devuelve una foto de esa operación, no una lectura canónica para sembrar caché.
  // Se invalida y se espera el GET fresco antes de volver a presentar objetivos como vigentes.
  const opciones = propagarError ? { throwOnError: true } : undefined;
  await Promise.all([
    queryClient.invalidateQueries(
      {
        queryKey: planificacionKeys.objetivosVigentes(request.campania),
      },
      opciones,
    ),
    queryClient.invalidateQueries(
      {
        queryKey: planificacionKeys.tablerosCampania(request.campania),
      },
      opciones,
    ),
  ]);
}

async function manejarConflictoObjetivos(
  queryClient: ReturnType<typeof useQueryClient>,
  request: { campania: string },
  error: unknown,
) {
  const appError = toAppError(error);
  if (appError.status !== 409) return;

  try {
    await refrescarObjetivos(queryClient, request, true);
    toast.error(
      `${appError.message} Cargamos la revisión vigente; revisá los valores antes de reintentar.`,
    );
  } catch {
    toast.error(
      `${appError.message} No pudimos recargar la revisión vigente. Reintentá la carga antes de editar.`,
    );
  }
}

export function useGuardarObjetivos() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { silentError: true },
    mutationFn: guardarObjetivos,
    onSuccess: async (respuesta, request: ObjetivosRequest) => {
      await refrescarObjetivos(queryClient, request);
      toast.success(
        respuesta.sinCambios ? "Los objetivos ya estaban actualizados." : "Objetivos guardados.",
      );
    },
    onError: (error, request: ObjetivosRequest) =>
      manejarConflictoObjetivos(queryClient, request, error),
  });
}

export function useAcordarObjetivo() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { silentError: true },
    mutationFn: acordarObjetivo,
    onSuccess: async (
      _respuesta: GuardadoObjetivosDto,
      request: AcuerdoObjetivoVendedorRequest,
    ) => {
      await refrescarObjetivos(queryClient, request);
      toast.success("Objetivo acordado.");
    },
    onError: (error, request: AcuerdoObjetivoVendedorRequest) =>
      manejarConflictoObjetivos(queryClient, request, error),
  });
}
