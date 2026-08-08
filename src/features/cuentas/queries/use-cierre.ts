import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { downloadBlob, filenameFromContentDisposition } from "@/shared/export/download-blob";
import { mesAnio } from "@/shared/format/format";
import type { CierreDetalle, CierreEstado, CierrePeriodo, CierreResultado } from "../types";
import { cuentasKeys } from "./keys";

/** Estado del cierre: período en curso + si ya terminó y falta cerrarlo. GET /cuentas/cierre/estado. */
export function useCierreEstado() {
  return useQuery({
    queryKey: cuentasKeys.cierreEstado(),
    queryFn: async () => {
      const { data } = await apiClient.get<CierreEstado>("/cuentas/cierre/estado");
      return data;
    },
  });
}

/** Períodos ya cerrados (más nuevo primero), para el selector. GET /cuentas/cierre/periodos. */
export function useCierrePeriodos() {
  return useQuery({
    queryKey: cuentasKeys.cierrePeriodos(),
    queryFn: async () => {
      const { data } = await apiClient.get<CierrePeriodo[]>("/cuentas/cierre/periodos");
      return data;
    },
  });
}

/**
 * Foto de un período cerrado. `enabled` evita pegarle a la API antes de que haya un mes elegido.
 * GET /cuentas/cierre/{anio}/{mes}.
 */
export function useCierrePeriodo(anio: number | undefined, mes: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: cuentasKeys.cierrePeriodo(anio ?? 0, mes ?? 0),
    queryFn: async () => {
      const { data } = await apiClient.get<CierreDetalle>(`/cuentas/cierre/${anio}/${mes}`);
      return data;
    },
    enabled: enabled && anio !== undefined && mes !== undefined,
  });
}

/**
 * Cierra el mes en curso (idempotente; de paso cierra meses terminados que faltaran). Al éxito
 * invalida las tres queries de cierre (estado, períodos y detalles) y avisa qué mes quedó cerrado.
 * POST /cuentas/cierre.
 */
export function useCerrarMes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<CierreResultado>("/cuentas/cierre");
      return data;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: cuentasKeys.cierre() });
      toast.success(`Mes cerrado: ${mesAnio(r.anio, r.mes)} · ${r.cuentas} cuentas.`);
    },
  });
}

/**
 * Descarga la foto de un período como .xlsx generado por el backend (patrón de useExportarCuentas:
 * responseType blob + downloadBlob). El toast de error lo maneja el MutationCache global.
 * GET /cuentas/cierre/{anio}/{mes}/export.
 */
export function useExportarCierre() {
  return useMutation({
    mutationFn: async ({ anio, mes }: { anio: number; mes: number }) => {
      const res = await apiClient.get(`/cuentas/cierre/${anio}/${mes}/export`, { responseType: "blob" });
      const fallback = `Cierre_${anio}${String(mes).padStart(2, "0")}.xlsx`;
      const filename = filenameFromContentDisposition(res.headers["content-disposition"], fallback);
      downloadBlob(res.data as Blob, filename);
    },
  });
}
