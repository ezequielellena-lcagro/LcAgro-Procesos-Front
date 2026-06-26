import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { downloadBlob, filenameFromContentDisposition } from "@/shared/export/download-blob";
import type { StockFiltros } from "../types";

type ExportFiltros = Pick<StockFiltros, "deposito" | "rubro" | "q" | "ventanaDias">;

function nombrePorDefecto(): string {
  const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `Stock_Insumos_${hoy}.xlsx`;
}

/**
 * Descarga el listado completo (todos los filtros, sin paginar) como .xlsx generado por el backend
 * (Excel jerárquico Depósito→Rubro→Artículo con subtotales). El toast de error lo maneja el
 * MutationCache global.
 */
export function useStockExport() {
  return useMutation({
    mutationFn: async (filtros: ExportFiltros) => {
      const res = await apiClient.get("/stock/export", {
        params: {
          deposito: filtros.deposito.length ? filtros.deposito : undefined,
          rubro: filtros.rubro.length ? filtros.rubro : undefined,
          q: filtros.q || undefined,
          ventanaDias: filtros.ventanaDias,
        },
        responseType: "blob",
        paramsSerializer: { indexes: null },
      });
      const filename = filenameFromContentDisposition(
        res.headers["content-disposition"],
        nombrePorDefecto(),
      );
      downloadBlob(res.data as Blob, filename);
    },
  });
}
