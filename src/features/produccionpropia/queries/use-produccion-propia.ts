import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { downloadBlob, filenameFromContentDisposition } from "@/shared/export/download-blob";
import type { ProduccionPropiaDto, SaldoCuentaRequest } from "../types";
import { produccionPropiaKeys } from "./keys";

/** Campañas con contratos de producción propia (para el selector). */
export function useCampaniasProduccionPropia() {
  return useQuery({
    queryKey: produccionPropiaKeys.campanias(),
    queryFn: async () => {
      const { data } = await apiClient.get<string[]>("/produccion-propia/campanias");
      return data;
    },
    staleTime: 30 * 60_000, // las campañas casi no cambian
  });
}

/** La posición de una campaña. */
export function useProduccionPropia(campania: string | undefined) {
  return useQuery({
    queryKey: produccionPropiaKeys.reporte(campania),
    queryFn: async () => {
      const { data } = await apiClient.get<ProduccionPropiaDto>("/produccion-propia", {
        params: campania ? { campania } : undefined,
      });
      return data;
    },
    enabled: campania !== undefined,
    placeholderData: (prev) => prev, // no parpadear al cambiar de campaña
  });
}

/** Descarga el reporte en .xlsx generado por el backend. */
export function useProduccionPropiaExport() {
  return useMutation({
    mutationFn: async (campania: string | undefined) => {
      const res = await apiClient.get("/produccion-propia/export", {
        params: campania ? { campania } : undefined,
        responseType: "blob",
      });
      const filename = filenameFromContentDisposition(
        res.headers["content-disposition"],
        `Produccion_Propia_${campania ?? ""}.xlsx`,
      );
      downloadBlob(res.data as Blob, filename);
    },
  });
}

/** Carga (o actualiza) el saldo de cuenta corriente 32 de un cereal. */
export function useGuardarSaldoCuenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: SaldoCuentaRequest) => {
      await apiClient.put("/produccion-propia/saldo-cuenta", req);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: produccionPropiaKeys.all }),
  });
}
