import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { downloadBlob, filenameFromContentDisposition } from "@/shared/export/download-blob";
import type { ImportacionPrestamos, PrestamoFiltros } from "../types";
import { prestamosKeys } from "./keys";

/**
 * Plantilla de ida y vuelta (Operaciones + Cuotas + Listas): se edita en Excel y se reimporta.
 * Es la vía de carga masiva.
 */
export function useExportarPlantilla() {
  return useMutation({
    mutationFn: async (filtros: PrestamoFiltros) => {
      const res = await apiClient.get("/prestamos/plantilla", {
        params: filtros,
        responseType: "blob",
      });
      downloadBlob(
        res.data as Blob,
        filenameFromContentDisposition(
          res.headers["content-disposition"],
          "Prestamos - plantilla.xlsx",
        ),
      );
    },
  });
}

/** Reporte para imprimir: la planilla de siempre + el resumen banco × mes. */
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

/**
 * Sube la plantilla. Con `confirmar: false` el backend valida y devuelve qué HARÍA sin escribir
 * nada — es la vista previa que se muestra antes de aplicar. La importación es todo o nada: si
 * una fila está mal, no se guarda ninguna.
 */
export function useImportarPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silentError: true }, // el diálogo muestra el detalle con hoja y fila
    mutationFn: async ({ file, confirmar }: { file: File; confirmar: boolean }) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await apiClient.post<ImportacionPrestamos>("/prestamos/import", form, {
        params: { confirmar },
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: (r) => {
      if (!r.confirmado) return; // la vista previa no cambió nada: no hay qué refrescar ni anunciar
      qc.invalidateQueries({ queryKey: prestamosKeys.all });
      toast.success(
        `Importado: ${r.operacionesCreadas} operación(es) nueva(s), ` +
          `${r.operacionesActualizadas} actualizada(s), ${r.cuotasCargadas} cuota(s).`,
      );
      for (const aviso of r.advertencias) toast.warning(aviso);
    },
  });
}
