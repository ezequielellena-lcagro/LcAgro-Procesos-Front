import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it, vi } from "vitest";
import type { ClienteCopiaDto, OrdenCargaDto, OrdenCargaFiltros } from "../types";
import { OrdenesPanel } from "./ordenes-panel";

/**
 * Pestaña Órdenes de carga: despacho (R6.4) y anulación (R6.5) de una orden Pendiente, con el número
 * único de la orden siempre visible (R6.6) y el 409 de concurrencia mostrado en la propia pantalla
 * (R6.7).
 */
const CLIENTES: ClienteCopiaDto[] = [
  { numero: 500, denominacion: "Cliente Uno", cuit: null },
  { numero: 600, denominacion: "Cliente Dos", cuit: null },
];

function orden(over: Partial<OrdenCargaDto> = {}): OrdenCargaDto {
  const base: OrdenCargaDto = {
    id: 1,
    numero: 7,
    fechaAlta: new Date().toISOString(),
    clienteNumero: 500,
    clienteDenominacion: "Cliente Uno",
    destinoId: 10,
    destinoNombre: "Campo Norte",
    numeroPedidoVenta: null,
    numeroRemito: null,
    observaciones: null,
    estado: "Pendiente",
    fechaDespacho: null,
    fechaAnulacion: null,
    motivoAnulacion: null,
    motivoAnulacionDetalle: null,
    creadoPor: "Admin Demo",
    despachadoPor: null,
    anuladoPor: null,
    items: [],
    totalUnidades: 5,
    totalKgPropio: 4000,
    totalKgCliente: 0,
  };
  return { ...base, ...over };
}

const PENDIENTE = orden({ id: 1, numero: 7 });
const DESPACHADA = orden({
  id: 2,
  numero: 3,
  clienteNumero: 600,
  clienteDenominacion: "Cliente Dos",
  destinoId: 20,
  destinoNombre: "Campo Sur",
  estado: "Despachada",
  numeroRemito: "06-00001",
  fechaDespacho: new Date().toISOString(),
  despachadoPor: "Admin Demo",
});

interface RenderOpts {
  datos?: OrdenCargaDto[];
  filtros?: OrdenCargaFiltros;
}

function renderPanel(opts: RenderOpts = {}) {
  const onFiltros = vi.fn();
  const onNuevaOrden = vi.fn();
  const onEditarOrden = vi.fn();
  const onDespachar = vi.fn().mockResolvedValue(undefined);
  const onAnular = vi.fn().mockResolvedValue(undefined);
  const onErrorRefrescarStock = vi.fn();
  const onExcel = vi.fn();
  render(
    <OrdenesPanel
      datos={opts.datos ?? [PENDIENTE, DESPACHADA]}
      cargando={false}
      clientes={CLIENTES}
      filtros={opts.filtros ?? {}}
      onFiltros={onFiltros}
      onNuevaOrden={onNuevaOrden}
      onEditarOrden={onEditarOrden}
      onDespachar={onDespachar}
      onAnular={onAnular}
      onErrorRefrescarStock={onErrorRefrescarStock}
      onExcel={onExcel}
      descargando={false}
    />,
  );
  return { onFiltros, onNuevaOrden, onEditarOrden, onDespachar, onAnular, onErrorRefrescarStock, onExcel };
}

function errorServidor(detail: string) {
  return new AxiosError("Request failed", "409", undefined, null, {
    status: 409,
    statusText: "Conflict",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data: { status: 409, detail },
  });
}

describe("OrdenesPanel", () => {
  it("muestra número, cliente, destino y estado de cada orden", () => {
    renderPanel();
    const tabla = within(screen.getByRole("table"));
    expect(tabla.getByText("7")).toBeInTheDocument();
    expect(tabla.getByText("Cliente Uno")).toBeInTheDocument();
    expect(tabla.getByText("Campo Norte")).toBeInTheDocument();
    expect(tabla.getByText("Pendiente")).toBeInTheDocument();
    expect(tabla.getByText("Despachada")).toBeInTheDocument();
  });

  it("sólo una orden Pendiente ofrece Despachar, Anular y Editar", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Despachar orden N° 7" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anular orden N° 7" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar orden N° 7" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Despachar orden N° 3" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anular orden N° 3" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar orden N° 3" })).not.toBeInTheDocument();
  });

  it("cambiar el filtro Estado avisa al padre", () => {
    const { onFiltros } = renderPanel();
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "Despachada" } });
    expect(onFiltros).toHaveBeenCalledWith({ estado: "Despachada" });
  });

  it("elegir un cliente en el filtro avisa al padre con su número", () => {
    const { onFiltros } = renderPanel();
    const combo = screen.getByLabelText("Cliente");
    fireEvent.focus(combo);
    fireEvent.change(combo, { target: { value: "Dos" } });
    fireEvent.mouseDown(within(screen.getByRole("listbox")).getByText(/Cliente Dos/));
    expect(onFiltros).toHaveBeenCalledWith({ clienteNumero: 600 });
  });

  it("tipear en Buscar avisa al padre con el texto", () => {
    const { onFiltros } = renderPanel();
    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "7" } });
    expect(onFiltros).toHaveBeenCalledWith({ texto: "7" });
  });

  it('el botón "Nueva orden" llama a onNuevaOrden', () => {
    const { onNuevaOrden } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Nueva orden" }));
    expect(onNuevaOrden).toHaveBeenCalled();
  });

  it('el botón "Excel" llama a onExcel', () => {
    const { onExcel } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    expect(onExcel).toHaveBeenCalled();
  });

  it('"Editar" llama a onEditarOrden con la orden completa', () => {
    const { onEditarOrden } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Editar orden N° 7" }));
    expect(onEditarOrden).toHaveBeenCalledWith(PENDIENTE);
  });

  it("despachar desde la fila abre el diálogo y confirma con onDespachar", async () => {
    const { onDespachar } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Despachar orden N° 7" }));
    const dialogo = screen.getByRole("dialog");
    fireEvent.change(within(dialogo).getByLabelText("Remito"), { target: { value: "6-1" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Despachar" }));

    await waitFor(() =>
      expect(onDespachar).toHaveBeenCalledWith(1, { numeroRemito: "06-00001", numeroPedidoVenta: null }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("anular desde la fila abre el diálogo y confirma con onAnular", async () => {
    const { onAnular } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Anular orden N° 7" }));
    const dialogo = screen.getByRole("dialog");
    fireEvent.change(within(dialogo).getByLabelText("Motivo"), { target: { value: "Duplicada" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Anular" }));

    await waitFor(() => expect(onAnular).toHaveBeenCalledWith(1, { motivo: "Duplicada", detalle: null }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ante un 409 al despachar, el panel muestra el mensaje e invalida el stock para refrescar los máximos disponibles (R6.4/R6.7)", async () => {
    const { onDespachar, onErrorRefrescarStock } = renderPanel();
    onDespachar.mockRejectedValueOnce(errorServidor("Lote 26S-001 en G1-1: físico insuficiente para despachar."));
    fireEvent.click(screen.getByRole("button", { name: "Despachar orden N° 7" }));
    fireEvent.change(screen.getByLabelText("Remito"), { target: { value: "6-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Despachar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("físico insuficiente");
    expect(onErrorRefrescarStock).toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("la tabla vacía explica cómo empezar", () => {
    renderPanel({ datos: [] });
    expect(screen.getByText(/Todavía no hay órdenes/)).toBeInTheDocument();
  });
});
