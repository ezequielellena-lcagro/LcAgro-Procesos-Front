import type { MovimientoFiltros, OrdenCargaFiltros, StockFiltros } from "../types";

export const semilleroKeys = {
  all: ["semillero"] as const,
  stock: (f: StockFiltros) => [...semilleroKeys.all, "stock", f] as const,
  /** Todos los lotes con sus atributos completos (para editar; el stock ya trae lo que hace falta ver). */
  lotes: () => [...semilleroKeys.all, "lotes"] as const,
  catalogos: () => [...semilleroKeys.all, "catalogos"] as const,
  movimientos: (f: MovimientoFiltros) => [...semilleroKeys.all, "movimientos", f] as const,
  ordenes: (f: OrdenCargaFiltros) => [...semilleroKeys.all, "ordenes", f] as const,
  /** Copia local de clientes de MacroGest (R2.1/R2.2): no depende de ningún filtro. */
  clientes: () => [...semilleroKeys.all, "clientes"] as const,
  /** Destinos de un cliente (R1.3): nunca son visibles para otro cliente. */
  destinosDeCliente: (clienteNumero: number) => [...semilleroKeys.all, "destinos", clienteNumero] as const,
  destinos: (clienteNumero: number, incluirInactivos: boolean) =>
    [...semilleroKeys.destinosDeCliente(clienteNumero), incluirInactivos] as const,
};
