import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it, vi } from "vitest";
import type {
  ClienteCopiaDto,
  DestinoDto,
  EstadoCopiaClientesDto,
  OrdenCargaDto,
  StockFilaDto,
} from "../types";
import { OrdenDialog } from "./orden-dialog";

const CLIENTES: ClienteCopiaDto[] = [
  { numero: 500, denominacion: "Cliente Uno", cuit: null },
  { numero: 600, denominacion: "Cliente Dos", cuit: null },
];

const DESTINOS_500: DestinoDto[] = [{ id: 10, clienteNumero: 500, nombre: "Campo Norte", activo: true, enUso: 0 }];

const COPIA_OK: EstadoCopiaClientesDto = {
  ultimaSincronizacion: new Date().toISOString(),
  ultimoIntentoFallido: null,
  ultimoError: null,
  desactualizada: false,
  sinCopia: false,
  cantidad: 2,
};

function fila(over: Partial<StockFilaDto> = {}): StockFilaDto {
  const base: StockFilaDto = {
    loteId: 1,
    loteCodigo: "26S-001",
    campania: "2026-2027",
    especie: "Soja",
    variedadId: 1,
    variedad: "DM 46E25",
    envase: "BigBag",
    pesoUnitarioKg: 800,
    tratada: false,
    pg: 95,
    pmil: 150,
    observaciones: null,
    duenio: "Propio",
    clienteNumero: null,
    clienteDenominacion: null,
    ubicacionId: 1,
    ubicacion: "G1-1",
    fisico: 10,
    comprometido: 0,
    disponible: 10,
    kgDisponibles: 8000,
  };
  const f = { ...base, ...over };
  return { ...f, disponible: f.fisico - f.comprometido, kgDisponibles: (f.fisico - f.comprometido) * f.pesoUnitarioKg };
}

const PROPIO = fila({ loteId: 1, loteCodigo: "26S-001", ubicacionId: 1, ubicacion: "G1-1" });
const CLIENTE_500 = fila({
  loteId: 2,
  loteCodigo: "26S-C01",
  ubicacionId: 2,
  ubicacion: "PLANTA",
  duenio: "Cliente",
  clienteNumero: 500,
  clienteDenominacion: "Cliente Uno",
  fisico: 5,
  comprometido: 0,
  pesoUnitarioKg: 40,
  envase: "Bolsa",
});

const ORDEN_EDITABLE: OrdenCargaDto = {
  id: 1,
  numero: 1,
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
  items: [
    {
      id: 1,
      loteId: 2,
      loteCodigo: "26S-C01",
      campania: "2026-2027",
      especie: "Soja",
      variedad: "DM 46E25",
      envase: "Bolsa",
      pesoUnitarioKg: 40,
      tratada: false,
      pg: null,
      pmil: null,
      duenio: "Cliente",
      clienteNumero: 500,
      ubicacionId: 2,
      ubicacion: "PLANTA",
      cantidad: 3,
      kg: 120,
    },
  ],
  totalUnidades: 3,
  totalKg: 120,
  totalKgPropio: 0,
  totalKgCliente: 120,
};

interface RenderOpts {
  orden?: OrdenCargaDto | null;
  filas?: StockFilaDto[];
  destinos?: DestinoDto[];
  clientes?: ClienteCopiaDto[];
  filaOrigen?: StockFilaDto | null;
  clienteInicial?: number | null;
  copiaClientes?: EstadoCopiaClientesDto;
}

