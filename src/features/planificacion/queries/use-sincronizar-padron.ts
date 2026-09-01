import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sincronizarPadronProductores } from "../api";
import { planificacionKeys } from "./keys";

/**
 * Trae el padrón de clientes de MacroGest a la base propia.
 *
 * Es manual a propósito: el equipo decide cuándo refrescar, en vez de que la copia se mueva sola
 * bajo los pies mientras alguien está mirando el tablero. Lee los ~7.900 clientes en lotes, así
 * que tarda; por eso la pantalla muestra el progreso y bloquea el botón mientras corre.
 */
export function useSincronizarPadron() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sincronizarPadronProductores,
    onSuccess: async (resumen) => {
      // El padrón cambia quién entra al tablero y a la segmentación: se recalcula todo.
      await queryClient.invalidateQueries({ queryKey: planificacionKeys.all });

      const cambios = resumen.creados + resumen.actualizados;
      toast.success(
        cambios === 0
          ? `El padrón ya estaba al día: ${resumen.leidosMacroGest.toLocaleString("es-AR")} clientes leídos, sin cambios.`
          : `Padrón actualizado: ${resumen.creados.toLocaleString("es-AR")} altas y ` +
              `${resumen.actualizados.toLocaleString("es-AR")} modificaciones sobre ` +
              `${resumen.leidosMacroGest.toLocaleString("es-AR")} clientes de MacroGest.`,
      );
      if (resumen.omitidos > 0) {
        toast.warning(
          `${resumen.omitidos.toLocaleString("es-AR")} filas de MacroGest quedaron afuera por datos inconsistentes.`,
        );
      }
    },
  });
}
