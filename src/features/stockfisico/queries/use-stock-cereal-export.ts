import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { downloadBlob, filenameFromContentDisposition } from "@/shared/export/download-blob";

function nombrePorDefecto(): string {
  const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `Stock_Fisico_Cereal_${hoy}.xlsx`;
}

/**
 * Descarga el reporte como .xlsx de 3 hojas (Consolidado · Planta 10 detalle · Alertas) generado por
 * el backend. El toast de error lo maneja el MutationCache global.
 */
export function useStockCerealExport() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.get("/stock-cereal/export", { responseType: "blob" });
      const filename = filenameFromContentDisposition(
        res.headers["content-disposition"],
        nombrePorDefecto(),
      );
      downloadBlob(res.data as Blob, filename);
    },
  });
}
