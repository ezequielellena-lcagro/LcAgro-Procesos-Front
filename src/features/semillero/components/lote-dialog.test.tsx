import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it, vi } from "vitest";
import type { ClienteCopiaDto, LoteDto, UbicacionDto, VariedadDto } from "../types";
import { LoteDialog } from "./lote-dialog";

const VARIEDADES: VariedadDto[] = [
  { id: 1, especie: "Soja", nombre: "DM 46E25", activo: true, enUso: 0 },
  { id: 9, especie: "Soja", nombre: "DM VIEJA", activo: false, enUso: 3 },
];
const UBICACIONES: UbicacionDto[] = [{ id: 1, codigo: "G1-6", descripcion: null, activo: true, enUso: 0 }];
const CAMPANIAS = ["2025-2026", "2026-2027", "2027-2028"];
const CLIENTES: ClienteCopiaDto[] = [
  { numero: 1234, denominacion: "Juan Pérez", cuit: "20-12345678-9" },
  { numero: 5678, denominacion: "Agropecuaria del Sur SA", cuit: null },
];

function renderDialog(lote: LoteDto | null = null) {
  const onCrear = vi.fn().mockResolvedValue(undefined);
  const onActualizar = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <LoteDialog
      open
      lote={lote}
      variedades={VARIEDADES}
      especies={[{ codigoRubro: 101, nombre: "Soja", activo: true }]}
      ubicaciones={UBICACIONES}
      campanias={CAMPANIAS}
      campaniaSugerida="2026-2027"
      clientes={CLIENTES}
      onCrear={onCrear}
      onActualizar={onActualizar}
      onClose={onClose}
    />,
  );
  return { onCrear, onActualizar, onClose };
}

const escribir = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const LOTE_EDITABLE: LoteDto = {
  id: 5,
  codigo: "26S-009",
  campania: "2026-2027",
  especie: "Soja",
  variedadId: 9,
  variedad: "DM VIEJA",
  envase: "BigBag",
  pesoUnitarioKg: 800,
  tratada: false,
  pg: null,
  pmil: null,
  observaciones: null,
  duenio: "Propio",
  clienteNumero: null,
  clienteDenominacion: null,
  duenioEditable: true,
  envaseYPesoEditables: true,
};

function errorServidor(detail: string) {
  return new AxiosError("Request failed", "409", undefined, null, {
    status: 409,
    statusText: "Conflict",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data: { status: 409, detail },
  });
}

describe("LoteDialog", () => {
  it("el alta manda el lote con dueño propio, ubicación y cantidad inicial", async () => {
    const { onCrear, onClose } = renderDialog();
    escribir("Código de lote", "26s-001");
    escribir("Variedad", "1");
    escribir("Ubicación", "1");
    escribir("Cantidad", "30");
    escribir("PG %", "95");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onCrear).toHaveBeenCalledWith({
        codigo: "26s-001",
        campania: "2026-2027",
        variedadId: 1,
        envase: "BigBag",
        pesoUnitarioKg: 800,
        tratada: false,
        pg: 95,
        pmil: null,
        observaciones: null,
        duenio: "Propio",
        clienteNumero: null,
        ubicacionId: 1,
        cantidad: 30,
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("al elegir bolsa propone 40 kg", () => {
    renderDialog();
    escribir("Envase", "Bolsa");
    expect(screen.getByLabelText("Peso unitario (kg)")).toHaveValue(40);
  });

  it("no ofrece variedades desactivadas para un lote nuevo", () => {
    renderDialog();
    expect(screen.queryByRole("option", { name: "DM VIEJA" })).not.toBeInTheDocument();
  });

  it("explica lo que falta sin llamar al servidor", async () => {
    const { onCrear } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Escribí el código del lote.")).toBeInTheDocument();
    expect(screen.getByText("La cantidad tiene que ser mayor a 0.")).toBeInTheDocument();
    expect(onCrear).not.toHaveBeenCalled();
  });

  it("la campaña se elige de un selector, no se puede tipear un valor libre", () => {
    renderDialog();
    const campo = screen.getByLabelText("Campaña");
    expect(campo.tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: "2025-2026" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2027-2028" })).toBeInTheDocument();
  });

  it("el alta con dueño Cliente exige elegir un cliente antes de guardar", async () => {
    const { onCrear } = renderDialog();
    escribir("Código de lote", "26S-002");
    escribir("Variedad", "1");
    escribir("Ubicación", "1");
    escribir("Cantidad", "10");
    escribir("Dueño", "Cliente");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Elegí el cliente.")).toBeInTheDocument();
    expect(onCrear).not.toHaveBeenCalled();
  });

  it("el alta con dueño Cliente manda el número del cliente elegido", async () => {
    const { onCrear, onClose } = renderDialog();
    escribir("Código de lote", "26S-002");
    escribir("Variedad", "1");
    escribir("Ubicación", "1");
    escribir("Cantidad", "10");
    escribir("Dueño", "Cliente");

    const combo = screen.getByLabelText("Cliente");
    fireEvent.focus(combo);
    fireEvent.change(combo, { target: { value: "perez" } });
    fireEvent.mouseDown(screen.getByText("1234 · Juan Pérez"));

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onCrear).toHaveBeenCalledWith(expect.objectContaining({ duenio: "Cliente", clienteNumero: 1234 })),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("al editar no pide ubicación ni cantidad y conserva la variedad aunque esté desactivada", async () => {
    const { onActualizar } = renderDialog(LOTE_EDITABLE);
    expect(screen.queryByLabelText("Cantidad")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Tratada"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onActualizar).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ variedadId: 9, tratada: true, duenio: "Propio", clienteNumero: null }),
      ),
    );
  });

  it("al editar, los campos de dueño se deshabilitan cuando duenioEditable es false", () => {
    renderDialog({ ...LOTE_EDITABLE, duenioEditable: false });
    expect(screen.getByLabelText("Dueño")).toBeDisabled();
  });

  it("al editar, envase y peso se deshabilitan cuando envaseYPesoEditables es false, con leyenda explicativa", () => {
    renderDialog({ ...LOTE_EDITABLE, envaseYPesoEditables: false });
    expect(screen.getByLabelText("Envase")).toBeDisabled();
    expect(screen.getByLabelText("Peso unitario (kg)")).toBeDisabled();
    expect(
      screen.getByText(/el envase y el peso quedan fijos/i),
    ).toBeInTheDocument();
    // El resto de los campos sigue editable.
    expect(screen.getByLabelText("Variedad")).not.toBeDisabled();
    expect(screen.getByLabelText("Tratada")).not.toBeDisabled();
  });

  it("muestra el error del servidor dentro del diálogo", async () => {
    const { onCrear, onClose } = renderDialog();
    onCrear.mockRejectedValueOnce(errorServidor("Ya existe el lote 26S-001 en la campaña 2026-2027."));
    escribir("Código de lote", "26S-001");
    escribir("Variedad", "1");
    escribir("Ubicación", "1");
    escribir("Cantidad", "1");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ya existe el lote 26S-001");
    expect(onClose).not.toHaveBeenCalled();
  });
});
