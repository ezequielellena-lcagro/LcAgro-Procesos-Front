import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { downloadBlob, filenameFromContentDisposition } from "@/shared/export/download-blob";
import type { MovimientoFiltros, OrdenCargaFiltros, StockFiltros } from "../types";

/**
 * Un hook por listado (R7.2): cada uno tipa sus propios filtros en vez de un `params: object`
 * genérico. Los tres van por axios y no por un `<a href>` para que viaje el JWT.
 */
export function useExportarStock() {
  return useMutation({
    mutationFn: async (filtros: StockFiltros) => {
      const res = await apiClient.get("/semillero/stock/excel", { params: filtros, responseType: "blob" });
      downloadBlob(
        res.data as Blob,
        filenameFromContentDisposition(res.headers["content-disposition"], "Semillero_Stock.xlsx"),
      );
    },
  });
}

export function useExportarMovimientos() {
  return useMutation({
    mutationFn: async (filtros: MovimientoFiltros) => {
      const res = await apiClient.get("/semillero/movimientos/excel", { params: filtros, responseType: "blob" });
      downloadBlob(
        res.data as Blob,
        filenameFromContentDisposition(res.headers["content-disposition"], "Semillero_Movimientos.xlsx"),
      );
    },
  });
}

export function useExportarOrdenes() {
  return useMutation({
    mutationFn: async (filtros: OrdenCargaFiltros) => {
      const res = await apiClient.get("/semillero/ordenes/excel", { params: filtros, responseType: "blob" });
      downloadBlob(
        res.data as Blob,
        filenameFromContentDisposition(res.headers["content-disposition"], "Semillero_Ordenes.xlsx"),
      );
    },
  });
}
