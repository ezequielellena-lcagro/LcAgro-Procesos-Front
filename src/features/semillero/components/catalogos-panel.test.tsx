import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CatalogosSemilleroDto, ClienteCopiaDto, DestinoDto, EstadoCopiaClientesDto } from "../types";
import { CatalogosPanel } from "./catalogos-panel";

const datos: CatalogosSemilleroDto = {
  variedades: [{ id: 1, especie: "Soja", nombre: "DM 46E25", activo: true, enUso: 3 }],
  ubicaciones: [{ id: 1, codigo: "G1-6", descripcion: "Galpón 1", activo: true, enUso: 5 }],
  campanias: ["2025-2026", "2026-2027"],
  campaniaSugerida: "2026-2027",
};

const clientes: ClienteCopiaDto[] = [
  { numero: 1234, denominacion: "Juan Pérez", cuit: "20-12345678-9" },
  { numero: 5678, denominacion: "Agropecuaria del Sur SA", cuit: null },
];

const copiaOk: EstadoCopiaClientesDto = {
  ultimaSincronizacion: "2026-09-13T12:00:00Z",
  ultimoIntentoFallido: null,
  ultimoError: null,
  desactualizada: false,
  sinCopia: false,
  cantidad: 2,
};

const destinos: DestinoDto[] = [{ id: 1, clienteNumero: 1234, nombre: "Campo El Roble", activo: true, enUso: 2 }];

interface RenderOpts {
  clienteElegido?: number | null;
  destinos?: DestinoDto[];
}

/**
 * Cada mock se declara aparte (no como un objeto de props con `...over`): así conserva su tipo de
 * `Mock` completo (`mockRejectedValueOnce`, etc.), en vez de ensancharse a la unión con la firma de
 * la prop declarada en `CatalogosPanel` (mismo patrón que `renderDialog` en `orden-dialog.test.tsx`).
 */
function renderPanel(opts: RenderOpts = {}) {
  const onGuardarVariedad = vi.fn().mockResolvedValue(undefined);
  const onGuardarUbicacion = vi.fn().mockResolvedValue(undefined);
  const onActualizarClientes = vi.fn();
  const onClienteChange = vi.fn();
  const onAgregarDestino = vi
    .fn()
    .mockResolvedValue({ id: 2, clienteNumero: 1234, nombre: "Campo Nuevo", activo: true, enUso: 0 });
  const onGuardarDestino = vi.fn().mockResolvedValue(undefined);
  render(
    <CatalogosPanel
      datos={datos}
      onGuardarVariedad={onGuardarVariedad}
      onGuardarUbicacion={onGuardarUbicacion}
      clientes={clientes}
      copiaClientes={copiaOk}
      actualizandoClientes={false}
      onActualizarClientes={onActualizarClientes}
      clienteElegido={opts.clienteElegido === undefined ? 1234 : opts.clienteElegido}
      onClienteChange={onClienteChange}
      destinos={opts.destinos ?? destinos}
      cargandoDestinos={false}
      onAgregarDestino={onAgregarDestino}
      onGuardarDestino={onGuardarDestino}
    />,
  );
  return { onGuardarVariedad, onGuardarUbicacion, onActualizarClientes, onClienteChange, onAgregarDestino, onGuardarDestino };
}

describe("CatalogosPanel", () => {
  it("agrega una variedad a la especie elegida y limpia el campo", async () => {
    const props = renderPanel();
    fireEvent.change(screen.getByLabelText("Especie de la nueva variedad"), { target: { value: "Trigo" } });
    fireEvent.change(screen.getByLabelText("Nueva variedad"), { target: { value: "DM CATALPA" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar variedad" }));
    await waitFor(() =>
      expect(props.onGuardarVariedad).toHaveBeenCalledWith({ especie: "Trigo", nombre: "DM CATALPA", activo: true }),
    );
    expect(screen.getByLabelText("Nueva variedad")).toHaveValue("");
  });

  it("una variedad en uso se desactiva, no se borra", async () => {
    const props = renderPanel();
    expect(screen.getByText("3 lotes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "DM 46E25 activa" }));
    await waitFor(() =>
      expect(props.onGuardarVariedad).toHaveBeenCalledWith({ id: 1, especie: "Soja", nombre: "DM 46E25", activo: false }),
    );
  });

  it("agrega una ubicación del galpón", async () => {
    const props = renderPanel();
    fireEvent.change(screen.getByLabelText("Nueva ubicación"), { target: { value: "G5-18" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar ubicación" }));
    await waitFor(() =>
      expect(props.onGuardarUbicacion).toHaveBeenCalledWith({ codigo: "G5-18", descripcion: null, activo: true }),
    );
  });

  it("si el servidor rechaza (duplicado) muestra el motivo", async () => {
    const props = renderPanel();
    props.onGuardarUbicacion.mockRejectedValueOnce(new Error("Ya existe la ubicación G1-6."));
    fireEvent.change(screen.getByLabelText("Nueva ubicación"), { target: { value: "g1-6" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar ubicación" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("sin cliente elegido no se pueden ver ni agregar destinos", () => {
    renderPanel({ clienteElegido: null, destinos: [] });
    expect(screen.getByText("Elegí un cliente para ver sus destinos.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nuevo destino")).not.toBeInTheDocument();
  });

  it("cambia de cliente para ver sus destinos", () => {
    const props = renderPanel({ clienteElegido: null, destinos: [] });
    // No `getByRole("combobox")`: los `<select>` nativos de Variedades/Ubicaciones también llevan
    // ese rol implícito. El buscador de clientes se distingue por su placeholder.
    const input = screen.getByPlaceholderText("Buscar cliente…");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "perez" } });
    fireEvent.mouseDown(screen.getByText("1234 · Juan Pérez"));
    expect(props.onClienteChange).toHaveBeenCalledWith(1234);
  });

  it("agrega un destino para el cliente elegido y limpia el campo", async () => {
    const props = renderPanel();
    fireEvent.change(screen.getByLabelText("Nuevo destino"), { target: { value: "Campo Nuevo" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar destino" }));
    await waitFor(() => expect(props.onAgregarDestino).toHaveBeenCalledWith("Campo Nuevo"));
    expect(screen.getByLabelText("Nuevo destino")).toHaveValue("");
  });

  it("un destino en uso se desactiva, no se borra", async () => {
    const props = renderPanel();
    expect(screen.getByText("2 órdenes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Campo El Roble activo" }));
    await waitFor(() =>
      expect(props.onGuardarDestino).toHaveBeenCalledWith({ id: 1, nombre: "Campo El Roble", activo: false }),
    );
  });

  it("se puede corregir el nombre de un destino", async () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Renombrar Campo El Roble" }));
    fireEvent.change(screen.getByLabelText("Nombre de Campo El Roble"), { target: { value: "Campo El Roble Norte" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar nombre" }));
    await waitFor(() =>
      expect(props.onGuardarDestino).toHaveBeenCalledWith({ id: 1, nombre: "Campo El Roble Norte", activo: true }),
    );
  });

  it("muestra el estado de la copia de clientes y permite actualizarla", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar clientes" }));
    expect(props.onActualizarClientes).toHaveBeenCalled();
  });
});
