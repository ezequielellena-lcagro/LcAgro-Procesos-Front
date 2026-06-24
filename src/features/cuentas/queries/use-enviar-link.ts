import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

export function useResolverContacto() {
  return useMutation({
    mutationFn: async (vendNro: number) => {
      const { data } = await apiClient.get<{ vendNro: number; vendedor: string; email: string | null }>(
        `/cuentas/vendedores/${vendNro}/contacto`,
      );
      return data;
    },
  });
}

export function useEnviarLink() {
  return useMutation({
    mutationFn: async (input: { vendNro: number; email: string }) => {
      const { data } = await apiClient.post<{ url: string; expiraUtc: string }>("/cuentas/link", input);
      return data;
    },
    onSuccess: () => toast.success("Link enviado al vendedor."),
  });
}
