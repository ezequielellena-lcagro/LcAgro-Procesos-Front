import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarketShareForm } from "./market-share-form";
import { useMarketShare, useGuardarMarketShare } from "../queries/use-market-share";
import type { ContextoPlanificacion, MarketShareResponse } from "../types";

vi.mock("../queries/use-market-share", () => ({
  useMarketShare: vi.fn(),
  useGuardarMarketShare: vi.fn(),
}));

const contexto: ContextoPlanificacion = {
  campaniaVigente: "2026-2027",
  campanias: [
    { codigo: "2026-2027", editable: true },
    { codigo: "2025-2026", editable: false },
  ],
  alcance: { veTodo: true, vendedor: null },
};
const vacio = {
  qqInsumoHa: null,
  precioUsdTn: null,
  costoUsdHa: null,
  rindeTnHa: null,
  revision: 0,
  modificadoPor: null,
  modificadoEl: null,
};
const data: MarketShareResponse = {
  campania: "2026-2027",
  editable: true,
  copiarDe: null,
  datosMacroGestAl: null,
  sinVendedor: false,
  cultivos: [
    {
      ...vacio,
      cultivo: "soja",
      qqInsumoHa: 9,
      precioUsdTn: 325,
      costoUsdHa: 292.5,
      rindeTnHa: 4,
      revision: 1,
    },
    { ...vacio, cultivo: "maiz" },
    { ...vacio, cultivo: "trigo" },
  ],
  resumen: {
    soja: { hectareas: 100, costoUsdHa: 292.5, mercadoUsd: 29250, rindeTnHa: 4, potencialTn: 400 },
    maiz: { hectareas: 0, costoUsdHa: null, mercadoUsd: null, rindeTnHa: null, potencialTn: null },
    trigo: { hectareas: 0, costoUsdHa: null, mercadoUsd: null, rindeTnHa: null, potencialTn: null },
    hectareasOtro: 2,
    mercadoUsd: null,
    potencialTn: null,
    facturacionLcUsd: 1000,
    participacionLc: null,
    originacionTn: 200,
    participacionOriginacion: null,
  },
};
const guardar = vi.fn();
const recargar = vi.fn();

