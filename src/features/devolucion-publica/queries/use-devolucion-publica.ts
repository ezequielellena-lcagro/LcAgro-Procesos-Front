import { useQuery } from "@tanstack/react-query";
import { publicApiClient } from "@/lib/public-api-client";
import type { DevolucionPortal } from "../types";

export function useDevolucionPublica(token: string) {
  return useQuery({
    queryKey: ["devolucion-publica", token],
    queryFn: async () => {
      const { data } = await publicApiClient.get<DevolucionPortal>(`/devolucion/${token}`);
      return data;
    },
    retry: false,
  });
}
