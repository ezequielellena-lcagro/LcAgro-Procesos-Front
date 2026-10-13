import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it, vi } from "vitest";
import type { StockFilaDto, UbicacionDto } from "../types";
import type { OperacionStock } from "./stock-panel";
import { MovimientoDialog } from "./movimiento-dialog";

/**
 * Ingreso adicional (R5.1, decisión #1077 punto 2, distinto de un ajuste), ajuste con motivo de
 * lista cerrada y signo restringido según el motivo (R5.2, decisión #1077 punto 5) y reubicación
 * validada contra el disponible, no el físico (R5.3).
 */
const FILA: StockFilaDto = {
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
};
const UBICACIONES: UbicacionDto[] = [
  { id: 1, codigo: "G1-6", descripcion: null, activo: true, enUso: 1 },
  { id: 2, codigo: "G5-18", descripcion: null, activo: true, enUso: 0 },
  { id: 3, codigo: "G9-9", descripcion: null, activo: false, enUso: 0 },
];
const UBICACION_NUEVA: UbicacionDto = { id: 7, codigo: "G4-22", descripcion: null, activo: true, enUso: 0 };

function renderDialog(operacion: OperacionStock, filaOverride: Partial<StockFilaDto> = {}) {
  const onIngreso = vi.fn().mockResolvedValue(undefined);
  const onAjuste = vi.fn().mockResolvedValue(undefined);
  const onReubicar = vi.fn().mockResolvedValue(undefined);
  const onAsegurarUbicacion = vi.fn().mockResolvedValue(UBICACION_NUEVA);
  const onClose = vi.fn();
  render(
    <MovimientoDialog
      operacion={operacion}
      fila={{ ...FILA, ...filaOverride }}
      ubicaciones={UBICACIONES}
      onAsegurarUbicacion={onAsegurarUbicacion}
      onIngreso={onIngreso}
      onAjuste={onAjuste}
      onReubicar={onReubicar}
      onClose={onClose}
    />,
  );
  return { onIngreso, onAjuste, onReubicar, onAsegurarUbicacion, onClose };
}

const escribir = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const confirmar = () => fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

function errorServidor(detail: string) {
  return new AxiosError("Request failed", "409", undefined, null, {
    status: 409,
    statusText: "Conflict",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data: { status: 409, detail },
  });
}

