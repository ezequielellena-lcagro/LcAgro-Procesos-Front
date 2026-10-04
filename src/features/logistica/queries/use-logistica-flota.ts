import { useDetalle, useListado } from "./use-logistica";
import type { FichaFlotaDto, FichaFlotaVersionDto, FiltrosFlota } from "../types";

export function useFlota(filtros: FiltrosFlota, aplicacion = 0) {
  return useListado<FichaFlotaDto>("flota", filtros, (ultima) => ({ despuesId: ultima.id }), true, {
    aplicacion,
  });
}
export function useFichaFlota(id: string, enabled = false) {
  return useDetalle<FichaFlotaDto>("flota/" + id, {}, enabled);
}
export function useVersionFichaFlota(id: string, versionId: string, enabled: boolean) {
  return useDetalle<FichaFlotaVersionDto>("flota/" + id + "/versiones/" + versionId, {}, enabled);
}
