import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { downloadBlob, filenameFromContentDisposition } from "@/shared/export/download-blob";

/**
 * Reporte para imprimir: la planilla de siempre + el resumen banco × mes.
 *
 * Es la única salida a Excel que queda. Había también una plantilla de ida y vuelta para cargar
 * préstamos desde el archivo; se quitó, porque el alta va a mano o desde el panel de MacroGest,
 * que es donde el dato nace.
 */
export function useExportarReporte() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.get("/prestamos/export", { responseType: "blob" });
      downloadBlob(
        res.data as Blob,
        filenameFromContentDisposition(res.headers["content-disposition"], "Prestamos.xlsx"),
      );
    },
  });
}
