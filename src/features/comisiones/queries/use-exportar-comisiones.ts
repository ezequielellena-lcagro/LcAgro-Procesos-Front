import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { downloadBlob, filenameFromContentDisposition } from "@/shared/export/download-blob";
import type { ComisionesFiltros } from "../types";

type ExportFiltros = Pick<ComisionesFiltros, "anio" | "mes" | "vendNro" | "q">;

function nombrePorDefecto(anio: number, mes: number): string {
  const mm = String(mes).padStart(2, "0");
  return `COMISIONES_VENDEDORES_${mm}_${anio}.xlsx`;
}

/**
 * Descarga el listado completo del período (todos los filtros, sin paginar) como .xlsx generado
 * por el backend. El toast de error lo maneja el MutationCache global.
 */
export function useExportarComisiones() {
  return useMutation({
    mutationFn: async (filtros: ExportFiltros) => {
      const res = await apiClient.get("/comisiones/export", {
        params: {
          anio: filtros.anio,
          mes: filtros.mes,
          vendNro: filtros.vendNro,
          q: filtros.q || undefined,
        },
        responseType: "blob",
      });
      const filename = filenameFromContentDisposition(
        res.headers["content-disposition"],
        nombrePorDefecto(filtros.anio, filtros.mes),
      );
      downloadBlob(res.data as Blob, filename);
    },
  });
}
