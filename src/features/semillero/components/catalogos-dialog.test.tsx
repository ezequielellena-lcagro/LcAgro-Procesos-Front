import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CatalogosSemilleroDto, ClienteCopiaDto, DestinoDto } from "../types";
import { CatalogosDialog } from "./catalogos-dialog";

const datos: CatalogosSemilleroDto = {
  especies: [
    { codigoRubro: 100, nombre: "Trigo", activo: true },
    { codigoRubro: 101, nombre: "Soja", activo: true },
  ],
  variedades: [{ id: 1, especie: "Soja", nombre: "DM 46E25", activo: true, enUso: 3 }],
  ubicaciones: [{ id: 1, codigo: "G1-6", descripcion: "Galpón 1", activo: true, enUso: 5 }],
  campanias: ["2025-2026", "2026-2027"],
  campaniaSugerida: "2026-2027",
};

const clientes: ClienteCopiaDto[] = [
  { numero: 1234, denominacion: "Juan Pérez", cuit: "20-12345678-9" },
  { numero: 5678, denominacion: "Agropecuaria del Sur SA", cuit: null },
];

const destinos: DestinoDto[] = [{ id: 1, clienteNumero: 1234, nombre: "Campo El Roble", activo: true, enUso: 2 }];

interface RenderOpts {
  datos?: CatalogosSemilleroDto;
  clienteElegido?: number | null;
  destinos?: DestinoDto[];
  /** Solapa a abrir antes de la aserción; por defecto queda la que trae el diálogo (Variedades). */
  solapa?: "Ubicaciones" | "Destinos por cliente";
}

/**
 * Cada mock se declara aparte (no como un objeto de props con `...over`): así conserva su tipo de
 * `Mock` completo (`mockRejectedValueOnce`, etc.), en vez de ensancharse a la unión con la firma de
 * la prop declarada en `CatalogosDialog` (mismo patrón que `renderDialog` en `orden-dialog.test.tsx`).
 */
function renderDialog(opts: RenderOpts = {}) {
  const onClose = vi.fn();
  const onGuardarVariedad = vi.fn().mockResolvedValue(undefined);
  const onGuardarUbicacion = vi.fn().mockResolvedValue(undefined);
  const onClienteChange = vi.fn();
  const onAgregarDestino = vi
    .fn()
    .mockResolvedValue({ id: 2, clienteNumero: 1234, nombre: "Campo Nuevo", activo: true, enUso: 0 });
  const onGuardarDestino = vi.fn().mockResolvedValue(undefined);
  render(
    <CatalogosDialog
      open
      onClose={onClose}
      datos={opts.datos ?? datos}
      onGuardarVariedad={onGuardarVariedad}
      onGuardarUbicacion={onGuardarUbicacion}
      clientes={clientes}
      clienteElegido={opts.clienteElegido === undefined ? 1234 : opts.clienteElegido}
      onClienteChange={onClienteChange}
      destinos={opts.destinos ?? destinos}
      cargandoDestinos={false}
      onAgregarDestino={onAgregarDestino}
      onGuardarDestino={onGuardarDestino}
    />,
  );
  if (opts.solapa) fireEvent.click(screen.getByRole("tab", { name: new RegExp(opts.solapa) }));
  return { onClose, onGuardarVariedad, onGuardarUbicacion, onClienteChange, onAgregarDestino, onGuardarDestino };
}

