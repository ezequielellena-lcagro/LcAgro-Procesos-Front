import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type { MapeoVariedadDto, MapeoVariedadInput } from "../types";
import { semillaKeys } from "./keys";

/** Crea/actualiza la equivalencia de un artículo (upsert por código). El form mapea el error. */
export function useGuardarMapeo() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silentError: true },
    mutationFn: async ({
      codigoArticulo,
      input,
    }: {
      codigoArticulo: number;
      input: MapeoVariedadInput;
    }) => {
      const { data } = await apiClient.put<MapeoVariedadDto>(`/semilla/mapeos/${codigoArticulo}`, input);
      return data;
    },
    onSuccess: () => {
      // Cambia el estado de mapeo de los artículos y de las ventas (variedad/categoría).
      qc.invalidateQueries({ queryKey: semillaKeys.all });
      toast.success("Mapeo guardado.");
    },
  });
}
