import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MovimientoDto } from "../types";
import { MovimientosPanel } from "./movimientos-panel";

const ajuste: MovimientoDto = {
  id: 1,
  fecha: "2026-10-06T01:00:00Z",
  tipo: "AjusteNegativo",
  loteId: 1,
  loteCodigo: "26S-001",
  campania: "2026-2027",
  especie: "Soja",
  variedad: "DM 46E25",
  envase: "BigBag",
  ubicacionId: 1,
  ubicacion: "G1-6",
  cantidad: -2,
  kg: -1600,
  motivoAjuste: "RoturaPerdida",
  observacion: "Bolsa rota en la descarga",
  duenio: "Cliente",
  clienteDenominacion: "Juan Pérez",
  ordenCargaNumero: null,
  usuario: "Operario Semillero",
};

const despacho: MovimientoDto = {
  id: 2,
  fecha: "2026-10-07T13:00:00Z",
  tipo: "Despacho",
  loteId: 2,
  loteCodigo: "26S-002",
  campania: "2026-2027",
  especie: "Soja",
  variedad: "DM 50K50",
  envase: "Bolsa",
  ubicacionId: 3,
  ubicacion: "G5-18",
  cantidad: -20,
  kg: -800,
  motivoAjuste: null,
  observacion: null,
  duenio: "Propio",
  clienteDenominacion: null,
  ordenCargaNumero: 12,
  usuario: "Operario Semillero",
};

const ingreso: MovimientoDto = {
  id: 3,
  fecha: "2026-10-05T10:00:00Z",
  tipo: "Ingreso",
  loteId: 1,
  loteCodigo: "26S-001",
  campania: "2026-2027",
  especie: "Soja",
  variedad: "DM 46E25",
  envase: "BigBag",
  ubicacionId: 1,
  ubicacion: "G1-6",
  cantidad: 30,
  kg: 24000,
  motivoAjuste: null,
  observacion: null,
  duenio: "Cliente",
  clienteDenominacion: "Juan Pérez",
  ordenCargaNumero: null,
  usuario: "Operario Semillero",
};

function renderPanel(over: Partial<Parameters<typeof MovimientosPanel>[0]> = {}) {
  const props = {
    movimientos: [ajuste, despacho, ingreso],
    cargando: false,
    filtros: {},
    onFiltros: vi.fn(),
    onExcel: vi.fn(),
    descargando: false,
    ...over,
  };
  render(<MovimientosPanel {...props} />);
  return props;
}

describe("MovimientosPanel", () => {
  it("muestra el motivo del ajuste con su etiqueta legible y la observación", () => {
    renderPanel();
    const fila = screen.getByRole("row", { name: /26S-001.*Rotura/ });
    expect(within(fila).getByText("Rotura/pérdida")).toBeInTheDocument();
    expect(within(fila).getByText("Bolsa rota en la descarga")).toBeInTheDocument();
  });

  it("sin motivo ni observación se ven como guion, pero sí se ve la orden que lo originó", () => {
    renderPanel();
    const fila = screen.getByRole("row", { name: /26S-002/ });
    expect(within(fila).getByText("OC 12")).toBeInTheDocument();
    expect(within(fila).getAllByText("—")).toHaveLength(2);
  });

  it("distingue la semilla propia de la de un cliente", () => {
    renderPanel();
    const filaCliente = screen.getByRole("row", { name: /26S-001.*Rotura/ });
    const filaPropia = screen.getByRole("row", { name: /26S-002/ });
    expect(within(filaCliente).getByText("Cliente · Juan Pérez")).toBeInTheDocument();
    expect(within(filaPropia).getByText("Propio")).toBeInTheDocument();
  });

  it("muestra la cantidad con signo, en verde si entra y en rojo si sale", () => {
    renderPanel();
    expect(screen.getByText("30")).toHaveClass("text-verde");
    expect(screen.getByText("-2")).toHaveClass("text-rojo");
    expect(screen.getByText("-20")).toHaveClass("text-rojo");
  });

  it("filtra por tipo", () => {
    const props = renderPanel();
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "AjusteNegativo" } });
    expect(props.onFiltros).toHaveBeenCalledWith({ tipo: "AjusteNegativo" });
  });

  it("filtra por dueño entre Todos, Propio y Clientes", () => {
    const props = renderPanel({ filtros: { duenio: "Propio" } });
    expect(screen.getByLabelText("Dueño")).toHaveValue("Propio");

    fireEvent.change(screen.getByLabelText("Dueño"), { target: { value: "Cliente" } });
    expect(props.onFiltros).toHaveBeenCalledWith({ duenio: "Cliente" });
  });

  it("filtra por lote, ofreciendo sólo los que aparecen en el historial", () => {
    const props = renderPanel();
    const opciones = within(screen.getByLabelText("Lote"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(opciones).toEqual(["Todos", "26S-001", "26S-002"]);

    fireEvent.change(screen.getByLabelText("Lote"), { target: { value: "2" } });
    expect(props.onFiltros).toHaveBeenCalledWith({ loteId: 2 });
  });

  it("filtra por fecha desde y hasta", () => {
    const props = renderPanel();
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "01/10/2026" } });
    expect(props.onFiltros).toHaveBeenCalledWith({ desde: "2026-10-01" });

    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "07/10/2026" } });
    expect(props.onFiltros).toHaveBeenCalledWith({ hasta: "2026-10-07" });
  });

  it("descarga el excel con los filtros vigentes", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Excel/ }));
    expect(props.onExcel).toHaveBeenCalled();
  });

  it("sin movimientos lo dice", () => {
    renderPanel({ movimientos: [] });
    expect(screen.getByText("No hay movimientos con esos filtros.")).toBeInTheDocument();
  });
});