function renderDialog(opts: RenderOpts = {}) {
  const onCrear = vi.fn().mockResolvedValue(undefined);
  const onActualizar = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const onActualizarClientes = vi.fn();
  const onAgregarDestino = vi.fn();
  const onClienteChange = vi.fn();
  const dialogo = (o: RenderOpts) => (
    <OrdenDialog
      open
      orden={o.orden ?? null}
      clientes={o.clientes ?? CLIENTES}
      copiaClientes={o.copiaClientes ?? COPIA_OK}
      actualizandoClientes={false}
      onActualizarClientes={onActualizarClientes}
      filas={o.filas ?? [PROPIO, CLIENTE_500]}
      filaOrigen={o.filaOrigen ?? null}
      clienteInicial={o.clienteInicial ?? null}
      destinos={o.destinos ?? DESTINOS_500}
      onClienteChange={onClienteChange}
      onAgregarDestino={onAgregarDestino}
      onCrear={onCrear}
      onActualizar={onActualizar}
      onClose={onClose}
    />
  );
  const { rerender } = render(dialogo(opts));
  return {
    onCrear,
    onActualizar,
    onClose,
    onActualizarClientes,
    onAgregarDestino,
    onClienteChange,
    /** Vuelve a renderizar con otras props (p. ej. la copia de clientes refrescada), sin remontar. */
    actualizar: (cambios: RenderOpts) => rerender(dialogo({ ...opts, ...cambios })),
  };
}

function elegirCliente(etiqueta: string) {
  const combo = screen.getByLabelText("Cliente");
  fireEvent.focus(combo);
  fireEvent.change(combo, { target: { value: etiqueta } });
  fireEvent.mouseDown(screen.getByText(new RegExp(etiqueta)));
}

function agregarRenglon(clave: string, cantidad: string) {
  fireEvent.change(screen.getByLabelText("Agregar renglón"), { target: { value: clave } });
  fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: cantidad } });
  fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
}

/** Códigos de lote que el selector "Agregar renglón" ofrece hoy, en el orden en que aparecen. */
function lotesOfrecidos(): string[] {
  return within(screen.getByLabelText("Agregar renglón"))
    .getAllByRole("option")
    .filter((o) => o.getAttribute("value") !== "")
    .map((o) => /Lote (\S+)/.exec(o.textContent ?? "")?.[1] ?? "");
}

const OBS_LARGA = "Línea Profesional, curado con fungicida e insecticida de amplio espectro";

const PROPIO_TRATADO = fila({
  loteId: 3,
  loteCodigo: "26S-003",
  ubicacionId: 3,
  ubicacion: "G1-3",
  tratada: true,
  observaciones: OBS_LARGA,
});

const PROPIO_OTRA_VARIEDAD = fila({
  loteId: 4,
  loteCodigo: "26S-004",
  ubicacionId: 4,
  ubicacion: "G1-4",
  variedadId: 2,
  variedad: "NS 4309",
  envase: "Bolsa",
  pesoUnitarioKg: 40,
});

function errorServidor(detail: string) {
  return new AxiosError("Request failed", "409", undefined, null, {
    status: 409,
    statusText: "Conflict",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data: { status: 409, detail },
  });
}

