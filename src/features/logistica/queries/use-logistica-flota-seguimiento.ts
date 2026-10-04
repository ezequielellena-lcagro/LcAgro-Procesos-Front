import { useCallback, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import { toAppError } from "@/lib/api-error";
import { confirmacionPendiente } from "../lib/comandos";
import { useOperacion } from "./use-logistica";
import type { FlotaSeguimientoDto, Pagina, Seguimiento } from "../types";

export function useFlotaSeguimiento(buscar: string, aplicacion: number, enabled: boolean) {
  const filtros = buscar === "" ? {} : { buscar };
  return useInfiniteQuery({
    queryKey: [
      "logistica",
      "seguimientos/flota-disponible",
      filtros,
      { tamano: 50 },
      { aplicacion },
    ],
    enabled,
    retry: false,
    // Cada apertura requiere lectura propia nueva, aunque la página siga fresca en caché.
    refetchOnMount: "always",
    initialPageParam: {} as { despuesId?: string },
    queryFn: async ({ pageParam, signal }) =>
      (
        await apiClient.get<Pagina<FlotaSeguimientoDto>>(
          "/logistica/seguimientos/flota-disponible",
          {
            params: { ...filtros, tamano: 50, ...pageParam },
            signal,
          },
        )
      ).data,
    getNextPageParam: (page) =>
      page.hayMas && page.filas.length
        ? { despuesId: page.filas[page.filas.length - 1].fichaId }
        : undefined,
  });
}
export function useSeleccionarFlotaSeguimiento(cupoId: string) {
  return useOperacion<Seguimiento>("seguimientos/" + cupoId + "/flota", "put");
}
export function useRetirarFlotaSeguimiento(cupoId: string) {
  return useOperacion<Seguimiento>("seguimientos/" + cupoId + "/flota/retirar");
}

// Conserva el cuerpo hasta resolver la confirmación; useOperacion conserva su UUID.
export function useConfirmacionFlota(
  mutation: ReturnType<typeof useSeleccionarFlotaSeguimiento>,
  onClose: () => void,
  onConflict: () => void,
) {
  const intento = useRef<object | null>(null);
  const enCurso = useRef(false);
  const [enviado, setEnviado] = useState(false);
  const [confirmacionIncierta, setConfirmacionIncierta] = useState(false);
  const incierto = confirmacionIncierta || confirmacionPendiente(mutation.error);
  const protegido = mutation.isPending || incierto;
  const blocker = useBlocker(protegido);
  useBeforeUnload(
    useCallback(
      (event) => {
        if (!protegido) return;
        event.preventDefault();
        event.returnValue = "";
      },
      [protegido],
    ),
  );
  const cerrar = () => {
    if (!enCurso.current && !protegido) onClose();
  };
  const enviar = async (body: object) => {
    if (enCurso.current) return;
    intento.current ??= structuredClone(body);
    enCurso.current = true;
    setEnviado(true);
    try {
      await mutation.mutateAsync(intento.current);
      setConfirmacionIncierta(false);
      onClose();
    } catch (error) {
      if (toAppError(error).status === 409) {
        setConfirmacionIncierta(false);
        onConflict();
      } else if (confirmacionPendiente(error)) setConfirmacionIncierta(true);
    } finally {
      enCurso.current = false;
    }
  };
  return { enviado, incierto, cerrar, enviar, bloqueada: blocker.state === "blocked" };
}
