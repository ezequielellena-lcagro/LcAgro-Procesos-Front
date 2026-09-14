import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type { ClientesCopiaDto, EstadoCopiaClientesDto } from "../types";
import { semilleroKeys } from "./keys";

/**
 * Clientes activos de la copia local (R2.1/R2.2): esta pantalla NUNCA consulta a MacroGest en vivo.
 * El refresco condicionado por vencimiento (R2.3) lo decide el backend en el propio GET; acá sólo
 * se lee el resultado.
 */
export function useClientesSemillero(habilitado = true) {
  return useQuery({
    queryKey: semilleroKeys.clientes(),
    queryFn: async () => (await apiClient.get<ClientesCopiaDto>("/semillero/clientes")).data,
    enabled: habilitado,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Botón "Actualizar clientes" (R2.3). Si MacroGest no responde el backend devuelve 503 (R2.4), pero
 * el intento fallido queda igual registrado: por eso se invalida la query también en el error, para
 * que el próximo `useClientesSemillero` muestre el aviso actualizado (último intento fallido).
 */
export function useSincronizarClientes() {
  const qc = useQueryClient();
  const invalidar = () => qc.invalidateQueries({ queryKey: semilleroKeys.clientes() });
  return useMutation({
    mutationFn: async () => (await apiClient.post<EstadoCopiaClientesDto>("/semillero/clientes/sincronizar")).data,
    onSuccess: (estado) => {
      invalidar();
      toast.success(`Clientes sincronizados: ${estado.cantidad}.`);
    },
    onError: () => {
      invalidar();
    },
  });
}
