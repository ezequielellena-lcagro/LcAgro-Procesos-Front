import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { cuentasKeys } from "./keys";

export interface ImportacionResultado {
  filasLeidas: number;
  cuentasActualizadas: number;
  sinCambios: number;
  advertencias: string[];
}

/**
 * Sube el .xlsx completado por los vendedores. El backend solo pisa los campos que vienen con dato
 * (las celdas vacías no tocan lo ya cargado). Al terminar, refresca el listado y avisa el resumen.
 */
export function useImportarCuentas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await apiClient.post<ImportacionResultado>("/cuentas/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: cuentasKeys.lists() });
      toast.success(
        `Importación lista: ${r.cuentasActualizadas} cuenta(s) actualizada(s) de ${r.filasLeidas} leída(s).`,
      );
    },
  });
}
