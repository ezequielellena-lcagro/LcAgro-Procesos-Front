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

/** Abre el modal de carga y devuelve el diálogo ya montado. */
function abrirDialogo(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: /Market Share$/ }));
  return screen.getByRole("dialog");
}

beforeEach(() => {
  vi.clearAllMocks();
  guardar.mockResolvedValue({ cultivos: [] });
  recargar.mockResolvedValue({ data, isError: false });
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
  it("muestra tablas de solo lectura, sin KPIs y con el boton de carga", () => {
    render(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Campaña" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Parámetros por cultivo" })).toBeInTheDocument();
    expect(screen.getByText(/hectárea × precio USD\/tn ÷ 10\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar Market Share" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    const soja = screen.getByTestId("market-row-soja");
    expect(within(soja).getByText("9,000")).toBeInTheDocument();
    expect(within(soja).getByText("US$ 325,00")).toBeInTheDocument();
    expect(within(soja).getByText("US$ 292,50")).toBeInTheDocument();
    expect(within(screen.getByTestId("market-row-maiz")).getAllByText("—")).toHaveLength(4);
    expect(within(screen.getByTestId("market-row-otro")).getByText("—")).toBeInTheDocument();

    const resumen = screen.getByRole("region", { name: "Resumen de campaña" });
    expect(
      within(resumen).getByRole("heading", { name: "Resumen de la campaña" }),
    ).toBeInTheDocument();
    expect(within(resumen).getByRole("columnheader", { name: "Hectáreas" })).toBeInTheDocument();
    expect(screen.queryByText("Facturación LC")).not.toBeInTheDocument();
    expect(screen.queryByText("Participación LC")).not.toBeInTheDocument();
    expect(screen.queryByText("Originación")).not.toBeInTheDocument();
  });

  it("recalcula costo USD/ha al tipear en el modal y Otro queda deshabilitado", () => {
    render(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);
    const dialogo = abrirDialogo();
    const soja = within(dialogo).getByTestId("market-form-row-soja");
    expect(within(soja).getByText("US$ 292,50")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" }), {
      target: { value: "10" },
    });
    expect(within(soja).getByText("US$ 325,00")).toBeInTheDocument();
    const otro = within(dialogo).getByTestId("market-form-row-otro");
    expect(within(otro).getByText("sin costo por ahora: no suma")).toBeInTheDocument();
    expect(
      within(otro)
        .getAllByRole("textbox")
        .every((input) => (input as HTMLInputElement).disabled),
    ).toBe(true);
  });

  it("muestra precision invalida y bloquea guardado", () => {
    render(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);
    abrirDialogo();
    fireEvent.change(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" }), {
      target: { value: "1,0001" },
    });
    expect(screen.getByText(/hasta 3 decimales/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  });

  it("campania de solo lectura no ofrece cargar valores", () => {
    vi.mocked(useMarketShare).mockReturnValue({
      data: { ...data, editable: false },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      refetch: recargar,
    } as unknown as ReturnType<typeof useMarketShare>);
    render(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);
    expect(screen.getByText(/solo lectura/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Market Share$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("copia parametros previos a una campania vacia sin guardar", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Nuevo Market Share" }));
    fireEvent.click(screen.getByRole("button", { name: /Copiar valores de 2025\/26/ }));
    expect(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" })).toHaveValue("9");
    expect(guardar).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();

    vi.mocked(useGuardarMarketShare).mockReturnValue({
      mutateAsync: guardar,
      isPending: true,
    } as unknown as ReturnType<typeof useGuardarMarketShare>);
    rerender(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Copiar valores de 2025\/26/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });

  it("confirma cerrar el modal y cambiar de campania con borrador sin guardar", () => {
    const confirmar = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    render(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);
    abrirDialogo();
    fireEvent.change(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" }), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" })).toHaveValue("10");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(confirmar).toHaveBeenCalledTimes(2);

    const selector = screen.getByRole("combobox", { name: /Campa/ });
    fireEvent.change(selector, { target: { value: "2025-2026" } });
    expect(selector).toHaveValue("2025-2026");
    expect(confirmar).toHaveBeenCalledTimes(2);
  });

  it("congela revision y otros campos ante refetch, y muestra 409", async () => {
    const { rerender } = render(
      <MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />,
    );
    abrirDialogo();
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
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  });

  it("descarta el borrador y bloquea la edicion mientras recarga tras un 409", async () => {
    guardar.mockRejectedValue(errorHttp(409, { codigo: "conflict", detail: "Revision cambiada." }));
    let terminarRecarga!: (valor: unknown) => void;
    recargar.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          terminarRecarga = resolve;
        }),
    );
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);
    abrirDialogo();
    fireEvent.change(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" }), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText(/Revision cambiada/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Descartar y recargar cultivos" }));
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const selector = screen.getByRole("combobox", { name: /Campa/ });
    expect(selector).toBeDisabled();
    expect(screen.getByRole("button", { name: "Editar Market Share" })).toBeDisabled();
    fireEvent.change(selector, { target: { value: "2025-2026" } });
    expect(selector).toHaveValue("2026-2027");
    expect(confirmar).not.toHaveBeenCalled();

    await act(async () => terminarRecarga({ data, isError: false }));
    expect(selector).toHaveValue("2026-2027");
    expect(screen.getByRole("button", { name: "Editar Market Share" })).toBeEnabled();
    expect(within(screen.getByTestId("market-row-soja")).getByText("9,000")).toBeInTheDocument();
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
    abrirDialogo();
    fireEvent.change(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" }), {
      target: { value: "10" },
    });
    expect(screen.getByText("Borrador activo")).toBeInTheDocument();
    rerender(<ConPermiso veTodo={false} />);
    expect(screen.getByText("Sin borrador")).toBeInTheDocument();
  });

  it("bloquea la edicion durante un PUT pendiente y cierra al confirmarse", async () => {
    let terminarGuardado!: (valor: unknown) => void;
    guardar.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          terminarGuardado = resolve;
        }),
    );
    render(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);
    abrirDialogo();
    const soja = screen.getByRole("textbox", { name: "qq insumo/ha de Soja" });
    fireEvent.change(soja, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(soja).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent.change(soja, { target: { value: "20" } });
    expect(soja).toHaveValue("10");

    await act(async () => terminarGuardado({ cultivos: [] }));
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
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(recargar).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Editar Market Share" })).toBeEnabled();
  });

  it("muestra rechazo 400 de validacion y conserva borrador", async () => {
    guardar.mockRejectedValue(
      errorHttp(400, { codigo: "validation", detail: "Cultivos[0].QqInsumoHa: Valor rechazado." }),
    );
    render(<MarketShareForm contexto={contexto} activo onDirtyChange={vi.fn()} />);
    abrirDialogo();
    fireEvent.change(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" }), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText(/Valor rechazado/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "qq insumo/ha de Soja" })).toHaveValue("10");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
  });
});