function errorHttp(status: number, body: object) {
  return new AxiosError("Request failed", String(status), undefined, null, {
    data: body,
    status,
    statusText: "Error",
    headers: {},
    config: {} as InternalAxiosRequestConfig,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  guardar.mockResolvedValue({ cultivos: [] });
  recargar.mockResolvedValue({ data });
  vi.mocked(useMarketShare).mockImplementation(
    (campania) =>
      ({
        data: campania === data.campania ? data : undefined,
        isPending: false,
        isError: false,
        isPlaceholderData: false,
        refetch: recargar,
      }) as unknown as ReturnType<typeof useMarketShare>,
  );
  vi.mocked(useGuardarMarketShare).mockReturnValue({
    mutateAsync: guardar,
    isPending: false,
  } as unknown as ReturnType<typeof useGuardarMarketShare>);
});

describe("Market Share", () => {
  it("recalcula costo USD/ha al tipear y Otro queda deshabilitado", () => {
    render(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);
    const soja = screen.getByTestId("market-form-row-soja");
    expect(within(soja).getByText("US$ 292,50")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" }), {
      target: { value: "10" },
    });
    expect(within(soja).getByText("US$ 325,00")).toBeInTheDocument();
    const otro = screen.getByTestId("market-form-row-otro");
    expect(within(otro).getByText("sin costo por ahora: no suma")).toBeInTheDocument();
    expect(
      within(otro)
        .getAllByRole("textbox")
        .every((input) => (input as HTMLInputElement).disabled),
    ).toBe(true);
  });

  it("muestra precision invalida y bloquea guardado", () => {
    render(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" }), {
      target: { value: "1,0001" },
    });
    expect(screen.getByText(/hasta 3 decimales/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  });

  it("campania de solo lectura bloquea todos los inputs", () => {
    vi.mocked(useMarketShare).mockReturnValue({
      data: { ...data, editable: false },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      refetch: recargar,
    } as unknown as ReturnType<typeof useMarketShare>);
    render(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);
    expect(screen.getByText(/solo lectura/)).toBeInTheDocument();
    expect(
      screen.getAllByRole("textbox").every((input) => (input as HTMLInputElement).disabled),
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();
  });

  it("copia parametros previos a un form vacio sin guardar", () => {
    const sinDatos: MarketShareResponse = {
      ...data,
      copiarDe: "2025-2026",
      cultivos: data.cultivos.map((fila) => ({ ...vacio, cultivo: fila.cultivo })),
    };
    const anterior: MarketShareResponse = { ...data, campania: "2025-2026" };
    vi.mocked(useMarketShare).mockImplementation(
      (campania) =>
        ({
          data: campania === "2025-2026" ? anterior : sinDatos,
          isPending: false,
          isError: false,
          isPlaceholderData: false,
          refetch: recargar,
        }) as unknown as ReturnType<typeof useMarketShare>,
    );
    const { rerender } = render(
      <MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Copiar valores de 2025\/26/ }));
    expect(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" })).toHaveValue("9");
    expect(guardar).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();

    vi.mocked(useGuardarMarketShare).mockReturnValue({
      mutateAsync: guardar,
      isPending: true,
    } as unknown as ReturnType<typeof useGuardarMarketShare>);
    rerender(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Copiar valores de 2025\/26/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();
  });

  it("confirma cambiar campania si el formulario tiene borrador", () => {
    const confirmar = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    render(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" }), {
      target: { value: "10" },
    });
    const selector = screen.getByRole("combobox", { name: /Campa/ });
    fireEvent.change(selector, { target: { value: "2025-2026" } });
    expect(selector).toHaveValue("2026-2027");
    expect(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" })).toHaveValue("10");
    fireEvent.change(selector, { target: { value: "2025-2026" } });
    expect(selector).toHaveValue("2025-2026");
    expect(confirmar).toHaveBeenCalledTimes(2);
  });

  it("congela revision y otros campos ante refetch, y muestra 409", async () => {
    const { rerender } = render(
      <MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" }), {
      target: { value: "10" },
    });
    const nuevo: MarketShareResponse = {
      ...data,
      cultivos: [
        { ...data.cultivos[0], qqInsumoHa: 11, precioUsdTn: 400, revision: 2 },
        ...data.cultivos.slice(1),
      ],
    };
    vi.mocked(useMarketShare).mockReturnValue({
      data: nuevo,
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      refetch: recargar,
    } as unknown as ReturnType<typeof useMarketShare>);
    rerender(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Precio USD/tn de Soja" })).toHaveValue("325");
    guardar.mockRejectedValue(errorHttp(409, { codigo: "conflict", detail: "Revision cambiada." }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(guardar).toHaveBeenCalledWith({
        campania: "2026-2027",
        request: {
          cultivos: [
            {
              cultivo: "soja",
              qqInsumoHa: 10,
              precioUsdTn: 325,
              rindeTnHa: 4,
              revisionEsperada: 1,
            },
          ],
        },
      }),
    );
    expect(await screen.findByText(/Revision cambiada/)).toBeInTheDocument();
  });

  it("bloquea cambio de campania y edicion mientras recarga tras 409", async () => {
    guardar.mockRejectedValue(
      errorHttp(409, { codigo: "conflict", detail: "Revision cambiada." }),
    );
    let terminarRecarga!: (valor: unknown) => void;
    recargar.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          terminarRecarga = resolve;
        }),
    );
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);
    const soja = screen.getByRole("textbox", { name: "qq insumo/ha de Soja" });
    fireEvent.change(soja, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText(/Revision cambiada/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Descartar y recargar cultivos" }));
    expect(recargar).toHaveBeenCalledTimes(1);
    const selector = screen.getByRole("combobox", { name: /Campa/ });
    expect(selector).toBeDisabled();
    expect(soja).toBeDisabled();
    fireEvent.change(selector, { target: { value: "2025-2026" } });
    fireEvent.change(soja, { target: { value: "20" } });
    expect(selector).toHaveValue("2026-2027");
    expect(soja).toHaveValue("10");
    expect(confirmar).not.toHaveBeenCalled();

    await act(async () => terminarRecarga({ data, isError: false }));
    expect(selector).toHaveValue("2026-2027");
    expect(soja).toHaveValue("9");
  });

  it("limpia dirty al perder permiso de gestion y desmontar el formulario", () => {
    function ConPermiso({ veTodo }: { veTodo: boolean }) {
      const [dirty, setDirty] = useState(false);
      return (
        <>
          <output>{dirty ? "Borrador activo" : "Sin borrador"}</output>
          {veTodo && <MarketShareForm contexto={contexto} activo onDirtyChange={setDirty} />}
        </>
      );
    }

    const { rerender } = render(<ConPermiso veTodo />);
    fireEvent.change(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" }), {
      target: { value: "10" },
    });
    expect(screen.getByText("Borrador activo")).toBeInTheDocument();
    rerender(<ConPermiso veTodo={false} />);
    expect(screen.getByText("Sin borrador")).toBeInTheDocument();
  });

  it("bloquea cambiar campania y editar durante un PUT pendiente", async () => {
    let terminarGuardado!: (valor: unknown) => void;
    guardar.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          terminarGuardado = resolve;
        }),
    );
    const { rerender } = render(
      <MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />,
    );
    const soja = screen.getByRole("textbox", { name: "qq insumo/ha de Soja" });
    fireEvent.change(soja, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(guardar).toHaveBeenCalledTimes(1);

    vi.mocked(useGuardarMarketShare).mockReturnValue({
      mutateAsync: guardar,
      isPending: true,
    } as unknown as ReturnType<typeof useGuardarMarketShare>);
    rerender(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);

    const selector = screen.getByRole("combobox", { name: /Campa/ });
    expect(selector).toBeDisabled();
    expect(soja).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();
    fireEvent.change(selector, { target: { value: "2025-2026" } });
    fireEvent.change(soja, { target: { value: "20" } });
    expect(selector).toHaveValue("2026-2027");
    expect(soja).toHaveValue("10");

    await act(async () => terminarGuardado({ cultivos: [] }));
    expect(guardar).toHaveBeenCalledWith({
      campania: "2026-2027",
      request: {
        cultivos: [{
          cultivo: "soja",
          qqInsumoHa: 10,
          precioUsdTn: 325,
          rindeTnHa: 4,
          revisionEsperada: 1,
        }],
      },
    });
    expect(selector).toHaveValue("2026-2027");
  });

  it("muestra rechazo 400 de validacion y conserva borrador", async () => {
    guardar.mockRejectedValue(
      errorHttp(400, { codigo: "validation", detail: "Cultivos[0].QqInsumoHa: Valor rechazado." }),
    );
    render(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" }), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText(/Valor rechazado/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" })).toHaveValue("10");
  });
});
