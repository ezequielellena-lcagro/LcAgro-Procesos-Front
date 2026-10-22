import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";
import { toAppError } from "@/lib/api-error";
import { apiClient } from "@/lib/api-client";
import { uuid } from "@/lib/uuid";
import type { Detalle, Evento, Pagina, Periodo, Referencia } from "../types";

export function useListado<T>(
  ruta: string,
  filtros: object,
  siguiente: (ultima: T) => object,
  enabled = true,
  paginaContexto?: object,
  tamano = 50,
) {
  return useInfiniteQuery({
    queryKey: ["logistica", ruta, filtros, { tamano }, ...(paginaContexto ? [paginaContexto] : [])],
    enabled,
    initialPageParam: {} as object,
    retry: false,
    queryFn: async ({ pageParam, signal }) =>
      (
        await apiClient.get<Pagina<T>>(`/logistica/${ruta}`, {
          params: { ...filtros, tamano, ...pageParam },
          signal,
        })
      ).data,
    getNextPageParam: (page) =>
      page.hayMas && page.filas.length ? siguiente(page.filas[page.filas.length - 1]) : undefined,
  });
}
export function useCatalogo(tipo: "clientes" | "productos" | "destinos" | "campanias", buscar = "") {
  return useListado<Referencia>(
    `catalogos/${tipo}`,
    { buscar: buscar.trim() || undefined },
    (r) => ({ despuesCodigo: r.codigo }),
    busquedaCatalogoValida(buscar),
  );
}
export function busquedaCatalogoValida(buscar: string) {
  const texto = buscar.trim();
  if (/^\d+$/.test(texto)) return Number(texto) >= 1 && Number(texto) <= 9999999999;
  return texto.length !== 1;
}
export function useHistoria(recurso: string, id: string) {
  return useListado<Evento>(`${recurso}/${id}/historial`, {}, (r) => ({
    despuesRevision: r.revision,
  }));
}
export function useDetalle<T>(ruta: string, params: object, enabled: boolean) {
  return useQuery({
    queryKey: ["logistica", ruta, params],
    enabled,
    retry: false,
    queryFn: async ({ signal }) =>
      (await apiClient.get<Detalle<T>>(`/logistica/${ruta}`, { params, signal })).data.dato,
  });
}
export function useDetalleConOrigen<T>(ruta: string, params: object, enabled: boolean) {
  return useQuery({
    queryKey: ["logistica", ruta, params, "con-origen"],
    enabled,
    retry: false,
    queryFn: async ({ signal }) =>
      (await apiClient.get<Detalle<T>>(`/logistica/${ruta}`, { params, signal })).data,
  });
}
export function useSeguimientoDetalle<T>(ruta: string) {
  return useQuery({
    queryKey: ["logistica", ruta, {}, "con-origen"],
    retry: false,
    refetchOnMount: "always",
    queryFn: async ({ signal }) =>
      (await apiClient.get<Detalle<T>>(`/logistica/${ruta}`, { signal })).data,
  });
}
export function useOperacion<T>(ruta: string, metodo: "post" | "put" = "post") {
  const queryClient = useQueryClient();
  const intento = useRef<{ cuerpo: string; clave: string } | null>(null);
  return useMutation({
    meta: { silentError: true },
    retry: false,
    mutationFn: async (body: object) => {
      const cuerpo = JSON.stringify(body);
      if (intento.current?.cuerpo !== cuerpo)
        intento.current = { cuerpo, clave: uuid() };
      return (
        await apiClient.request<T>({
          url: `/logistica/${ruta}`,
          method: metodo,
          data: body,
          headers: { "Idempotency-Key": intento.current.clave },
        })
      ).data;
    },
    onError: (e) => {
      if (toAppError(e).status === 409)
        void queryClient.invalidateQueries({ queryKey: ["logistica"] });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["logistica"] });
      toast.success("Operación guardada.");
    },
  });
}
export function cursorPropio(f: { id: string; fechaSolicitada: string }) {
  return { despuesFecha: f.fechaSolicitada, despuesId: f.id };
}
export function filtrosPeriodo(periodo: Periodo) {
  return periodo;
}
