import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  ControlPadron, SucursalComercial, UsuarioAsignable, VendedorComercial,
  VendedorRequest, ViajanteAsignable,
} from "../types";
import { planificacionKeys } from "./keys";

export function useSucursales(habilitado: boolean) {
  return useQuery({
    queryKey: planificacionKeys.sucursales(),
    queryFn: async () =>
      (await apiClient.get<SucursalComercial[]>("/planificacion-ventas/sucursales")).data,
    enabled: habilitado,
  });
}

export function useViajantesMacroGest(habilitado: boolean) {
  return useQuery({
    queryKey: planificacionKeys.viajantes(),
    queryFn: async () =>
      (await apiClient.get<ViajanteAsignable[]>("/planificacion-ventas/viajantes-macrogest")).data,
    enabled: habilitado,
  });
}

export function useUsuariosAsignables(habilitado: boolean) {
  return useQuery({
    queryKey: planificacionKeys.usuariosAsignables(),
    queryFn: async () =>
      (await apiClient.get<UsuarioAsignable[]>("/planificacion-ventas/usuarios-asignables")).data,
    enabled: habilitado,
  });
}

export function useControlPadron(campania: string, habilitado: boolean) {
  return useQuery({
    queryKey: planificacionKeys.controlPadron(campania),
    queryFn: async () =>
      (await apiClient.get<ControlPadron>("/planificacion-ventas/control-padron", {
        params: { campania },
      })).data,
    enabled: habilitado && !!campania,
  });
}

function invalidarCatalogo(queryClient: ReturnType<typeof useQueryClient>) {
  for (const recurso of ["vendedores", "sucursales", "viajantes-macrogest", "usuarios-asignables", "contexto",
    "control-padron", "plan-siembra", "consolidado"]) {
    const key = [...planificacionKeys.all, recurso];
    void queryClient.invalidateQueries({ queryKey: key, refetchType: "active" });
    queryClient.removeQueries({ queryKey: key, type: "inactive" });
  }
}

export function useGuardarSucursal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nombre, activa }: { id?: number; nombre: string; activa: boolean }) =>
      id === undefined
        ? (await apiClient.post<SucursalComercial>("/planificacion-ventas/sucursales",
          { nombre, activa })).data
        : (await apiClient.put<SucursalComercial>("/planificacion-ventas/sucursales/" + id,
          { nombre, activa })).data,
    onSuccess: () => invalidarCatalogo(queryClient),
  });
}

export function useGuardarVendedor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, request }: { id?: number; request: VendedorRequest }) =>
      id === undefined
        ? (await apiClient.post<VendedorComercial>("/planificacion-ventas/vendedores", request)).data
        : (await apiClient.put<VendedorComercial>("/planificacion-ventas/vendedores/" + id,
          request)).data,
    onSuccess: () => invalidarCatalogo(queryClient),
  });
}

export function useCambiarActivoVendedor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, activo }: { id: number; activo: boolean }) =>
      (await apiClient.put<VendedorComercial>(
        "/planificacion-ventas/vendedores/" + id + "/activo", { activo })).data,
    onSuccess: () => invalidarCatalogo(queryClient),
  });
}
