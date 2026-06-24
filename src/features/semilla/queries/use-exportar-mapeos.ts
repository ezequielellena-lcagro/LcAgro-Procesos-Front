import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { downloadBlob, filenameFromContentDisposition } from "@/shared/export/download-blob";

/**
 * Descarga la plantilla .xlsx de mapeo (todos los artículos con su variedad/categoría confirmada o
 * sugerida), para curar offline y reimportar. El toast de error lo maneja el MutationCache global.
 */
export function useExportarMapeos() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.get("/semilla/mapeos/export", { responseType: "blob" });
      const filename = filenameFromContentDisposition(
        res.headers["content-disposition"],
        "Mapeo de variedades - semilla.xlsx",
      );
      downloadBlob(res.data as Blob, filename);
    },
  });
}
