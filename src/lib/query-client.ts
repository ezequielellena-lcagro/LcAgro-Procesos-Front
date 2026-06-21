import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toAppError } from "./api-error";

// Toasts globales de error: toda query/mutation que falle avisa, salvo que marque meta.silentError
// (p. ej. un form que mapea errores por campo). El 401 lo gestiona el flujo de auth, no un toast.
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.silentError) return;
      const e = toAppError(error);
      if (e.status === 401) return;
      toast.error(e.message);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.meta?.silentError) return;
      const e = toAppError(error);
      if (e.status === 401) return;
      toast.error(e.message);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        const e = toAppError(error);
        if (e.status >= 400 && e.status < 500) return false; // negocio/auth: no reintentar
        return failureCount < 2; // 5xx / red: hasta 2 reintentos
      },
      refetchOnWindowFocus: false, // datos contables: no recargar al volver al tab
    },
    mutations: {
      retry: false,
    },
  },
});