describe("CatalogosDialog", () => {
  it("abre en Variedades y las otras listas no están montadas hasta elegir su solapa", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "Catálogos" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nueva variedad")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nueva ubicación")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nuevo destino")).not.toBeInTheDocument();
  });

  it("ofrece una especie nueva del catálogo de MacroGest para agregar variedades", async () => {
    const props = renderDialog({
      datos: { ...datos, especies: [...datos.especies, { codigoRubro: 102, nombre: "Maíz", activo: true }] },
    });
    fireEvent.change(screen.getByLabelText("Especie de la nueva variedad"), { target: { value: "Maíz" } });
    fireEvent.change(screen.getByLabelText("Nueva variedad"), { target: { value: "DK 7210" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar variedad" }));
    await waitFor(() =>
      expect(props.onGuardarVariedad).toHaveBeenCalledWith({ especie: "Maíz", nombre: "DK 7210", activo: true }),
    );
  });

  it("agrega una variedad a la especie elegida y limpia el campo", async () => {
    const props = renderDialog();
    fireEvent.change(screen.getByLabelText("Especie de la nueva variedad"), { target: { value: "Trigo" } });
    fireEvent.change(screen.getByLabelText("Nueva variedad"), { target: { value: "DM CATALPA" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar variedad" }));
    await waitFor(() =>
      expect(props.onGuardarVariedad).toHaveBeenCalledWith({ especie: "Trigo", nombre: "DM CATALPA", activo: true }),
    );
    expect(screen.getByLabelText("Nueva variedad")).toHaveValue("");
  });

  /**
   * Lo cargado es una tabla con encabezados, no una lista de renglones: la especie es una columna
   * más (antes eran títulos sueltos, y las diez de MacroGest se titulaban aunque no tuvieran nada).
   */
  it("lista las variedades en una tabla con la especie como columna", () => {
    renderDialog();
    const tabla = screen.getByRole("table");
    for (const columna of ["Especie", "Variedad", "Lotes", "Activa"]) {
      expect(within(tabla).getByRole("columnheader", { name: new RegExp(columna) })).toBeInTheDocument();
    }
    const fila = within(tabla).getByRole("row", { name: /DM 46E25/ });
    expect(within(fila).getByText("Soja")).toBeInTheDocument();
    expect(within(fila).getByText("3")).toBeInTheDocument();
  });

  it("una variedad en uso se desactiva, no se borra", async () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole("checkbox", { name: "DM 46E25 activa" }));
    await waitFor(() =>
      expect(props.onGuardarVariedad).toHaveBeenCalledWith({ id: 1, especie: "Soja", nombre: "DM 46E25", activo: false }),
    );
  });

  it("agrega una ubicación del galpón", async () => {
    const props = renderDialog({ solapa: "Ubicaciones" });
    fireEvent.change(screen.getByLabelText("Nueva ubicación"), { target: { value: "G5-18" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar ubicación" }));
    await waitFor(() =>
      expect(props.onGuardarUbicacion).toHaveBeenCalledWith({ codigo: "G5-18", descripcion: null, activo: true }),
    );
  });

  it("si el servidor rechaza (duplicado) muestra el motivo", async () => {
    const props = renderDialog({ solapa: "Ubicaciones" });
    props.onGuardarUbicacion.mockRejectedValueOnce(new Error("Ya existe la ubicación G1-6."));
    fireEvent.change(screen.getByLabelText("Nueva ubicación"), { target: { value: "g1-6" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar ubicación" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("sin cliente elegido no se pueden ver ni agregar destinos", () => {
    renderDialog({ solapa: "Destinos por cliente", clienteElegido: null, destinos: [] });
    expect(screen.getByText("Elegí un cliente para ver sus destinos.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nuevo destino")).not.toBeInTheDocument();
  });

  it("cambia de cliente para ver sus destinos", () => {
    const props = renderDialog({ solapa: "Destinos por cliente", clienteElegido: null, destinos: [] });
    // No `getByRole("combobox")`: el `<select>` nativo de Variedades también lleva ese rol
    // implícito. El buscador de clientes se distingue por su placeholder.
    const input = screen.getByPlaceholderText("Buscar cliente…");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "perez" } });
    fireEvent.mouseDown(screen.getByText("1234 · Juan Pérez"));
    expect(props.onClienteChange).toHaveBeenCalledWith(1234);
  });

  it("agrega un destino para el cliente elegido y limpia el campo", async () => {
    const props = renderDialog({ solapa: "Destinos por cliente" });
    fireEvent.change(screen.getByLabelText("Nuevo destino"), { target: { value: "Campo Nuevo" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar destino" }));
    await waitFor(() => expect(props.onAgregarDestino).toHaveBeenCalledWith("Campo Nuevo"));
    expect(screen.getByLabelText("Nuevo destino")).toHaveValue("");
  });

  it("un destino en uso se desactiva, no se borra", async () => {
    const props = renderDialog({ solapa: "Destinos por cliente" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Campo El Roble activo" }));
    await waitFor(() =>
      expect(props.onGuardarDestino).toHaveBeenCalledWith({ id: 1, nombre: "Campo El Roble", activo: false }),
    );
  });

  it("se puede corregir el nombre de un destino", async () => {
    const props = renderDialog({ solapa: "Destinos por cliente" });
    fireEvent.click(screen.getByRole("button", { name: "Renombrar Campo El Roble" }));
    fireEvent.change(screen.getByLabelText("Nombre de Campo El Roble"), { target: { value: "Campo El Roble Norte" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar nombre" }));
    await waitFor(() =>
      expect(props.onGuardarDestino).toHaveBeenCalledWith({ id: 1, nombre: "Campo El Roble Norte", activo: true }),
    );
  });

  /**
   * El refresco manual de la copia de clientes vive sólo en el diálogo de la orden, que es donde
   * frena el trabajo si falta un cliente; acá era ruido arriba de la única lista de la solapa.
   */
  it("no ofrece actualizar la copia de clientes", () => {
    renderDialog({ solapa: "Destinos por cliente" });
    expect(screen.queryByRole("button", { name: "Actualizar clientes" })).not.toBeInTheDocument();
  });

  /** Las especies se sincronizan solas cada 24 h contra MacroGest: el botón manual era ruido. */
  it("no muestra la leyenda de especies de MacroGest", () => {
    renderDialog();
    expect(screen.queryByText(/Especies de MacroGest/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actualizar especies" })).not.toBeInTheDocument();
  });

  it("se cierra con el botón Cerrar del diálogo", () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
