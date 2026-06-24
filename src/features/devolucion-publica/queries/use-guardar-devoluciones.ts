import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { publicApiClient } from "@/lib/public-api-client";

interface Item { cuenta: number; devolucion: string | null }

export function useGuardarDevoluciones(token: string) {
  return useMutation({
    mutationFn: async (items: Item[]) => {
      const { data } = await publicApiClient.put<{ actualizadas: number }>(`/devolucion/${token}`, { items });
      return data;
    },
    onSuccess: (r) => toast.success(`Guardado: ${r.actualizadas} devolución(es).`),
    onError: () => toast.error("No se pudo guardar. El link puede haber vencido."),
  });
}
