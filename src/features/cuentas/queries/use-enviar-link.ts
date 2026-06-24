import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

export interface VendedorContacto {
  vendNro: number;
  vendedor: string;
  email: string | null;
  origen: "propia" | "macrogest" | "sin";
}

/** Vendedores con cuentas + su email resuelto (nuestro ?? MacroGest). Solo consulta cuando se abre el diálogo. */
export function useVendedores(enabled: boolean) {
  return useQuery({
    queryKey: ["cuentas", "vendedores"],
    queryFn: async () => {
      const { data } = await apiClient.get<VendedorContacto[]>("/cuentas/vendedores");
      return data;
    },
    enabled,
    staleTime: 60_000,
  });
}

/** Guarda/actualiza el email de un vendedor en la BD propia (sin enviar el link). */
export function useGuardarContacto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { vendNro: number; email: string }) => {
      const { data } = await apiClient.put<VendedorContacto>(
        `/cuentas/vendedores/${input.vendNro}/contacto`,
        { email: input.email },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cuentas", "vendedores"] });
      toast.success("Email del vendedor guardado.");
    },
  });
}

/** Genera y envía el link de devolución al vendedor seleccionado. */
export function useEnviarLink() {
  return useMutation({
    mutationFn: async (input: { vendNro: number; email: string }) => {
      const { data } = await apiClient.post<{ url: string; expiraUtc: string }>("/cuentas/link", input);
      return data;
    },
    onSuccess: () => toast.success("Link enviado al vendedor."),
  });
}
