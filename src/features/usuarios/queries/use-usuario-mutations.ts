import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type { ActualizarUsuarioInput, CrearUsuarioInput, UsuarioDto } from "../types";
import { usuariosKeys } from "./keys";

export function useCrearUsuario() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silentError: true },
    mutationFn: async (input: CrearUsuarioInput) => {
      const { data } = await apiClient.post<UsuarioDto>("/usuarios", input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: usuariosKeys.all });
      toast.success("Usuario creado.");
    },
  });
}

export function useEditarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silentError: true },
    mutationFn: async ({ id, input }: { id: number; input: ActualizarUsuarioInput }) => {
      const { data } = await apiClient.put<UsuarioDto>(`/usuarios/${id}`, input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: usuariosKeys.all });
      toast.success("Usuario actualizado.");
    },
  });
}

export function useEliminarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/usuarios/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: usuariosKeys.all });
      toast.success("Usuario desactivado.");
    },
  });
}
