import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it, vi } from "vitest";
import type { OrdenCargaDto } from "../types";
import { TransicionOrdenDialog, type Transicion } from "./transicion-orden-dialog";

/**
 * Despacho (R6.4) y anulación (R6.5) de una orden Pendiente: remito obligatorio y normalizado al
 * despachar, motivo de la lista cerrada (con detalle si "Otro") al anular.
 */
const ORDEN: OrdenCargaDto = {
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

function renderDialog(transicion: Transicion | null) {
  const onDespachar = vi.fn().mockResolvedValue(undefined);
  const onAnular = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const onErrorRefrescarStock = vi.fn();
  render(
    <TransicionOrdenDialog
      transicion={transicion}
      onDespachar={onDespachar}
      onAnular={onAnular}
      onErrorRefrescarStock={onErrorRefrescarStock}
      onClose={onClose}
    />,
  );
  return { onDespachar, onAnular, onClose, onErrorRefrescarStock };
}

const escribir = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

function errorServidor(detail: string) {
  return new AxiosError("Request failed", "409", undefined, null, {
    status: 409,
    statusText: "Conflict",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data: { status: 409, detail },
  });
}

describe("TransicionOrdenDialog", () => {
  it("no muestra nada si no hay ninguna transición en curso", () => {
    renderDialog(null);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("al despachar, muestra el cliente y el destino de la orden", () => {
    renderDialog({ tipo: "despachar", orden: ORDEN });
    expect(screen.getByText("Cliente Uno · Campo Norte")).toBeInTheDocument();
  });

  it("al despachar, el remito es obligatorio", async () => {
    const { onDespachar } = renderDialog({ tipo: "despachar", orden: ORDEN });
    fireEvent.click(screen.getByRole("button", { name: "Despachar" }));

    expect(
      await screen.findByText("El remito es obligatorio y tiene que tener el formato NN-NNNNN."),
    ).toBeInTheDocument();
    expect(onDespachar).not.toHaveBeenCalled();
  });

  it("al despachar, normaliza el remito y el pedido antes de mandarlos (R6.2)", async () => {
    const { onDespachar, onClose } = renderDialog({ tipo: "despachar", orden: ORDEN });
    escribir("Remito", "6-1");
    escribir("Pedido de venta", "6-45");
    fireEvent.click(screen.getByRole("button", { name: "Despachar" }));

    await waitFor(() =>
      expect(onDespachar).toHaveBeenCalledWith(1, {
        numeroRemito: "06-00001",
        numeroPedidoVenta: "06-00045",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("al despachar, el pedido es opcional pero si se completa mal lo avisa", async () => {
    renderDialog({ tipo: "despachar", orden: ORDEN });
    escribir("Remito", "6-1");
    escribir("Pedido de venta", "no-es-un-numero");
    fireEvent.click(screen.getByRole("button", { name: "Despachar" }));

    expect(await screen.findByText("El pedido tiene que tener el formato NN-NNNNN.")).toBeInTheDocument();
  });

  it("al despachar, un 409 del backend se muestra en el diálogo y avisa para refrescar el stock (R6.4/R6.7)", async () => {
    const { onDespachar, onErrorRefrescarStock, onClose } = renderDialog({
      tipo: "despachar",
      orden: ORDEN,
    });
    onDespachar.mockRejectedValueOnce(
      errorServidor("Lote 26S-001 en G1-1: físico insuficiente para despachar."),
    );
    escribir("Remito", "6-1");
    fireEvent.click(screen.getByRole("button", { name: "Despachar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("físico insuficiente");
    expect(onErrorRefrescarStock).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("al anular, exige elegir un motivo de la lista cerrada (R1.5)", async () => {
    const { onAnular } = renderDialog({ tipo: "anular", orden: ORDEN });
    fireEvent.click(screen.getByRole("button", { name: "Anular" }));

    expect(await screen.findByText("Elegí el motivo de la anulación.")).toBeInTheDocument();
    expect(onAnular).not.toHaveBeenCalled();
  });

  it('al anular con motivo "Otro", exige el detalle (R1.5)', async () => {
    const { onAnular } = renderDialog({ tipo: "anular", orden: ORDEN });
    escribir("Motivo", "Otro");
    fireEvent.click(screen.getByRole("button", { name: "Anular" }));

    expect(
      await screen.findByText('Escribí el detalle cuando el motivo es "Otro".'),
    ).toBeInTheDocument();
    expect(onAnular).not.toHaveBeenCalled();
  });

  it("al anular con un motivo cerrado, manda el motivo y el detalle vacío como null", async () => {
    const { onAnular, onClose } = renderDialog({ tipo: "anular", orden: ORDEN });
    escribir("Motivo", "ClienteNoRetiro");
    fireEvent.click(screen.getByRole("button", { name: "Anular" }));

    await waitFor(() =>
      expect(onAnular).toHaveBeenCalledWith(1, { motivo: "ClienteNoRetiro", detalle: null }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('al anular con motivo "Otro", manda el detalle tipeado', async () => {
    const { onAnular } = renderDialog({ tipo: "anular", orden: ORDEN });
    escribir("Motivo", "Otro");
    escribir("Detalle (obligatorio)", "Se armó con el lote equivocado");
    fireEvent.click(screen.getByRole("button", { name: "Anular" }));

    await waitFor(() =>
      expect(onAnular).toHaveBeenCalledWith(1, {
        motivo: "Otro",
        detalle: "Se armó con el lote equivocado",
      }),
    );
  });

  it("al anular, un 409 del backend se muestra en el diálogo y avisa para refrescar el stock (R6.5/R6.7)", async () => {
    const { onAnular, onErrorRefrescarStock, onClose } = renderDialog({
      tipo: "anular",
      orden: ORDEN,
    });
    onAnular.mockRejectedValueOnce(errorServidor("Sólo se puede anular una orden Pendiente."));
    escribir("Motivo", "Duplicada");
    fireEvent.click(screen.getByRole("button", { name: "Anular" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sólo se puede anular");
    expect(onErrorRefrescarStock).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
