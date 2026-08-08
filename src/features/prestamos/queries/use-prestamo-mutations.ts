import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type {
  CronogramaInput,
  CuotaPropuesta,
  PagarCuotaInput,
  PrestamoDetalleDto,
  PrestamoInput,
} from "../types";
import { prestamosKeys } from "./keys";

/**
 * Cualquier escritura mueve las tres vistas a la vez (calendario, operaciones y detalle), porque
 * las tres salen de los mismos préstamos. Invalidar `all` es una sola línea y no deja nada viejo:
 * el universo es de ~20 operaciones, así que refrescar de más no cuesta nada.
 */
function useInvalidarTodo() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: prestamosKeys.all });
}

export function useCrearPrestamo() {
  const invalidar = useInvalidarTodo();
  return useMutation({
    meta: { silentError: true }, // el form mapea los errores por campo
    mutationFn: async (input: PrestamoInput) => {
      const { data } = await apiClient.post<PrestamoDetalleDto>("/prestamos", input);
      return data;
    },
    onSuccess: (prestamo) => {
      invalidar();
      toast.success("Préstamo cargado.");
      // Las advertencias no impiden guardar, pero tienen que verse: son el aviso de que el capital
      // de las cuotas no cierra con el capital original.
      for (const aviso of prestamo.advertencias) toast.warning(aviso);
    },
  });
}

export function useActualizarPrestamo() {
  const invalidar = useInvalidarTodo();
  return useMutation({
    meta: { silentError: true },
    mutationFn: async ({ id, ...input }: PrestamoInput & { id: number }) => {
      const { data } = await apiClient.put<PrestamoDetalleDto>(`/prestamos/${id}`, input);
      return data;
    },
    onSuccess: (prestamo) => {
      invalidar();
      toast.success("Préstamo actualizado.");
      for (const aviso of prestamo.advertencias) toast.warning(aviso);
    },
  });
}

export function useAnularPrestamo() {
  const invalidar = useInvalidarTodo();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/prestamos/${id}`);
    },
    onSuccess: () => {
      invalidar();
      toast.success("Préstamo anulado.");
    },
  });
}

export function usePagarCuota() {
  const invalidar = useInvalidarTodo();
  return useMutation({
    meta: { silentError: true },
    mutationFn: async ({ cuotaId, ...body }: PagarCuotaInput) => {
      await apiClient.post(`/prestamos/cuotas/${cuotaId}/pagar`, body);
    },
    onSuccess: () => {
      invalidar();
      toast.success("Cuota registrada como pagada.");
    },
  });
}

export function useRevertirPago() {
  const invalidar = useInvalidarTodo();
  return useMutation({
    mutationFn: async (cuotaId: number) => {
      await apiClient.post(`/prestamos/cuotas/${cuotaId}/revertir-pago`);
    },
    onSuccess: () => {
      invalidar();
      toast.success("Pago revertido: la cuota vuelve a pendiente.");
    },
  });
}

/**
 * Asistente de cronograma. No persiste nada ni toca la caché: devuelve la propuesta para que el
 * usuario la edite antes de guardar (los bancos no usan meses calendario exactos).
 */
export function useSimularCronograma() {
  return useMutation({
    meta: { silentError: true },
    mutationFn: async (input: CronogramaInput) => {
      const { data } = await apiClient.post<CuotaPropuesta[]>(
        "/prestamos/cronograma/simular",
        input,
      );
      return data;
    },
  });
}