describe("OrdenDialog", () => {
  it("el alta manda cliente, destino, pedido normalizado y los renglones cargados", async () => {
    const { onCrear, onClose } = renderDialog();
    elegirCliente("Uno");
    fireEvent.change(screen.getByLabelText("Destino"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Pedido de venta"), { target: { value: "6-45" } });
    agregarRenglon("2:2", "3");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onCrear).toHaveBeenCalledWith({
        clienteNumero: 500,
        destinoId: 10,
        numeroPedidoVenta: "06-00045",
        observaciones: null,
        items: [{ loteId: 2, ubicacionId: 2, cantidad: 3 }],
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("sin cliente elegido no aparecen lotes de clientes en el listado de renglones (R4.4)", () => {
    renderDialog();
    const select = screen.getByLabelText("Agregar renglón");
    expect(within(select).getByRole("option", { name: /26S-001/ })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: /26S-C01/ })).not.toBeInTheDocument();
  });

  it("el cliente-select nunca ofrece clientes inactivos, ni siquiera si tienen stock propio en planta (decisión #3)", () => {
    const deClienteInactivo = fila({
      loteId: 3,
      loteCodigo: "26S-C02",
      ubicacionId: 3,
      ubicacion: "G1-2",
      duenio: "Cliente",
      clienteNumero: 700,
      clienteDenominacion: "Cliente Inactivo SA",
    });
    renderDialog({ filas: [PROPIO, CLIENTE_500, deClienteInactivo] });
    const combo = screen.getByLabelText("Cliente");
    fireEvent.focus(combo);
    fireEvent.change(combo, { target: { value: "" } });
    expect(screen.queryByText(/Cliente Inactivo SA/)).not.toBeInTheDocument();
  });

  it("con un cliente elegido, los lotes de otro cliente no aparecen para agregar", () => {
    const deClienteDos = fila({
      loteId: 4,
      loteCodigo: "26S-C03",
      ubicacionId: 4,
      ubicacion: "G1-3",
      duenio: "Cliente",
      clienteNumero: 600,
      clienteDenominacion: "Cliente Dos",
    });
    renderDialog({ filas: [PROPIO, CLIENTE_500, deClienteDos] });
    elegirCliente("Uno");

    const select = screen.getByLabelText("Agregar renglón");
    expect(within(select).getByRole("option", { name: /26S-001/ })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: /26S-C01/ })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: /26S-C03/ })).not.toBeInTheDocument();
  });

  it("no deja agregar un renglón con más cantidad que el máximo disponible", () => {
    renderDialog();
    agregarRenglon("1:1", "999");
    expect(screen.getByText(/Hay 10 disponibles/)).toBeInTheDocument();
  });

  it("agrega y quita renglones, separando los kilos propios de los del cliente en los totales (ADR-13)", () => {
    renderDialog();
    elegirCliente("Uno");
    agregarRenglon("1:1", "2");
    agregarRenglon("2:2", "3");

    const totales = screen.getByTestId("totales-orden");
    expect(totales).toHaveTextContent("5");
    expect(totales).toHaveTextContent("1.600 kg");
    expect(totales).toHaveTextContent("120 kg");

    fireEvent.click(screen.getByRole("button", { name: "Quitar 26S-001 en G1-1" }));
    expect(screen.queryByRole("button", { name: "Quitar 26S-001 en G1-1" })).not.toBeInTheDocument();
  });

  it("no deja guardar sin al menos un renglón", async () => {
    const { onCrear } = renderDialog();
    elegirCliente("Uno");
    fireEvent.change(screen.getByLabelText("Destino"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La orden necesita al menos un renglón.");
    expect(onCrear).not.toHaveBeenCalled();
  });

  it("el pedido de venta se normaliza al salir del campo", () => {
    renderDialog();
    const campo = screen.getByLabelText("Pedido de venta");
    fireEvent.change(campo, { target: { value: "6-123" } });
    fireEvent.blur(campo);
    expect(campo).toHaveValue("06-00123");
  });

  it("el placeholder del pedido de venta usa la sucursal 02 de MacroGest, no la 06 del remito", () => {
    renderDialog();
    expect(screen.getByLabelText("Pedido de venta").getAttribute("placeholder")).toMatch(/^02-/);
  });

  it("al cambiar el cliente de una orden en edición, los renglones que quedan de otro cliente se marcan (renglonesDeOtroCliente)", () => {
    renderDialog({ orden: ORDEN_EDITABLE, filas: [PROPIO, CLIENTE_500], destinos: DESTINOS_500 });
    elegirCliente("Dos");

    expect(screen.getByText("Ya no corresponde al cliente elegido.")).toBeInTheDocument();
  });

  it("al editar, la propia reserva de la orden cuenta como disponible al ampliar la cantidad (R6.3)", async () => {
    const clienteReservado = fila({
      loteId: 2,
      loteCodigo: "26S-C01",
      ubicacionId: 2,
      ubicacion: "PLANTA",
      duenio: "Cliente",
      clienteNumero: 500,
      clienteDenominacion: "Cliente Uno",
      fisico: 5,
      comprometido: 3,
      pesoUnitarioKg: 40,
      envase: "Bolsa",
    });
    const { onActualizar } = renderDialog({
      orden: ORDEN_EDITABLE,
      filas: [PROPIO, clienteReservado],
      destinos: DESTINOS_500,
    });

    fireEvent.change(screen.getByLabelText("Cantidad de 26S-C01 en PLANTA"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onActualizar).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ items: [{ loteId: 2, ubicacionId: 2, cantidad: 5 }] }),
      ),
    );
  });

  it("al editar, una cantidad por encima del máximo real bloquea el guardado (no el límite inflado en vivo)", async () => {
    const clienteReservado = fila({
      loteId: 2,
      loteCodigo: "26S-C01",
      ubicacionId: 2,
      ubicacion: "PLANTA",
      duenio: "Cliente",
      clienteNumero: 500,
      clienteDenominacion: "Cliente Uno",
      fisico: 5,
      comprometido: 3,
      pesoUnitarioKg: 40,
      envase: "Bolsa",
    });
    const { onActualizar } = renderDialog({
      orden: ORDEN_EDITABLE,
      filas: [PROPIO, clienteReservado],
      destinos: DESTINOS_500,
    });

    fireEvent.change(screen.getByLabelText("Cantidad de 26S-C01 en PLANTA"), { target: { value: "9999" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Supera lo disponible.")).toBeInTheDocument();
    expect(onActualizar).not.toHaveBeenCalled();
  });

  it("no deja tipear una cantidad menor o igual a cero en un renglón ya cargado", async () => {
    const { onActualizar } = renderDialog({
      orden: ORDEN_EDITABLE,
      filas: [PROPIO, CLIENTE_500],
      destinos: DESTINOS_500,
    });

    fireEvent.change(screen.getByLabelText("Cantidad de 26S-C01 en PLANTA"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("La cantidad tiene que ser mayor a 0.")).toBeInTheDocument();
    expect(onActualizar).not.toHaveBeenCalled();
  });

  it("la edición manda la orden actualizada con el id", async () => {
    const { onActualizar, onClose } = renderDialog({
      orden: ORDEN_EDITABLE,
      filas: [PROPIO, CLIENTE_500],
      destinos: DESTINOS_500,
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onActualizar).toHaveBeenCalledWith(1, {
        clienteNumero: 500,
        destinoId: 10,
        numeroPedidoVenta: null,
        observaciones: null,
        items: [{ loteId: 2, ubicacionId: 2, cantidad: 3 }],
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("la alta rápida de destino llama a onAgregarDestino con el nombre tipeado", async () => {
    const { onAgregarDestino } = renderDialog({ orden: ORDEN_EDITABLE, filas: [PROPIO, CLIENTE_500], destinos: DESTINOS_500 });
    onAgregarDestino.mockResolvedValue({ id: 99, clienteNumero: 500, nombre: "Silo Nuevo", activo: true, enUso: 0 });

    fireEvent.change(screen.getByLabelText("Nuevo destino"), { target: { value: "Silo Nuevo" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar destino" }));

    await waitFor(() => expect(onAgregarDestino).toHaveBeenCalledWith("Silo Nuevo"));
  });

  it("agrupa las opciones por producto y cada lote muestra su disponible y observaciones (R2.1)", () => {
    renderDialog({ filas: [PROPIO, PROPIO_TRATADO] });
    const select = screen.getByLabelText("Agregar renglón");

    const sinTratar = select.querySelector('optgroup[label="DM 46E25 · Sin tratar · BigBag · 2026-2027"]');
    const tratada = select.querySelector('optgroup[label="DM 46E25 · Tratada · BigBag · 2026-2027"]');
    expect(sinTratar).not.toBeNull();
    expect(tratada).not.toBeNull();
    expect(within(sinTratar as HTMLElement).getByRole("option").textContent).toBe(
      "Lote 26S-001 · G1-1 · Propio · disp. 10 (8.000 kg)",
    );
    expect(within(tratada as HTMLElement).getByRole("option").textContent).toBe(
      "Lote 26S-003 · G1-3 · Propio · disp. 10 (8.000 kg) · Línea Profesional, curado con fungicida…",
    );
  });

  it("al elegir un lote muestra su disponible y sus observaciones completas (R2.2)", () => {
    renderDialog({ filas: [PROPIO, PROPIO_TRATADO] });
    expect(screen.queryByText(/^Disponible:/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Agregar renglón"), { target: { value: "3:3" } });

    expect(screen.getByText("Disponible: 10 unidades · 8.000 kg")).toBeInTheDocument();
    expect(screen.getByText(OBS_LARGA)).toBeInTheDocument();
    // Quien usa lector de pantalla oye lo mismo al pasar por el selector (la opción va recortada).
    expect(screen.getByLabelText("Agregar renglón")).toHaveAccessibleDescription(
      `Disponible: 10 unidades · 8.000 kg ${OBS_LARGA}`,
    );
  });

  it("cada renglón muestra el producto, el lote con ubicación y dueño, y las observaciones (R2.3)", () => {
    renderDialog({ filas: [PROPIO, PROPIO_TRATADO] });
    agregarRenglon("3:3", "2");

    const renglon = screen.getByRole("button", { name: "Quitar 26S-003 en G1-3" }).closest("li") as HTMLElement;
    expect(within(renglon).getByText("DM 46E25 · Tratada · BigBag")).toBeInTheDocument();
    expect(within(renglon).getByText("Lote 26S-003 · G1-3 · Propio")).toBeInTheDocument();
    expect(within(renglon).getByText(OBS_LARGA)).toHaveAttribute("title", OBS_LARGA);
    expect(within(renglon).getByLabelText("Cantidad de 26S-003 en G1-3")).toHaveValue(2);
  });

  /**
   * Hallazgo de la revisión (ronda 2): con `truncate` solo, el texto en una línea fijaba el ancho
   * mínimo del renglón y, a través de él, el del Modal. En un celular (375 px) el diálogo se iba de
   * la pantalla y Guardar quedaba fuera de alcance. `contain-inline-size` hace que el ancho lo decida
   * el renglón y no el texto (medido en navegador: jsdom no calcula layout, así que se fija la clase).
   */
  it("las observaciones del renglón se recortan sin ensanchar el diálogo en pantallas angostas (R2.3)", () => {
    renderDialog({ filas: [PROPIO_TRATADO] });
    agregarRenglon("3:3", "2");

    const renglon = screen.getByRole("button", { name: "Quitar 26S-003 en G1-3" }).closest("li") as HTMLElement;
    expect(within(renglon).getByText(OBS_LARGA)).toHaveClass("truncate", "contain-inline-size");
  });

  it("sin nada para agregar lo dice, y sin cliente aclara que la semilla de clientes aparece al elegirlo (R2.4)", () => {
    renderDialog({ filas: [CLIENTE_500] });
    expect(
      screen.getByText("No hay lotes con disponible. La semilla de clientes aparece al elegir el cliente."),
    ).toBeInTheDocument();

    elegirCliente("Uno");
    expect(screen.queryByText(/No hay lotes con disponible/)).not.toBeInTheDocument();
    expect(lotesOfrecidos()).toEqual(["26S-C01"]);
  });

  it("con el cliente elegido y nada disponible, no habla de la semilla de clientes (R2.4)", () => {
    renderDialog({ filas: [fila({ fisico: 0 })] });
    elegirCliente("Uno");
    expect(screen.getByText("No hay lotes con disponible.")).toBeInTheDocument();
  });

  it("si los filtros del diálogo no dejan ningún lote, lo dice (R2.4)", () => {
    renderDialog({ filas: [PROPIO] });
    fireEvent.change(screen.getByLabelText("Tratamiento"), { target: { value: "true" } });
    expect(screen.getByText("No hay lotes disponibles con esos filtros.")).toBeInTheDocument();
    expect(screen.getByLabelText("Agregar renglón")).toHaveAccessibleDescription(
      "No hay lotes disponibles con esos filtros.",
    );
    expect(lotesOfrecidos()).toEqual([]);
  });

  it("los filtros acotan sólo lo que se ofrece para agregar: nunca los renglones cargados ni los totales (R3.1)", () => {
    renderDialog({ filas: [PROPIO, PROPIO_TRATADO, PROPIO_OTRA_VARIEDAD] });
    agregarRenglon("3:3", "2");
    expect(lotesOfrecidos()).toEqual(["26S-001", "26S-004"]);

    const variedades = within(screen.getByLabelText("Variedad"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(variedades).toEqual(["Todas", "DM 46E25", "NS 4309"]);

    fireEvent.change(screen.getByLabelText("Variedad"), { target: { value: "2" } });
    expect(lotesOfrecidos()).toEqual(["26S-004"]);

    fireEvent.change(screen.getByLabelText("Variedad"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Envase"), { target: { value: "BigBag" } });
    expect(lotesOfrecidos()).toEqual(["26S-001"]);

    fireEvent.change(screen.getByLabelText("Tratamiento"), { target: { value: "false" } });
    expect(lotesOfrecidos()).toEqual(["26S-001"]);

    // El renglón tratado sigue cargado y cuenta en los totales, aunque los filtros lo excluyan.
    expect(screen.getByRole("button", { name: "Quitar 26S-003 en G1-3" })).toBeInTheDocument();
    expect(screen.getByTestId("totales-orden")).toHaveTextContent("2 unidades · 1.600 kg propios");
  });

  it("si un filtro deja afuera el lote elegido, el selector se limpia y Agregar no lo carga (R3.3)", () => {
    renderDialog({ filas: [PROPIO, PROPIO_TRATADO] });
    const selector = screen.getByLabelText("Agregar renglón");

    fireEvent.change(selector, { target: { value: "1:1" } });
    fireEvent.change(screen.getByLabelText("Tratamiento"), { target: { value: "false" } });
    expect(selector).toHaveValue("1:1"); // sigue visible: no se pierde la elección

    fireEvent.change(screen.getByLabelText("Tratamiento"), { target: { value: "true" } });
    expect(selector).toHaveValue("");
    expect(screen.queryByText(/^Disponible:/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    expect(screen.getByText("Elegí un lote y una ubicación.")).toBeInTheDocument();
    expect(screen.getByText("Todavía no agregaste ningún lote.")).toBeInTheDocument();

    // Volver a ampliar el filtro no resucita la elección que se había limpiado.
    fireEvent.change(screen.getByLabelText("Tratamiento"), { target: { value: "" } });
    expect(selector).toHaveValue("");
  });

  it("desde una fila propia de Stock arranca con sus filtros y ese lote elegido, sin cliente (R4.2)", () => {
    renderDialog({ filas: [PROPIO, PROPIO_TRATADO, PROPIO_OTRA_VARIEDAD], filaOrigen: PROPIO });

    expect(screen.getByLabelText("Variedad")).toHaveValue("1");
    expect(screen.getByLabelText("Tratamiento")).toHaveValue("false");
    expect(screen.getByLabelText("Envase")).toHaveValue("BigBag");
    expect(lotesOfrecidos()).toEqual(["26S-001"]);
    expect(screen.getByLabelText("Agregar renglón")).toHaveValue("1:1");
    expect(screen.getByLabelText("Cantidad")).toHaveValue(null); // la cantidad la tipea el usuario
    expect(screen.getByLabelText("Cliente")).toHaveValue("");
  });

  it("desde una fila de un cliente activo arranca con ese cliente y su lote elegidos (R4.3)", async () => {
    // El cliente con el que arranca lo fija la página (una sola vez, al abrir).
    const { onCrear } = renderDialog({ filaOrigen: CLIENTE_500, clienteInicial: 500 });

    expect(screen.getByLabelText("Cliente")).toHaveValue("500 · Cliente Uno");
    expect(screen.getByLabelText("Agregar renglón")).toHaveValue("2:2");
    expect(screen.getByLabelText("Destino")).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Destino"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onCrear).toHaveBeenCalledWith(
        expect.objectContaining({ clienteNumero: 500, items: [{ loteId: 2, ubicacionId: 2, cantidad: 3 }] }),
      ),
    );
  });

  it("desde una fila de un cliente que no está activo no preselecciona nada y avisa por qué (R4.3)", async () => {
    const deClienteDeBaja = fila({
      loteId: 5,
      loteCodigo: "26S-C09",
      ubicacionId: 5,
      ubicacion: "G1-5",
      duenio: "Cliente",
      clienteNumero: 700,
      clienteDenominacion: "Cliente Dado de Baja",
    });
    const { onCrear } = renderDialog({ filas: [PROPIO, deClienteDeBaja], filaOrigen: deClienteDeBaja });

    expect(
      screen.getByText(
        "El lote es de un cliente que no está activo en la copia de MacroGest: no se puede cargar en una orden.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Cliente")).toHaveValue("");
    expect(screen.getByLabelText("Destino")).toBeDisabled();
    expect(screen.getByLabelText("Agregar renglón")).toHaveValue("");
    expect(lotesOfrecidos()).not.toContain("26S-C09");

    // El formulario tampoco tiene un cliente escondido: guardar pide elegirlo.
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Elegí el cliente.")).toBeInTheDocument();
    expect(onCrear).not.toHaveBeenCalled();
  });

  /** Hallazgo de la revisión (ronda 1): el aviso quedaba fijo aunque la copia refrescada trajera al cliente. */
  it("el aviso del cliente del lote sigue a la copia de clientes actual (R4.3)", () => {
    const { actualizar } = renderDialog({ filaOrigen: CLIENTE_500, clientes: [] });
    const avisoInactivo = /El lote es de un cliente que no está activo en la copia de MacroGest/;
    expect(screen.getByRole("status")).toHaveTextContent(avisoInactivo);

    actualizar({ clientes: CLIENTES });

    expect(screen.queryByText(avisoInactivo)).not.toBeInTheDocument();
    // El formulario no se completa solo: el cliente ya se puede elegir a mano.
    expect(screen.getByLabelText("Cliente")).toHaveValue("");
    elegirCliente("Uno");
    expect(screen.getByLabelText("Cliente")).toHaveValue("500 · Cliente Uno");
  });

  it("sin copia de clientes no afirma que el dueño del lote esté de baja (R4.3)", () => {
    renderDialog({ filaOrigen: CLIENTE_500, clientes: [], copiaClientes: { ...COPIA_OK, sinCopia: true, cantidad: 0 } });

    expect(screen.queryByText(/no está activo en la copia de MacroGest/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Sin la copia de clientes de MacroGest no se sabe si el dueño del lote está activo: actualizá los clientes y elegilo.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Cliente")).toHaveValue("");
  });

  it("al editar una orden no se usa la fila de origen (R4.4)", () => {
    renderDialog({ orden: ORDEN_EDITABLE, filaOrigen: PROPIO });

    expect(screen.getByLabelText("Variedad")).toHaveValue("");
    expect(screen.getByLabelText("Tratamiento")).toHaveValue("");
    expect(screen.getByLabelText("Envase")).toHaveValue("");
    expect(screen.getByLabelText("Agregar renglón")).toHaveValue("");
    expect(screen.getByLabelText("Cliente")).toHaveValue("500 · Cliente Uno");
  });

  it("muestra el error del servidor dentro del diálogo", async () => {
    const { onCrear, onClose } = renderDialog();
    onCrear.mockRejectedValueOnce(errorServidor("Lote 26S-001 en G1-1: se necesitan 4 y hay 3."));
    elegirCliente("Uno");
    fireEvent.change(screen.getByLabelText("Destino"), { target: { value: "10" } });
    agregarRenglon("1:1", "4");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Lote 26S-001 en G1-1");
    expect(onClose).not.toHaveBeenCalled();
  });
});
