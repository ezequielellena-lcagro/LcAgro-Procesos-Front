import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StockFilaDto, StockSemilleroDto, VariedadDto } from "../types";
import { StockPanel } from "./stock-panel";

const fila = (over: Partial<StockFilaDto> = {}): StockFilaDto => ({
  loteId: 1,
  loteCodigo: "26S-001",
  campania: "2026-2027",
  especie: "Soja",
  variedadId: 1,
  variedad: "DM 46E25",
  envase: "BigBag",
  pesoUnitarioKg: 800,
  tratada: true,
  pg: 95,
  pmil: 152,
  observaciones: null,
  duenio: "Propio",
  clienteNumero: null,
  clienteDenominacion: null,
  ubicacionId: 1,
  ubicacion: "G1-6",
  fisico: 10,
  comprometido: 3,
  disponible: 7,
  kgDisponibles: 5600,
  ...over,
});

const totalesVacios = {
  propio: { bigBagsDisponibles: 0, bolsasDisponibles: 0, kgDisponibles: 0 },
  clientes: { bigBagsDisponibles: 0, bolsasDisponibles: 0, kgDisponibles: 0 },
  kgComprometidos: 0,
  ordenesPendientes: 0,
};

const datos = (filas: StockFilaDto[]): StockSemilleroDto => ({ filas, totales: totalesVacios });

const variedades: VariedadDto[] = [
  { id: 1, especie: "Soja", nombre: "DM 46E25", activo: true, enUso: 1 },
  { id: 3, especie: "Trigo", nombre: "DM CATALPA", activo: true, enUso: 0 },
];

const campanias = ["2025-2026", "2026-2027"];

function renderPanel(over: Partial<Parameters<typeof StockPanel>[0]> = {}) {
  const props = {
    datos: datos([fila()]),
    cargando: false,
    variedades,
    especies: [
      { codigoRubro: 100, nombre: "Trigo", activo: true },
      { codigoRubro: 101, nombre: "Soja", activo: true },
    ],
    campanias,
    filtros: {},
    onFiltros: vi.fn(),
    onNuevoLote: vi.fn(),
    onEditarLote: vi.fn(),
    onMovimiento: vi.fn(),
    onOrden: vi.fn(),
    onExcel: vi.fn(),
    descargando: false,
    ...over,
  };
  render(<StockPanel {...props} />);
  return props;
}

