import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type {
  AjusteInput,
  AnularOrdenInput,
  DespacharOrdenInput,
  IngresoInput,
  LoteAltaInput,
  LoteDatosInput,
  LoteDto,
  OrdenCargaDto,
  OrdenCargaInput,
  ReubicacionInput,
  UbicacionDto,
  UbicacionInput,
  VariedadDto,
  VariedadInput,
  EspecieDto,
} from "../types";
import { semilleroKeys } from "./keys";

/**
 * Toda escritura de este módulo mueve stock, órdenes, movimientos y KPIs a la vez (un despacho, por
 * ejemplo, cambia las cuatro cosas). El universo es chico (una sola planta): invalidar todo es una
 * línea y no deja nada viejo, en vez de mantener una lista de qué invalida qué.
 */
function useInvalidarTodo() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: semilleroKeys.all });
}

/** Los formularios muestran el error de validación ellos mismos (silentError); el éxito avisa con un toast. */
function useEscritura<TInput, TResult>(
  enviar: (input: TInput) => Promise<TResult>,
  exito: (resultado: TResult) => string,
) {
  const invalidar = useInvalidarTodo();
  return useMutation({
    meta: { silentError: true },
    mutationFn: enviar,
    onSuccess: (resultado) => {
      invalidar();
      toast.success(exito(resultado));
    },
  });
}

// ── Lotes (R3.1-R3.4) ────────────────────────────────────────────────────

export const useCrearLote = () =>
  useEscritura(
    async (input: LoteAltaInput) => (await apiClient.post<LoteDto>("/semillero/lotes", input)).data,
    (lote) => `Lote ${lote.codigo} cargado.`,
  );

export const useActualizarLote = () =>
  useEscritura(
    async ({ id, ...input }: LoteDatosInput & { id: number }) =>
      (await apiClient.put<LoteDto>(`/semillero/lotes/${id}`, input)).data,
    (lote) => `Lote ${lote.codigo} guardado.`,
  );

// ── Movimientos (R5.1-R5.3) ──────────────────────────────────────────────

/** Ingreso inicial (parte del alta de lote) o adicional a un lote existente (decisión #2 de la fase). */
export const useRegistrarIngreso = () =>
  useEscritura(
    async (input: IngresoInput) => {
      await apiClient.post("/semillero/movimientos/ingreso", input);
    },
    () => "Ingreso registrado.",
  );

/** `cantidad` va con signo (R5.2); el backend valida además el signo permitido según el motivo. */
export const useRegistrarAjuste = () =>
  useEscritura(
    async (input: AjusteInput) => {
      await apiClient.post("/semillero/movimientos/ajuste", input);
    },
    () => "Ajuste registrado.",
  );

export const useReubicar = () =>
  useEscritura(
    async (input: ReubicacionInput) => {
      await apiClient.post("/semillero/movimientos/reubicacion", input);
    },
    () => "Reubicación registrada.",
  );

// ── Órdenes de carga (R6.1-R6.6) ─────────────────────────────────────────

export const useCrearOrden = () =>
  useEscritura(
    async (input: OrdenCargaInput) => (await apiClient.post<OrdenCargaDto>("/semillero/ordenes", input)).data,
    (orden) => `Orden N° ${orden.numero} creada.`,
  );

export const useActualizarOrden = () =>
  useEscritura(
    async ({ id, ...input }: OrdenCargaInput & { id: number }) =>
      (await apiClient.put<OrdenCargaDto>(`/semillero/ordenes/${id}`, input)).data,
    (orden) => `Orden N° ${orden.numero} guardada.`,
  );

export const useDespacharOrden = () =>
  useEscritura(
    async ({ id, ...input }: DespacharOrdenInput & { id: number }) =>
      (await apiClient.post<OrdenCargaDto>(`/semillero/ordenes/${id}/despachar`, input)).data,
    (orden) => `Orden N° ${orden.numero} despachada.`,
  );

export const useAnularOrden = () =>
  useEscritura(
    async ({ id, ...input }: AnularOrdenInput & { id: number }) =>
      (await apiClient.post<OrdenCargaDto>(`/semillero/ordenes/${id}/anular`, input)).data,
    (orden) => `Orden N° ${orden.numero} anulada.`,
  );

// ── Catálogos: variedades y ubicaciones (R1.1/R1.2) ──────────────────────

export const useSincronizarEspecies = () =>
  useEscritura(
    async () => (await apiClient.post<EspecieDto[]>("/semillero/catalogos/especies/sincronizar")).data,
    () => "Especies actualizadas desde MacroGest.",
  );

export const useGuardarVariedad = () =>
  useEscritura(
    async ({ id, ...input }: VariedadInput & { id?: number }) =>
      id
        ? (await apiClient.put<VariedadDto>(`/semillero/catalogos/variedades/${id}`, input)).data
        : (await apiClient.post<VariedadDto>("/semillero/catalogos/variedades", input)).data,
    (variedad) => (variedad.activo ? `${variedad.nombre} guardada.` : `${variedad.nombre} quedó desactivada.`),
  );

export const useGuardarUbicacion = () =>
  useEscritura(
    async ({ id, ...input }: UbicacionInput & { id?: number }) =>
      id
        ? (await apiClient.put<UbicacionDto>(`/semillero/catalogos/ubicaciones/${id}`, input)).data
        : (await apiClient.post<UbicacionDto>("/semillero/catalogos/ubicaciones", input)).data,
    (ubicacion) => (ubicacion.activo ? `${ubicacion.codigo} guardada.` : `${ubicacion.codigo} quedó desactivada.`),
  );
