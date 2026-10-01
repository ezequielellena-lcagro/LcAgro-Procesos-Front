import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrdenCargaDto, OrdenCargaItemDto } from "../types";
import { OrdenImprimible } from "./orden-imprimible";

/**
 * Vista imprimible de una orden de carga (R7.1), con el formato pedido por el cliente el 2026-09-27
 * (cuadro por producto + detalle de lotes + firmas, letra grande): cliente, destino, columna Proceso
 * por renglón, subtotales de kg propio/cliente cuando la orden mezcla procesos (ADR-13), y la leyenda
 * "Semilla del cliente" cuando ningún renglón es propio.
 */
function orden(over: Partial<OrdenCargaDto> = {}): OrdenCargaDto {
  const base: OrdenCargaDto = {
    id: 1,
    numero: 7,
    fechaAlta: "2026-09-10T12:00:00Z",
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
    totalKg: 4000,
    totalKgPropio: 4000,
    totalKgCliente: 0,
  };
  return { ...base, ...over };
}

function item(over: Partial<OrdenCargaItemDto> = {}): OrdenCargaItemDto {
  const base: OrdenCargaItemDto = {
    id: 1,
    loteId: 1,
    loteCodigo: "26S-001",
    campania: "2026-2027",
    especie: "Soja",
    variedad: "DM 46E25",
    envase: "BigBag",
    pesoUnitarioKg: 800,
    tratada: true,
    pg: 95,
    pmil: 152,
    duenio: "Propio",
    clienteNumero: null,
    ubicacionId: 1,
    ubicacion: "G1-6",
    cantidad: 5,
    kg: 4000,
  };
  return { ...base, ...over };
}