describe("StockPanel", () => {
  it("muestra físico, reservado y disponible de cada lote en su ubicación", () => {
    renderPanel();
    const fila26 = screen.getByText("26S-001").closest("tr") as HTMLElement;
    expect(within(fila26).getByText("G1-6")).toBeInTheDocument();
    expect(within(fila26).getByText("10")).toBeInTheDocument();
    expect(within(fila26).getByText("3")).toBeInTheDocument();
    expect(within(fila26).getByText("7")).toBeInTheDocument();
    expect(within(fila26).getByText("5.600 kg")).toBeInTheDocument();
  });

  it("marca en rojo cuando las órdenes reservan más de lo que hay", () => {
    renderPanel({
      datos: datos([fila({ fisico: 1, comprometido: 3, disponible: -2, kgDisponibles: -1600 })]),
    });
    expect(screen.getByText("-2")).toHaveClass("text-rojo");
  });

  it("las acciones de la fila avisan qué lote y qué operación", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Ingreso 26S-001 en G1-6" }));
    fireEvent.click(screen.getByRole("button", { name: "Ajuste 26S-001 en G1-6" }));
    fireEvent.click(screen.getByRole("button", { name: "Reubicar 26S-001 en G1-6" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar lote 26S-001" }));
    expect(props.onMovimiento).toHaveBeenNthCalledWith(1, "ingreso", expect.objectContaining({ loteId: 1 }));
    expect(props.onMovimiento).toHaveBeenNthCalledWith(2, "ajuste", expect.objectContaining({ loteId: 1 }));
    expect(props.onMovimiento).toHaveBeenNthCalledWith(3, "reubicacion", expect.objectContaining({ loteId: 1 }));
    expect(props.onEditarLote).toHaveBeenCalledWith(1);
  });

  it("la columna Obs. muestra las observaciones en una línea, con el texto completo en el title (R5.1)", () => {
    const observaciones = "Línea Premium. Curado con fungicida e insecticida, separado para el mismo cliente.";
    renderPanel({
      datos: datos([
        fila({ loteId: 1, loteCodigo: "26S-001", observaciones }),
        fila({ loteId: 2, loteCodigo: "26S-002", observaciones: null }),
      ]),
    });

    const encabezados = screen.getAllByRole("columnheader").map((th) => th.textContent);
    const columnaObs = encabezados.indexOf("Obs.");
    expect(columnaObs).toBeGreaterThan(-1);
    expect(columnaObs).toBeLessThan(encabezados.indexOf("Físico"));

    const texto = screen.getByText(observaciones);
    expect(texto).toHaveAttribute("title", observaciones);
    expect(texto).toHaveClass("truncate");

    const filaSinObs = screen.getByText("26S-002").closest("tr") as HTMLElement;
    expect(within(filaSinObs).getAllByRole("cell")[columnaObs]).toHaveTextContent(/^—$/);
  });

  it('"Orden" arma una orden con el lote y la ubicación de la fila (R4.1)', () => {
    const propio = fila({ loteId: 1, loteCodigo: "26S-001" });
    const deCliente = fila({
      loteId: 2,
      loteCodigo: "26S-C01",
      ubicacionId: 3,
      ubicacion: "PLANTA",
      duenio: "Cliente",
      clienteNumero: 1234,
      clienteDenominacion: "Juan Pérez",
    });
    const props = renderPanel({ datos: datos([propio, deCliente]) });

    fireEvent.click(screen.getByRole("button", { name: "Orden con 26S-001 en G1-6" }));
    fireEvent.click(screen.getByRole("button", { name: "Orden con 26S-C01 en PLANTA" }));

    expect(props.onOrden).toHaveBeenNthCalledWith(1, propio);
    expect(props.onOrden).toHaveBeenNthCalledWith(2, deCliente);
  });

  it('"Orden" queda deshabilitado si la fila no tiene disponible, y dice por qué (R4.1)', () => {
    renderPanel({
      datos: datos([
        fila({ loteId: 1, loteCodigo: "26S-001", fisico: 3, comprometido: 3, disponible: 0, kgDisponibles: 0 }),
        fila({ loteId: 2, loteCodigo: "26S-002", fisico: 1, comprometido: 3, disponible: -2, kgDisponibles: -1600 }),
        fila({ loteId: 3, loteCodigo: "26S-003", fisico: 3, comprometido: 0, disponible: 3, kgDisponibles: 2400 }),
      ]),
    });
    const sinDisponible = screen.getByRole("button", { name: "Orden con 26S-001 en G1-6" });
    expect(sinDisponible).toBeDisabled();
    expect(sinDisponible).toHaveAccessibleDescription("Sin disponible para cargar en una orden.");
    // Hallazgo de la revisión (ronda 2): un botón deshabilitado no recibe el mouse
    // (`pointer-events-none`), así que el tooltip tiene que salir de su contenedor.
    expect(sinDisponible.parentElement).toHaveAttribute("title", "Sin disponible para cargar en una orden.");
    expect(screen.getByRole("button", { name: "Orden con 26S-002 en G1-6" })).toBeDisabled();

    const conDisponible = screen.getByRole("button", { name: "Orden con 26S-003 en G1-6" });
    expect(conDisponible).toBeEnabled();
    expect(conDisponible).not.toHaveAttribute("title");
    expect(conDisponible.parentElement).not.toHaveAttribute("title");
  });

  it("al cambiar de especie se limpia la variedad elegida", () => {
    const props = renderPanel({ filtros: { variedadId: 1 } });
    fireEvent.change(screen.getByLabelText("Especie"), { target: { value: "Trigo" } });
    expect(props.onFiltros).toHaveBeenCalledWith({ especie: "Trigo", variedadId: undefined });
  });

  it("el filtro de variedad sólo ofrece las de la especie elegida", () => {
    renderPanel({ filtros: { especie: "Trigo" } });
    const opciones = within(screen.getByLabelText("Variedad"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(opciones).toEqual(["Todas", "DM CATALPA"]);
  });

  it("sin filas explica cómo empezar", () => {
    renderPanel({ datos: datos([]) });
    expect(screen.getByText(/Todavía no hay stock/)).toBeInTheDocument();
  });

  it("filtra por campaña", () => {
    const props = renderPanel({ filtros: { campania: "2026-2027" } });
    expect(screen.getByLabelText("Campaña")).toHaveValue("2026-2027");

    fireEvent.change(screen.getByLabelText("Campaña"), { target: { value: "2025-2026" } });
    expect(props.onFiltros).toHaveBeenCalledWith({ campania: "2025-2026" });

    fireEvent.change(screen.getByLabelText("Campaña"), { target: { value: "" } });
    expect(props.onFiltros).toHaveBeenCalledWith({ campania: undefined });
  });

  it("filtra por envase y por tratamiento", () => {
    const props = renderPanel({ filtros: { envase: "Bolsa", tratada: false } });
    expect(screen.getByLabelText("Envase")).toHaveValue("Bolsa");
    expect(screen.getByLabelText("Tratamiento")).toHaveValue("false");

    fireEvent.change(screen.getByLabelText("Envase"), { target: { value: "BigBag" } });
    expect(props.onFiltros).toHaveBeenLastCalledWith({ envase: "BigBag", tratada: false });
    fireEvent.change(screen.getByLabelText("Envase"), { target: { value: "" } });
    expect(props.onFiltros).toHaveBeenLastCalledWith({ envase: undefined, tratada: false });

    fireEvent.change(screen.getByLabelText("Tratamiento"), { target: { value: "true" } });
    expect(props.onFiltros).toHaveBeenLastCalledWith({ envase: "Bolsa", tratada: true });
    fireEvent.change(screen.getByLabelText("Tratamiento"), { target: { value: "" } });
    expect(props.onFiltros).toHaveBeenLastCalledWith({ envase: "Bolsa", tratada: undefined });
  });

  it("filtra por dueño entre Todos, Propio y Clientes", () => {
    const props = renderPanel({ filtros: { duenio: "Propio" } });
    expect(screen.getByLabelText("Dueño")).toHaveValue("Propio");

    fireEvent.change(screen.getByLabelText("Dueño"), { target: { value: "Cliente" } });
    expect(props.onFiltros).toHaveBeenCalledWith({ duenio: "Cliente" });

    fireEvent.change(screen.getByLabelText("Dueño"), { target: { value: "" } });
    expect(props.onFiltros).toHaveBeenCalledWith({ duenio: undefined });
  });

  it("la columna Dueño distingue la semilla propia de la de un cliente", () => {
    renderPanel({
      datos: datos([
        fila({ loteId: 1, loteCodigo: "26S-001" }),
        fila({
          loteId: 2,
          loteCodigo: "26S-002",
          duenio: "Cliente",
          clienteNumero: 1234,
          clienteDenominacion: "Juan Pérez",
        }),
      ]),
    });
    const filaPropia = screen.getByText("26S-001").closest("tr") as HTMLElement;
    const filaCliente = screen.getByText("26S-002").closest("tr") as HTMLElement;
    expect(within(filaPropia).getByText("Propio")).toBeInTheDocument();
    expect(within(filaCliente).getByText("Cliente · Juan Pérez")).toBeInTheDocument();
  });
});
