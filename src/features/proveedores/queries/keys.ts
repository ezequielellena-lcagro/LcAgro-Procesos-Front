import type { ProveedoresFiltros } from "../types";

export const proveedoresKeys = {
  all: ["proveedores"] as const,
  lists: () => [...proveedoresKeys.all, "list"] as const,
  // Los filtros entran enteros en la clave: cambiar el mes base es otra consulta, no un refetch.
  list: (f: ProveedoresFiltros) => [...proveedoresKeys.lists(), f] as const,
  catalogo: () => [...proveedoresKeys.all, "catalogo"] as const,
};
