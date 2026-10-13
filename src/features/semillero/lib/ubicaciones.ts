import type { UbicacionDto } from "../types";

/** Misma normalización que `TextoCatalogo.Clave` del backend: sin espacios de más y en mayúsculas. */
export const claveUbicacion = (texto: string) =>
  texto.trim().split(/\s+/).filter(Boolean).join(" ").toUpperCase();

/**
 * El lugar del galpón se escribe a mano (no es un desplegable), pero por detrás el stock se agrupa
 * por lote × ubicación: hay que resolver ese texto a un id. Si lo que escribieron ya está activo en
 * el catálogo que tenemos en memoria, se usa ese id sin ir al servidor; si no —un lugar nuevo, o uno
 * que habían desactivado—, el alta rápida idempotente lo crea o lo reactiva y devuelve el id.
 */
export async function resolverUbicacionId(
  texto: string,
  ubicaciones: UbicacionDto[],
  asegurar: (codigo: string) => Promise<UbicacionDto>,
): Promise<number> {
  const clave = claveUbicacion(texto);
  const existente = ubicaciones.find((u) => u.activo && claveUbicacion(u.codigo) === clave);
  return existente ? existente.id : (await asegurar(texto.trim())).id;
}
