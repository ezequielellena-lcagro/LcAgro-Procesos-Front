import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { cuentasKeys } from "./keys";

export interface ImportacionResultado {
  /** Cuentas del archivo que se tomaron: las del vendedor que lo completó. */
  cuentasImportadas: number;
  /** De las importadas, en cuántas cambió algún valor. */
  cuentasActualizadas: number;
  /** Filas con cuenta que tenía el archivo (incluye las de otros vendedores). */
  filasLeidas: number;
  /** Filas descartadas por venir ocultas del autofiltro: son de otros vendedores. */
  filasIgnoradas: number;
  /** Único vendedor visible en el archivo, si se pudo determinar. */
  vendedorDetectado: string | null;
}

export interface ImportarCuentasVars {
  file: File;
  /** Importar aunque el archivo tenga varios vendedores a la vista (la usuaria lo confirmó). */
  confirmarVariosVendedores: boolean;
}

/**
 * Sube el .xlsx completado por un vendedor. El backend se acota a las filas que ese vendedor tenía a
 * la vista (las que el filtro de Excel dejó ocultas son de otros y no se tocan) y solo pisa campos con
 * dato. Los errores los muestra el componente: necesita distinguir "varios_vendedores" para ofrecer
 * importar igual, así que la mutation no dispara el toast global.
 */
export function useImportarCuentas() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silentError: true },
    mutationFn: async ({ file, confirmarVariosVendedores }: ImportarCuentasVars) => {
      const form = new FormData();
      form.append("file", file);
      form.append("confirmarVariosVendedores", String(confirmarVariosVendedores));
      const { data } = await apiClient.post<ImportacionResultado>("/cuentas/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cuentasKeys.lists() });
    },
  });
}
