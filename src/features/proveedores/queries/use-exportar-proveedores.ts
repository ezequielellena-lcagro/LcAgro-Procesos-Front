import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { downloadBlob, filenameFromContentDisposition } from "@/shared/export/download-blob";
import type { ProveedoresFiltros } from "../types";

type ExportFiltros = Pick<ProveedoresFiltros, "anio" | "mes" | "proveedor" | "q">;

/** Fallback si el backend no manda Content-Disposition. El nombre oficial lo arma el service. */
function nombrePorDefecto(): string {
  const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `Proyeccion_Proveedores_${hoy}.xlsx`;
}

/**
 * Descarga el listado completo (mismos filtros, SIN paginar) como .xlsx generado por el backend.
 * Va por axios con responseType blob para que el interceptor le ponga el Bearer: un <a href> plano
 * no llevaría el JWT. El toast de error lo maneja el MutationCache global.
 */
export function useExportarProveedores() {
  return useMutation({
    mutationFn: async (filtros: ExportFiltros) => {
      const res = await apiClient.get("/proveedores/export", {
        params: {
          anio: filtros.anio,
          mes: filtros.mes,
          proveedor: filtros.proveedor,
          q: filtros.q || undefined,
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
