import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  AnalisisVendedorDto,
  ObjetivoRequest,
  SeguimientoVendedorDto,
  VolumenAcopiadoDto,
} from "../types";

export const volumenAcopiadoKeys = {
  all: ["volumen-acopiado"] as const,
  resumen: (campania: string | undefined) => [...volumenAcopiadoKeys.all, "resumen", campania] as const,
  vendedor: (vendedor: string | undefined, campania: string | undefined) =>
    [...volumenAcopiadoKeys.all, "vendedor", vendedor, campania] as const,
  seguimiento: (vendedor: string | undefined, campania: string | undefined) =>
    [...volumenAcopiadoKeys.all, "seguimiento", vendedor, campania] as const,
};

/** Resumen de la campaña: ranking, series y efecto de la planta alquilada. */
export function useVolumenAcopiado(campania: string | undefined) {
  return useQuery({
    queryKey: volumenAcopiadoKeys.resumen(campania),
    queryFn: async () => {
      const { data } = await apiClient.get<VolumenAcopiadoDto>("/volumen-acopiado", {
        params: campania ? { campania } : undefined,
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

/** Análisis de la cartera de un vendedor. Solo corre con un vendedor elegido. */
export function useAnalisisVendedor(vendedor: string | undefined, campania: string | undefined) {
  return useQuery({
    queryKey: volumenAcopiadoKeys.vendedor(vendedor, campania),
    queryFn: async () => {
      const { data } = await apiClient.get<AnalisisVendedorDto>("/volumen-acopiado/vendedor", {
        params: { vendedor, ...(campania ? { campania } : {}) },
      });
      return data;
    },
    enabled: !!vendedor,
  });
}

/**
 * Arma el mail de seguimiento SIN enviarlo. Se pide siempre fresco (`staleTime: 0`): lo que se
 * previsualiza tiene que ser lo que se manda.
 */
export function useSeguimiento(vendedor: string | undefined, campania: string | undefined) {
  return useQuery({
    queryKey: volumenAcopiadoKeys.seguimiento(vendedor, campania),
    queryFn: async () => {
      const { data } = await apiClient.get<SeguimientoVendedorDto>("/volumen-acopiado/seguimiento", {
        params: { vendedor, ...(campania ? { campania } : {}) },
      });
      return data;
    },
    enabled: !!vendedor,
    staleTime: 0,
  });
}

/** Envía el mail de seguimiento. Acción no reversible: el diálogo la confirma. */
export function useEnviarSeguimiento() {
  return useMutation({
    mutationFn: async (req: { vendedor: string; campania: string; email: string }) => {
      await apiClient.post("/volumen-acopiado/seguimiento", req);
    },
  });
}

/** Guarda el objetivo acordado de un vendedor. */
export function useGuardarObjetivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: ObjetivoRequest) => {
      await apiClient.put("/volumen-acopiado/objetivo", req);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: volumenAcopiadoKeys.all }),
  });
}
