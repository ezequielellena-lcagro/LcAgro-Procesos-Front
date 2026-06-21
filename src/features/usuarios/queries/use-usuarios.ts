import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { UsuarioDto } from "../types";
import { usuariosKeys } from "./keys";

export function useUsuarios() {
  return useQuery({
    queryKey: usuariosKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get<UsuarioDto[]>("/usuarios");
      return data;
    },
  });
}

export function useRoles() {
  return useQuery({
    queryKey: usuariosKeys.roles(),
    queryFn: async () => {
      const { data } = await apiClient.get<string[]>("/usuarios/roles");
      return data;
    },
    staleTime: 60 * 60_000, // los roles no cambian
  });
}
