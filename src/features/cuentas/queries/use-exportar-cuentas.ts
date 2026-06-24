import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { downloadBlob, filenameFromContentDisposition } from "@/shared/export/download-blob";
import type { CuentasFiltros } from "../types";

type ExportFiltros = Pick<CuentasFiltros, "q" | "vendNro" | "minUsd">;

function nombrePorDefecto(): string {
  const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `Cuentas_Clientes_${hoy}.xlsx`;
}

/**
 * Descarga el listado completo (todos los filtros, sin paginar) como .xlsx generado por el backend
 * (formato fiel: subtotales por vendedor, total general). Reemplaza el armado client-side, que solo
 * incluía la página visible. El toast de error lo maneja el MutationCache global.
 */
export function useExportarCuentas() {
  return useMutation({
    mutationFn: async (filtros: ExportFiltros) => {
      const res = await apiClient.get("/cuentas/export", {
        params: {
          q: filtros.q || undefined,
          vendNro: filtros.vendNro,
          minUsd: filtros.minUsd,
        },
        responseType: "blob",
      });
      const filename = filenameFromContentDisposition(
        res.headers["content-disposition"],
        nombrePorDefecto(),
      );
      downloadBlob(res.data as Blob, filename);
    },
  });
}
