import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type { DestinoActualizarInput, DestinoAltaInput, DestinoDto } from "../types";
import { semilleroKeys } from "./keys";

/** Destinos/campos propios de un cliente (R1.3); sin cliente elegido, no se pide nada. */
export function useDestinos(clienteNumero: number | undefined, incluirInactivos = false) {
  return useQuery({
    queryKey: semilleroKeys.destinos(clienteNumero ?? 0, incluirInactivos),
    queryFn: async () =>
      (
        await apiClient.get<DestinoDto[]>(`/semillero/clientes/${clienteNumero}/destinos`, {
          params: { incluirInactivos },
        })
      ).data,
    enabled: clienteNumero !== undefined,
  });
}

function useInvalidarDestinos(clienteNumero: number) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: semilleroKeys.destinosDeCliente(clienteNumero) });
}

/**
 * Alta rápida desde el armado de la orden (R1.3): idempotente — un nombre equivalente ya existente
 * vuelve con 200 (reactivándolo si estaba inactivo) en vez de duplicarse.
 */
export function useCrearDestino(clienteNumero: number) {
  const invalidar = useInvalidarDestinos(clienteNumero);
  return useMutation({
    mutationFn: async (input: DestinoAltaInput) =>
      (await apiClient.post<DestinoDto>(`/semillero/clientes/${clienteNumero}/destinos`, input)).data,
    onSuccess: (destino) => {
      invalidar();
      toast.success(`${destino.nombre} agregado.`);
    },
  });
}

/** Edición desde Catálogos (nombre y activo); un destino en uso no se elimina, sólo se desactiva. */
export function useGuardarDestino(clienteNumero: number) {
  const invalidar = useInvalidarDestinos(clienteNumero);
  return useMutation({
    mutationFn: async ({ id, ...input }: DestinoActualizarInput & { id: number }) =>
      (await apiClient.put<DestinoDto>(`/semillero/catalogos/destinos/${id}`, input)).data,
    onSuccess: (destino) => {
      invalidar();
      toast.success(destino.activo ? `${destino.nombre} guardado.` : `${destino.nombre} quedó desactivado.`);
    },
  });
}
