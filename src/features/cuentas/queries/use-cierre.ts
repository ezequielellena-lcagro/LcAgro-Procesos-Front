import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { downloadBlob, filenameFromContentDisposition } from "@/shared/export/download-blob";
import { fecha, mesAnio } from "@/shared/format/format";
import type {
  CierreDetalle,
  CierreDiff,
  CierreEstado,
  CierrePeriodo,
  CierreResultado,
  CierreRevision,
} from "../types";
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
 * Foto de un período cerrado. `revision` undefined = la vigente. `enabled` evita pegarle a la API
 * antes de que haya un mes elegido. GET /cuentas/cierre/{anio}/{mes}.
 */
export function useCierrePeriodo(
  anio: number | undefined,
  mes: number | undefined,
  enabled: boolean,
  revision?: number,
) {
  return useQuery({
    queryKey: cuentasKeys.cierrePeriodo(anio ?? 0, mes ?? 0, revision),
    queryFn: async () => {
      const { data } = await apiClient.get<CierreDetalle>(`/cuentas/cierre/${anio}/${mes}`, {
        params: { revision },
      });
      return data;
    },
    enabled: enabled && anio !== undefined && mes !== undefined,
  });
}

/** Revisiones de un período (la vigente primero). GET /cuentas/cierre/{anio}/{mes}/revisiones. */
export function useCierreRevisiones(anio: number | undefined, mes: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: cuentasKeys.cierreRevisiones(anio ?? 0, mes ?? 0),
    queryFn: async () => {
      const { data } = await apiClient.get<CierreRevision[]>(`/cuentas/cierre/${anio}/${mes}/revisiones`);
      return data;
    },
    enabled: enabled && anio !== undefined && mes !== undefined,
  });
}

/**
 * Contrasta la foto vigente contra MacroGest al mismo corte: si algo difiere, son registraciones con
 * fecha retroactiva cargadas después del cierre. Es una consulta pesada, así que NO corre sola:
 * `enabled` la dispara solo cuando la usuaria aprieta "Verificar cambios".
 * GET /cuentas/cierre/{anio}/{mes}/diff.
 */
export function useCierreDiff(anio: number | undefined, mes: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: cuentasKeys.cierreDiff(anio ?? 0, mes ?? 0),
    queryFn: async () => {
      const { data } = await apiClient.get<CierreDiff>(`/cuentas/cierre/${anio}/${mes}/diff`);
      return data;
    },
    enabled: enabled && anio !== undefined && mes !== undefined,
    staleTime: 0,   // se consulta para decidir: siempre contra el estado actual de MacroGest
  });
}

/**
 * Re-fotografía un período ya cerrado como una revisión NUEVA (la anterior se conserva). Sin `corte`
 * usa el mismo de la revisión vigente, que es el caso normal tras detectar retroactivos.
 * POST /cuentas/cierre/{anio}/{mes}/revision.
 */
export function useRecerrarPeriodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ anio, mes, corte }: { anio: number; mes: number; corte?: string }) => {
      const { data } = await apiClient.post<CierreResultado>(
        `/cuentas/cierre/${anio}/${mes}/revision`,
        { corte: corte ?? null },
      );
      return data;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: cuentasKeys.cierre() });
      toast.success(
        `${mesAnio(r.anio, r.mes)}: nueva revisión ${r.revision} al ${fecha(r.corte)}. ` +
          "La anterior se conserva.",
      );
    },
  });
}

/**
 * Cierra el período abierto congelando los saldos al `corte` elegido (yyyy-MM-dd: la fecha del informe
 * que se presentó) y blanquea la carga de Devolución/Observaciones. Es el único punto que blanquea.
 * Al éxito invalida las queries de cierre y, como el listado en vivo se queda sin notas, también el
 * listado. POST /cuentas/cierre.
 */
export function useCerrarMes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (corte: string) => {
      const { data } = await apiClient.post<CierreResultado>("/cuentas/cierre", { corte });
      return data;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: cuentasKeys.cierre() });
      qc.invalidateQueries({ queryKey: cuentasKeys.lists() });
      toast.success(
        `Mes cerrado: ${mesAnio(r.anio, r.mes)} al ${fecha(r.corte)} · ${r.cuentas} cuentas.`,
      );
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
    mutationFn: async ({ anio, mes, revision }: { anio: number; mes: number; revision?: number }) => {
      const res = await apiClient.get(`/cuentas/cierre/${anio}/${mes}/export`, {
        responseType: "blob",
        params: { revision },
      });
      const fallback = `Cierre_${anio}${String(mes).padStart(2, "0")}.xlsx`;
      const filename = filenameFromContentDisposition(res.headers["content-disposition"], fallback);
      downloadBlob(res.data as Blob, filename);
    },
  });
}