describe("MovimientoDialog", () => {
  it("muestra de qué lote y ubicación se trata, con su físico y disponible", () => {
    renderDialog("ajuste");
    expect(screen.getByText("26S-001 · DM 46E25 · G1-6")).toBeInTheDocument();
    expect(screen.getByText("Físico 10 · Disponible 7")).toBeInTheDocument();
  });

  it("el ingreso adicional a un lote existente no pasa por un ajuste (decisión #2)", async () => {
    const { onIngreso, onAjuste, onClose } = renderDialog("ingreso");
    escribir("Cantidad", "15");
    escribir("Observación", "Cosecha adicional de octubre");
    confirmar();

    await waitFor(() =>
      expect(onIngreso).toHaveBeenCalledWith({
        loteId: 1,
        ubicacionId: 1,
        cantidad: 15,
        observacion: "Cosecha adicional de octubre",
      }),
    );
    expect(onAjuste).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("el ingreso exige una cantidad mayor a 0", async () => {
    const { onIngreso } = renderDialog("ingreso");
    confirmar();
    expect(await screen.findByText("La cantidad tiene que ser mayor a 0.")).toBeInTheDocument();
    expect(onIngreso).not.toHaveBeenCalled();
  });

  it("el ajuste exige elegir un motivo de la lista cerrada", async () => {
    const { onAjuste } = renderDialog("ajuste");
    escribir("Cantidad", "-2");
    confirmar();
    expect(await screen.findByText("Elegí el motivo del ajuste.")).toBeInTheDocument();
    expect(onAjuste).not.toHaveBeenCalled();
  });

  it('el ajuste con motivo "Otro" exige el detalle (R1.4)', async () => {
    const { onAjuste } = renderDialog("ajuste");
    escribir("Cantidad", "3");
    escribir("Motivo", "Otro");
    confirmar();
    expect(
      await screen.findByText('Escribí el detalle cuando el motivo es "Otro".'),
    ).toBeInTheDocument();
    expect(onAjuste).not.toHaveBeenCalled();
  });

  it('el ajuste con motivo "Otro" manda el detalle como observación', async () => {
    const { onAjuste, onClose } = renderDialog("ajuste");
    escribir("Cantidad", "3");
    escribir("Motivo", "Otro");
    escribir("Detalle (obligatorio)", "Se contó de más en el ingreso anterior");
    confirmar();

    await waitFor(() =>
      expect(onAjuste).toHaveBeenCalledWith({
        loteId: 1,
        ubicacionId: 1,
        cantidad: 3,
        motivo: "Otro",
        observacion: "Se contó de más en el ingreso anterior",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("un motivo de sólo negativo rechaza un ajuste positivo (decisión #1077 punto 5)", async () => {
    const { onAjuste } = renderDialog("ajuste");
    escribir("Cantidad", "4");
    escribir("Motivo", "RoturaPerdida");
    confirmar();
    expect(await screen.findByText("Ese motivo sólo admite un ajuste negativo.")).toBeInTheDocument();
    expect(onAjuste).not.toHaveBeenCalled();
  });

  it("el mismo motivo de sólo negativo acepta una cantidad negativa", async () => {
    const { onAjuste, onClose } = renderDialog("ajuste");
    escribir("Cantidad", "-4");
    escribir("Motivo", "RoturaPerdida");
    confirmar();

    await waitFor(() =>
      expect(onAjuste).toHaveBeenCalledWith({
        loteId: 1,
        ubicacionId: 1,
        cantidad: -4,
        motivo: "RoturaPerdida",
        observacion: null,
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("un motivo sin restricción de signo acepta un ajuste positivo", async () => {
    const { onAjuste } = renderDialog("ajuste");
    escribir("Cantidad", "6");
    escribir("Motivo", "RecuentoFisico");
    confirmar();

    await waitFor(() =>
      expect(onAjuste).toHaveBeenCalledWith({
        loteId: 1,
        ubicacionId: 1,
        cantidad: 6,
        motivo: "RecuentoFisico",
        observacion: null,
      }),
    );
  });

  it("el destino se escribe a mano y sugiere los lugares activos, sin la ubicación de origen", () => {
    renderDialog("reubicacion");
    expect(screen.getByLabelText("Destino").tagName).toBe("INPUT");
    const sugeridas = [
      ...document.querySelectorAll<HTMLOptionElement>("#ubicacionDestino-sugerencias option"),
    ].map((o) => o.value);
    expect(sugeridas).toEqual(["G5-18"]);
  });

  it("reubicar exige escribir a dónde va", async () => {
    const { onReubicar } = renderDialog("reubicacion");
    escribir("Cantidad", "2");
    confirmar();
    expect(await screen.findByText("Escribí a dónde va.")).toBeInTheDocument();
    expect(onReubicar).not.toHaveBeenCalled();
  });

  it("reubicar al mismo lugar donde ya está no se manda", async () => {
    const { onReubicar } = renderDialog("reubicacion");
    escribir("Destino", "g1-6");
    escribir("Cantidad", "2");
    confirmar();
    expect(await screen.findByText("Ahí es donde ya está: escribí otro lugar.")).toBeInTheDocument();
    expect(onReubicar).not.toHaveBeenCalled();
  });

  it("reubicar a un lugar que todavía no existe lo da de alta solo", async () => {
    const { onReubicar, onAsegurarUbicacion } = renderDialog("reubicacion");
    escribir("Destino", "G4-22");
    escribir("Cantidad", "2");
    confirmar();

    await waitFor(() => expect(onAsegurarUbicacion).toHaveBeenCalledWith("G4-22"));
    expect(onReubicar).toHaveBeenCalledWith(
      expect.objectContaining({ ubicacionOrigenId: 1, ubicacionDestinoId: 7 }),
    );
  });

  it("reubicar más que lo disponible avisa antes de mandar (R5.3)", async () => {
    const { onReubicar } = renderDialog("reubicacion");
    escribir("Destino", "G5-18");
    escribir("Cantidad", "8");
    confirmar();
    expect(await screen.findByText(/Hay 7 disponibles/)).toBeInTheDocument();
    expect(onReubicar).not.toHaveBeenCalled();
  });

  it("reubicar dentro del disponible manda origen y destino correctos", async () => {
    const { onReubicar, onAsegurarUbicacion, onClose } = renderDialog("reubicacion");
    escribir("Destino", "G5-18");
    escribir("Cantidad", "7");
    escribir("Observación", "Reordenamiento de galpón");
    confirmar();

    await waitFor(() =>
      expect(onReubicar).toHaveBeenCalledWith({
        loteId: 1,
        ubicacionOrigenId: 1,
        ubicacionDestinoId: 2,
        cantidad: 7,
        observacion: "Reordenamiento de galpón",
      }),
    );
    // El lugar ya estaba en el catálogo: no hace falta darlo de alta de nuevo.
    expect(onAsegurarUbicacion).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("muestra el error del servidor dentro del diálogo", async () => {
    const { onAjuste, onClose } = renderDialog("ajuste");
    onAjuste.mockRejectedValueOnce(errorServidor("Lote 26S-001 en G1-6: se necesitan 4 y hay 3."));
    escribir("Cantidad", "4");
    escribir("Motivo", "RecuentoFisico");
    confirmar();

    expect(await screen.findByRole("alert")).toHaveTextContent("Lote 26S-001 en G1-6");
    expect(onClose).not.toHaveBeenCalled();
  });
});
