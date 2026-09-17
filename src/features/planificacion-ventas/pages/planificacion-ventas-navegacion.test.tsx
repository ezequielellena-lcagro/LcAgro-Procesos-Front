import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlanificacionVentasPage } from "./planificacion-ventas-page";
import { useContextoPlanificacion } from "../queries/use-plan-siembra";
import type { ContextoPlanificacion } from "../types";

vi.mock("../queries/use-plan-siembra", () => ({
  useContextoPlanificacion: vi.fn(),
}));
vi.mock("../components/consolidado-panel", () => ({ ConsolidadoPanel: () => null }));
vi.mock("../components/plan-siembra-panel", () => ({
  PlanSiembraPanel: ({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) => {
    const [dirty, setDirty] = useState(false);
    useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
    return <button onClick={() => setDirty(true)}>Editar plan</button>;
  },
}));
vi.mock("../components/market-share-form", () => ({
  MarketShareForm: ({
    activo,
    onDirtyChange,
  }: {
    activo: boolean;
    onDirtyChange: (dirty: boolean) => void;
  }) => {
    const [dirty, setDirty] = useState(false);
    useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
    return activo ? <button onClick={() => setDirty(true)}>Editar Market Share</button> : null;
  },
}));

const contexto: ContextoPlanificacion = {
  campaniaVigente: "2026-2027",
  campanias: [{ codigo: "2026-2027", editable: true }],
  alcance: { veTodo: true, vendedor: null },
};

beforeEach(() => {
  vi.mocked(useContextoPlanificacion).mockReturnValue({
    data: contexto,
    isError: false,
  } as ReturnType<typeof useContextoPlanificacion>);
});
afterEach(() => vi.restoreAllMocks());

describe("navegacion con dos borradores", () => {
  it("un solo blocker protege ruta y recarga mientras Plan y Market estan sucios", async () => {
    const confirmar = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const router = createMemoryRouter(
      [
        {
          path: "/plan",
          element: (
            <>
              <PlanificacionVentasPage />
              <Link to="/salida">Salir de Planificacion</Link>
            </>
          ),
        },
        { path: "/salida", element: <span>Otra pantalla</span> },
      ],
      { initialEntries: ["/plan"] },
    );
    render(<RouterProvider router={router} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar plan" }));
    fireEvent.click(screen.getByRole("tab", { name: "Market Share" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar Market Share" }));
    const descarga = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(descarga);
    expect(descarga.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("link", { name: "Salir de Planificacion" }));
    await waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("link", { name: "Salir de Planificacion" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Salir de Planificacion" }));
    expect(await screen.findByText("Otra pantalla")).toBeInTheDocument();
    expect(confirmar).toHaveBeenCalledTimes(2);
  });
});
