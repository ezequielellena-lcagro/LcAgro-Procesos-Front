import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type { ObservacionInput } from "../types";
import { cuentasKeys } from "./keys";

export function useGuardarObservacion() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silentError: true }, // el form mapea errores por campo
    mutationFn: async ({ cuenta, devolucion, observaciones }: ObservacionInput) => {
      await apiClient.put(`/cuentas/${cuenta}/observacion`, { devolucion, observaciones });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cuentasKeys.lists() });
      toast.success("Observación guardada.");
    },
  });
}
