import { useState } from "react";
import { clienteActivoDeLote } from "../lib/orden";
import { useClientesSemillero } from "../queries/use-clientes-semillero";
import { useStockSemillero } from "../queries/use-semillero";
import type { OrdenCargaDto, StockFilaDto, StockFiltros } from "../types";

/**
 * El armado de la orden usa el stock SIN los filtros de la pestaña Stock: con un filtro activo, la
 * orden ofrecería sólo esos lotes y, al editar una pendiente cuyo lote quedó afuera, el renglón
 * quedaría sin datos y con máximo 0. El backend igual oculta lo que no tiene físico ni reservas.
 */
const STOCK_COMPLETO: StockFiltros = {};

/**
 * Pedido de abrir el diálogo de orden (alta, edición o desde una fila de Stock). `pedidoEn` marca
 * desde cuándo vale el stock completo: el diálogo abre recién con datos recibidos después (R1.2).
 */
interface PedidoOrden {
  orden: OrdenCargaDto | null;
  filaOrigen: StockFilaDto | null;
  pedidoEn: number;
}

/**
 * Cliente de una orden al pedirla: el suyo al editar; ninguno en un alta, salvo desde un lote de
 * Cliente, cuyo dueño se decide recién con la copia de clientes (`undefined`, R4.3).
 */
function clienteAlPedirOrden(orden: OrdenCargaDto | null, filaOrigen: StockFilaDto | null) {
  if (orden) return orden.clienteNumero;
  return filaOrigen?.duenio === "Cliente" ? undefined : null;
}

/**
 * El pedido de abrir el diálogo de orden y lo que ese diálogo espera antes de abrirse: el stock
 * completo recién pedido (R1.1/R1.2) y, desde un lote de Cliente, la copia de clientes al día para
 * saber si ese dueño está activo (R4.3). También es dueño del cliente de la orden en armado, el mismo
 * que tiene el formulario: de él salen los destinos y su alta rápida.
 */
export function usePedidoOrden() {
  const [pedido, setPedido] = useState<PedidoOrden | null>(null);
  // `undefined` mientras un lote de Cliente espera la copia de clientes (ver abajo).
  const [cliente, setCliente] = useState<number | null | undefined>(null);

  const hayPedido = pedido !== null;
  const stock = useStockSemillero(STOCK_COMPLETO, hayPedido);
  const clientes = useClientesSemillero(hayPedido);

  // El stock completo tiene que haber llegado DESPUÉS del pedido: con una copia vieja, el renglón de
  // un lote nuevo se vería vacío y con un "Supera lo disponible" que no es real (R1.2). Ya abierto,
  // volver a pedirlo no lo cierra: `dataUpdatedAt` sólo avanza.
  const stockAlDia = hayPedido && stock.dataUpdatedAt >= pedido.pedidoEn;
  const fallo = hayPedido && !stockAlDia && stock.errorUpdatedAt >= pedido.pedidoEn ? stock.error : null;
  // Desde una fila de un Cliente, además, hay que saber si ese cliente está activo antes de armar el
  // formulario (R4.3): nunca puede quedar un cliente cargado con el selector vacío en pantalla. Se
  // espera también la copia que se está pidiendo aunque haya una vieja en caché (vencida, se pide al
  // abrir): con la vieja, un cliente dado de baja quedaría precargado. Ya fijado el cliente, un
  // pedido posterior no cierra el diálogo.
  const esperandoClientes = cliente === undefined && (clientes.isPending || clientes.isFetching);
  const listo = stockAlDia && !esperandoClientes;
  // Ese dueño se fija UNA sola vez, al quedar listo el diálogo, y sólo si está activo: de un cliente
  // dado de baja no se piden ni sus destinos. Si después la copia se refresca sin él, la página y el
  // formulario siguen hablando del mismo cliente (antes la página pasaba al "cliente 0").
  if (listo && cliente === undefined) {
    setCliente(clienteActivoDeLote(pedido.filaOrigen, clientes.data?.clientes ?? []));
  }

  const abrir = (orden: OrdenCargaDto | null, filaOrigen: StockFilaDto | null) => {
    setPedido({ orden, filaOrigen, pedidoEn: Date.now() });
    setCliente(clienteAlPedirOrden(orden, filaOrigen));
    // Con el diálogo cerrado nadie vuelve a pedir el stock completo (una escritura sólo lo marca
    // como vencido): la copia en caché puede ser vieja, así que se pide siempre al abrir (R1.2).
    void stock.refetch();
  };
  const cerrar = () => {
    setPedido(null);
    setCliente(null);
  };

  return {
    /** El diálogo se puede mostrar: ya llegó todo lo que espera. */
    abierto: listo,
    /** Hay un pedido que todavía no se puede mostrar (esperando o con `fallo`). */
    esperando: hayPedido && !listo,
    /** Por qué no se pudo traer el stock completo del pedido, si falló. */
    fallo,
    /** `null` = alta. */
    orden: pedido?.orden ?? null,
    filaOrigen: pedido?.filaOrigen ?? null,
    filas: stock.data?.filas ?? [],
    cliente: cliente ?? null,
    elegirCliente: setCliente,
    abrirNueva: () => abrir(null, null),
    abrirEdicion: (orden: OrdenCargaDto) => abrir(orden, null),
    abrirDesdeStock: (fila: StockFilaDto) => abrir(null, fila),
    reintentar: () => {
      if (pedido) abrir(pedido.orden, pedido.filaOrigen);
    },
    /** Cierra el diálogo, o desiste del pedido si todavía no se mostró. */
    cerrar,
  };
}
