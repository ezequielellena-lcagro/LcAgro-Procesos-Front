import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { apiClient } from "@/lib/api-client";
import { downloadBlob, filenameFromContentDisposition } from "@/shared/export/download-blob";
import { MESES, type SemillaFiltros } from "../types";

function nombrePorDefecto(f: SemillaFiltros): string {
  const mes = MESES.find((m) => m.value === f.mes)?.label ?? f.mes;
  return `Ventas Informadas La Clementina ${mes} ${f.anio}.xlsx`;
}

/**
 * El endpoint responde el .xlsx como Blob; si falla (ej. ventas sin mapear), el cuerpo de error
 * TAMBIÉN es Blob → lo reconvertimos a ProblemDetails para que el toast global muestre el detalle real.
 */
async function reconvertirErrorBlob(err: unknown): Promise<never> {
  if (err instanceof AxiosError && err.response?.data instanceof Blob) {
    const texto = await err.response.data.text();
    try {
      err.response.data = JSON.parse(texto);
    } catch {
      err.response.data = { detail: texto || undefined };
    }
  }
  throw err;
}

/**
 * Descarga el Excel "Ventas Informadas" (formato Sembra) generado por el backend. El toast de error lo
 * maneja el MutationCache global; falla con mensaje claro si hay ventas sin mapear o no hay datos.
 */
export function useExportarSemilla() {
  return useMutation({
    mutationFn: async (filtros: SemillaFiltros) => {
      try {
        const res = await apiClient.get("/semilla/export", {
          params: { anio: filtros.anio, mes: filtros.mes, cultivo: filtros.cultivo },
          responseType: "blob",
        });
        const filename = filenameFromContentDisposition(
          res.headers["content-disposition"],
          nombrePorDefecto(filtros),
        );
        downloadBlob(res.data as Blob, filename);
      } catch (err) {
        await reconvertirErrorBlob(err);
      }
    },
  });
}
