import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  AdministrarCatalogos,
  CatalogosPrestamos,
  PrestamoDetalleDto,
  PrestamoFiltros,
  PrestamoListadoDto,
  VencimientoFiltros,
  VencimientosDto,
} from "../types";
import { prestamosKeys } from "./keys";

/** Listado por operación (pestaña "Operaciones"). */
export function usePrestamos(filtros: PrestamoFiltros) {
  return useQuery({
    queryKey: prestamosKeys.list(filtros),
    queryFn: async () => {
      const { data } = await apiClient.get<PrestamoListadoDto[]>("/prestamos", { params: filtros });
      return data;
    },
    placeholderData: keepPreviousData, // cambiar de moneda sin parpadeo
  });
}

/** Calendario de vencimientos (pestaña "Vencimientos") — el equivalente a la planilla actual. */
export function useVencimientos(filtros: VencimientoFiltros) {
  return useQuery({
    queryKey: prestamosKeys.vencimiento(filtros),
    queryFn: async () => {
      const { data } = await apiClient.get<VencimientosDto>("/prestamos/vencimientos", {
        params: filtros,
      });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

/** Detalle con el cronograma completo. Se pide sólo cuando hay una operación abierta. */
export function usePrestamo(id: number | null) {
  return useQuery({
    queryKey: prestamosKeys.detalle(id ?? 0),
    queryFn: async () => {
      const { data } = await apiClient.get<PrestamoDetalleDto>(`/prestamos/${id}`);
      return data;
    },
    enabled: id !== null,
  });
}

/** Bancos y líneas para los desplegables. Cambian muy poco: se cachean por un rato largo. */
export function useCatalogosPrestamos() {
  return useQuery({
    queryKey: prestamosKeys.catalogos(),
    queryFn: async () => {
      const { data } = await apiClient.get<CatalogosPrestamos>("/prestamos/catalogos");
      return data;
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * La vista de administración: todos, con su estado y cuántos préstamos usan cada uno. Sin
 * `staleTime`: acá se está editando, y ver algo viejo es peor que un pedido de más.
 */
export function useCatalogosAdmin(habilitado: boolean) {
  return useQuery({
    queryKey: prestamosKeys.catalogosAdmin(),
    queryFn: async () => {
      const { data } = await apiClient.get<AdministrarCatalogos>("/prestamos/catalogos/administrar");
      return data;
    },
    enabled: habilitado,
  });
}
