import { useId, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { claveUbicacion } from "../lib/ubicaciones";
import type { UbicacionDto } from "../types";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "list" | "type"> {
  /** Catálogo ya cargado: sólo para sugerir mientras escriben — nada obliga a elegir de la lista. */
  ubicaciones: UbicacionDto[];
  /** Lugar que no tiene sentido sugerir: al reubicar, el de origen (de ahí sale la semilla). */
  excluir?: string;
}

/**
 * La ubicación del galpón se carga a mano, como texto (pedido de la planta): escriben lo que quieran
 * y el formulario resuelve ese texto a una ubicación del catálogo con `resolverUbicacionId` —
 * creándola si todavía no existe. El `datalist` sugiere los lugares ya en uso para que el mismo
 * galpón no termine cargado de cinco formas distintas, pero no limita lo que se puede escribir.
 */
export function UbicacionInput({ ubicaciones, excluir, ...props }: Props) {
  const generado = useId();
  const listaId = props.id ? `${props.id}-sugerencias` : generado;
  const excluida = excluir === undefined ? null : claveUbicacion(excluir);
  const sugerencias = ubicaciones.filter((u) => u.activo && claveUbicacion(u.codigo) !== excluida);

  return (
    <>
      <Input list={listaId} autoComplete="off" maxLength={30} {...props} />
      <datalist id={listaId}>
        {sugerencias.map((u) => (
          <option key={u.id} value={u.codigo} />
        ))}
      </datalist>
    </>
  );
}
