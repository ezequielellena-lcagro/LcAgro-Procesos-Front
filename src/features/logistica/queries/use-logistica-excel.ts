import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { apiClient } from "@/lib/api-client";
import { downloadBlob, filenameFromContentDisposition } from "@/shared/export/download-blob";
import type { Periodo } from "../types";

export type FiltrosExcelLogistica = Periodo & {
  contrato?: string;
  clienteNumero?: string | number;
  producto?: string | number;
  campania?: string;
  destinoCodigo?: string | number;
  circuito?: string;
  estadoObservado?: string;
  anulados: boolean;
};
async function leerBlob(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") return blob.text();
  // FileReader permite leer Blob en navegadores anteriores y en el entorno DOM de pruebas.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}
export function useLogisticaExcel() {
  const enCurso = useRef(false);
  const mutation = useMutation({
    meta: { silentError: true },
    retry: false,
    mutationFn: async (filtros: FiltrosExcelLogistica) => {
      // Lista cerrada: no pasan cursores, tamaño ni estado de las páginas cargadas.
      const {
        desde,
        hastaExclusivo,
        contrato,
        clienteNumero,
        producto,
        campania,
        destinoCodigo,
        circuito,
        estadoObservado,
        anulados,
      } = filtros;
      try {
        const response = await apiClient.get<Blob>("/logistica/seguimientos/excel", {
          params: {
            desde,
            hastaExclusivo,
            contrato,
            clienteNumero,
            producto,
            campania,
            destinoCodigo,
            circuito,
            estadoObservado,
            anulados,
          },
          responseType: "blob",
          timeout: 90_000,
        });
        const fallback = `seguimientos-logistica-${desde.replaceAll("-", "")}-${hastaExclusivo.replaceAll("-", "")}.xlsx`;
        downloadBlob(
          response.data,
          filenameFromContentDisposition(response.headers["content-disposition"], fallback),
        );
      } catch (error) {
        if (isAxiosError(error) && error.response?.data instanceof Blob) {
          try {
            error.response.data = JSON.parse(await leerBlob(error.response.data));
          } catch {
            /* Conserva el patrón AppError si no se recibió ProblemDetails válido. */
          }
        }
        throw error;
      }
    },
  });
  return {
    ...mutation,
    exportar: (filtros: FiltrosExcelLogistica) => {
      if (enCurso.current) return;
      enCurso.current = true;
      mutation.mutate(
        { ...filtros },
        {
          onSettled: () => {
            enCurso.current = false;
          },
        },
      );
    },
  };
}