describe("OrdenImprimible", () => {
  afterEach(() => {
    // La hoja `@media print` que oculta `#root` se limpia sola al desmontar (cleanup de RTL), pero
    // por las dudas no debe quedar ninguna colgada entre tests.
    document.querySelectorAll("style").forEach((s) => s.remove());
  });

  it("no renderiza nada cuando no hay ninguna orden elegida", () => {
    render(<OrdenImprimible orden={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Imprimir" })).not.toBeInTheDocument();
  });

  it("muestra numero, cliente, destino, pedido y remito", () => {
    render(
      <OrdenImprimible
        orden={orden({ numeroPedidoVenta: "06-00045", numeroRemito: "06-00001" })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("N° 7")).toBeInTheDocument();
    expect(screen.getByText("500 · Cliente Uno")).toBeInTheDocument();
    expect(screen.getByText("Campo Norte")).toBeInTheDocument();
    expect(screen.getByText("06-00045")).toBeInTheDocument();
    expect(screen.getByText("06-00001")).toBeInTheDocument();
  });

  it("la columna Proceso distingue los renglones propios de los del cliente", () => {
    render(
      <OrdenImprimible
        orden={orden({
          items: [
            item({ id: 1, loteCodigo: "26S-001", duenio: "Propio" }),
            item({ id: 2, loteCodigo: "26S-002", duenio: "Cliente", clienteNumero: 500 }),
          ],
        })}
        onClose={vi.fn()}
      />,
    );
    const filaPropia = screen.getByText("26S-001").closest("tr") as HTMLElement;
    const filaCliente = screen.getByText("26S-002").closest("tr") as HTMLElement;
    expect(within(filaPropia).getByText("Propio")).toBeInTheDocument();
    expect(within(filaCliente).getByText("Cliente")).toBeInTheDocument();
  });

  it("arma un cuadro por producto con especie, variedad, tratamiento, envase, PG y PMIL", () => {
    render(<OrdenImprimible orden={orden({ items: [item()] })} onClose={vi.fn()} />);
    expect(screen.getByText("DM 46E25")).toBeInTheDocument();
    expect(screen.getByText("Tratada")).toBeInTheDocument();
    expect(screen.getByText("BigBag")).toBeInTheDocument();
    expect(screen.getByText("5 BB · 4.000 kg")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
    expect(screen.getByText("152")).toBeInTheDocument();
    expect(screen.getByText("Detalle de lotes")).toBeInTheDocument();
  });

  it("con dos productos repite el bloque, pone un subtotal por producto y un solo total general", () => {
    render(
      <OrdenImprimible
        orden={orden({
          totalUnidades: 15,
          totalKg: 4400,
          totalKgPropio: 4400,
          items: [
            item({ id: 1, loteCodigo: "26S-001" }),
            item({ id: 2, loteCodigo: "26S-002", ubicacion: "G1-7" }),
            item({
              id: 3,
              loteCodigo: "26T-001",
              especie: "Trigo",
              variedad: "Baguette 620",
              envase: "Bolsa",
              pesoUnitarioKg: 40,
              cantidad: 5,
              kg: 200,
            }),
          ],
        })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("table")).toHaveLength(2);
    expect(screen.getAllByText("Subtotal")).toHaveLength(2);
    expect(screen.getAllByText("Total")).toHaveLength(1);
    const filaTotal = screen.getByText("Total").closest("tr") as HTMLElement;
    expect(within(filaTotal).getByText("15")).toBeInTheDocument();
    expect(within(filaTotal).getByText("4.400 kg")).toBeInTheDocument();
  });

  it("con un solo producto no hay subtotal, sólo el total", () => {
    render(<OrdenImprimible orden={orden({ items: [item()] })} onClose={vi.fn()} />);
    expect(screen.queryByText("Subtotal")).not.toBeInTheDocument();
    expect(screen.getAllByText("Total")).toHaveLength(1);
  });

  it("deja las tres firmas del comprobante anterior", () => {
    render(<OrdenImprimible orden={orden({ items: [item()] })} onClose={vi.fn()} />);
    expect(screen.getByText("Responsable despacho")).toBeInTheDocument();
    expect(screen.getByText("Transportista / Receptor")).toBeInTheDocument();
    expect(screen.getByText("Fecha y hora de despacho")).toBeInTheDocument();
  });

  it("muestra el total de unidades y de kg de la orden", () => {
    render(
      <OrdenImprimible
        orden={orden({ totalUnidades: 5, totalKgPropio: 4000, totalKgCliente: 0, items: [item()] })}
        onClose={vi.fn()}
      />,
    );
    const filaTotal = screen.getByText("Total").closest("tr") as HTMLElement;
    expect(within(filaTotal).getByText("5")).toBeInTheDocument();
    expect(within(filaTotal).getByText("4.000 kg")).toBeInTheDocument();
  });

  it("muestra los subtotales de kg propio y de cliente cuando la orden es mixta", () => {
    render(
      <OrdenImprimible
        orden={orden({
          totalKgPropio: 4000,
          totalKgCliente: 1200,
          items: [
            item(),
            item({ id: 2, loteCodigo: "26S-002", duenio: "Cliente", clienteNumero: 500 }),
          ],
        })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("4.000 kg propios + 1.200 kg del cliente")).toBeInTheDocument();
  });

  it("no muestra subtotales cuando la orden no es mixta", () => {
    render(
      <OrdenImprimible
        orden={orden({ totalKgPropio: 4000, totalKgCliente: 0, items: [item()] })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText(/del cliente$/)).not.toBeInTheDocument();
  });

  it('muestra la leyenda "Semilla del cliente" cuando todos los renglones son del cliente', () => {
    render(
      <OrdenImprimible
        orden={orden({
          totalKgPropio: 0,
          totalKgCliente: 4000,
          items: [item({ duenio: "Cliente", clienteNumero: 500 })],
        })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Semilla del cliente")).toBeInTheDocument();
  });

  it("no muestra la leyenda de cliente cuando hay al menos un renglon propio", () => {
    render(<OrdenImprimible orden={orden({ items: [item()] })} onClose={vi.fn()} />);
    expect(screen.queryByText("Semilla del cliente")).not.toBeInTheDocument();
  });

  it('el boton "Imprimir" llama a window.print', () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<OrdenImprimible orden={orden({ items: [item()] })} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('el boton "Cerrar" llama a onClose', () => {
    const onClose = vi.fn();
    render(<OrdenImprimible orden={orden({ items: [item()] })} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("la tabla de renglones vive en un contenedor con scroll horizontal para no cortarse en pantallas angostas", () => {
    render(<OrdenImprimible orden={orden({ items: [item()] })} onClose={vi.fn()} />);
    const tabla = screen.getByRole("table");
    expect(tabla.closest(".overflow-x-auto")).not.toBeNull();
  });
});
