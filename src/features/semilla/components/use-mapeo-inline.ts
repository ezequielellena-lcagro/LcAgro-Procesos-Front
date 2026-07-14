import { useState } from "react";
import { toAppError } from "@/lib/api-error";
import { useGuardarMapeo } from "../queries/use-mapeo-mutations";
import { useVariedades } from "../queries/use-variedades";
import {
  categoriaValueDesdeLabel,
  type ArticuloMapeoDto,
  type CategoriaValue,
  type CultivoSemilla,
  type VentaSemillaDto,
} from "../types";

/** Identidad de un renglón (una venta) para saber cuál está en edición. Los mismos comprobante+línea no se repiten. */
function filaKey(f: VentaSemillaDto): string {
  return `${f.tipoComprobante}-${f.numeroComprobante}-${f.lineaComprobante}`;
}

/**
 * Estado y lógica de la edición inline del mapeo dentro de la grilla de ventas: una fila activa a la
 * vez. El upsert es por CÓDIGO DE ARTÍCULO, así que al guardar, la invalidación de `useGuardarMapeo`
 * refresca las ventas y todas las filas hermanas de ese artículo se rellenan solas.
 */
export function useMapeoInline(cultivo: CultivoSemilla) {
  const variedades = useVariedades(cultivo);
  const guardar = useGuardarMapeo();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [variedad, setVariedad] = useState("");
  const [categoria, setCategoria] = useState<CategoriaValue | "">("");
  const [error, setError] = useState<string | null>(null);

  const empezar = (fila: VentaSemillaDto, sugerencia?: ArticuloMapeoDto) => {
    setEditKey(filaKey(fila));
    setVariedad(fila.variedad || sugerencia?.cultivarInase || "");
    setCategoria(categoriaValueDesdeLabel(fila.categoria || sugerencia?.categoria || ""));
    setError(null);
  };

  const cancelar = () => {
    setEditKey(null);
    setError(null);
  };

  const guardarFila = async (fila: VentaSemillaDto) => {
    setError(null);
    const v = variedad.trim();
    if (!v) {
      setError("Elegí una variedad.");
      return;
    }
    if (!categoria) {
      setError("Elegí una categoría.");
      return;
    }
    try {
      await guardar.mutateAsync({
        codigoArticulo: fila.codigoArticulo,
        input: { cultivo, nombreArticulo: fila.nombreArticuloMacroGest, cultivarInase: v, categoria },
      });
      setEditKey(null); // el toast y la invalidación los hace useGuardarMapeo
    } catch (err) {
      const e = toAppError(err);
      const primero = e.fieldErrors ? Object.values(e.fieldErrors).flat()[0] : undefined;
      setError(primero ?? e.message);
    }
  };

  return {
    variedades,
    guardando: guardar.isPending,
    /** ¿Hay alguna fila en edición? (para deshabilitar los otros disparadores). */
    activo: editKey !== null,
    editando: (fila: VentaSemillaDto) => editKey === filaKey(fila),
    variedad,
    setVariedad,
    categoria,
    setCategoria,
    error,
    empezar,
    cancelar,
    guardarFila,
  };
}
