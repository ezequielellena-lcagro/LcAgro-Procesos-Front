import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type {
  GuardarObjetivosRequest,
  GuardarObjetivosVendedoresRequest,
  TableroAcopioDto,
} from "../types";

export const tableroAcopioKeys = {
  all: ["tablero-acopio"] as const,
  tablero: () => [...tableroAcopioKeys.all, "tablero"] as const,
};

/**
 * El tablero completo. Se recalcula al entrar (el back guarda unos minutos la lectura de MacroGest);
 * `refrescar` la fuerza: es lo que hace el botón Actualizar.
 */
export function useTableroAcopio() {
  return useQuery({
    queryKey: tableroAcopioKeys.tablero(),
    queryFn: async () => {
      const { data } = await apiClient.get<TableroAcopioDto>("/acopio/tablero");
      return data;
    },
    staleTime: 0,
  });
}

export function useRefrescarTablero() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get<TableroAcopioDto>("/acopio/tablero", {
        params: { refrescar: true },
      });
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(tableroAcopioKeys.tablero(), data);
      toast.success("Tablero actualizado con los datos de MacroGest.");
    },
  });
}

export function useGuardarObjetivos(campania: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: GuardarObjetivosRequest) => {
      await apiClient.put(`/acopio/tablero/objetivos/${campania}`, req);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tableroAcopioKeys.all });
      toast.success(`Objetivos de ${campania} guardados.`);
    },
  });
}

export function useRestablecerObjetivos(campania: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/acopio/tablero/objetivos/${campania}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tableroAcopioKeys.all });
      toast.success(`${campania} vuelve a los objetivos por defecto.`);
    },
  });
}

export function useGuardarObjetivosVendedores(campania: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: GuardarObjetivosVendedoresRequest) => {
      await apiClient.put(`/acopio/tablero/objetivos/${campania}/vendedores`, req);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tableroAcopioKeys.all });
      // El objetivo por vendedor es el mismo de Volumen acopiado: que esa pantalla también lo vea.
      qc.invalidateQueries({ queryKey: ["volumen-acopiado"] });
      toast.success("Objetivos por vendedor guardados.");
    },
  });
}
