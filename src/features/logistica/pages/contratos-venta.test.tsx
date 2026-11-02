import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RolNombre } from "@/features/auth/types";
import { cargarDemo, logisticaHandlers, resetLogisticaDemo } from "@/mocks/handlers/logistica";
import { CuposPage } from "./cupos-page";

const sesion = vi.hoisted(() => ({ roles: ["logistica-lectura"] as RolNombre[] }));
vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: 8, nombre: "Operador ficticio", roles: sesion.roles } }),
}));
const server = setupServer(...logisticaHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetLogisticaDemo();
});
afterAll(() => server.close());

function mostrar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CuposPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const fila = (tabla: HTMLElement, contrato: string) =>
  within(tabla).getByText(contrato).closest("tr")!;

describe("Seguimiento de contratos de venta", () => {
  it("primero los vencidos con saldo, con lo entregado según las cartas de porte de MacroGest", async () => {
    // El plan 4 de la demo carga un camión de 30.000 kg contra el contrato de ejemplo.
    cargarDemo({ contrato: "V-DEMO/1", plan: 4, cupo: 1 });
    mostrar();
    fireEvent.click(await screen.findByRole("tab", { name: "Contratos de venta" }));
    const tabla = await screen.findByRole("table", { name: "Seguimiento de contratos de venta" });
    await within(tabla).findByText("V-DEMO/1");
    const numeros = within(tabla)
      .getAllByRole("row")
      .map((tr) => tr.textContent?.match(/V-DEMO\/\d/)?.[0])
      .filter(Boolean);
    expect(numeros).toEqual(["V-DEMO/2", "V-DEMO/1"]);
    const vencido = fila(tabla, "V-DEMO/2");
    expect(within(vencido).getByText("Vencido, falta entregar")).toBeInTheDocument();
    expect(within(vencido).getByText("5")).toBeInTheDocument();
    const vigente = fila(tabla, "V-DEMO/1");
    expect(within(vigente).getByText("Vigente")).toBeInTheDocument();
    expect(within(vigente).getByText("300.000 kg")).toBeInTheDocument();
    expect(within(vigente).getByText("30.000 kg")).toBeInTheDocument();
    expect(within(vigente).getByText("1 camión")).toBeInTheDocument();
    expect(within(vigente).getByText("270.000 kg")).toBeInTheDocument();
    expect(within(vigente).getByText("9")).toBeInTheDocument();
  });

  it("busca por contrato o comprador", async () => {
    mostrar();
    fireEvent.click(await screen.findByRole("tab", { name: "Contratos de venta" }));
    const tabla = await screen.findByRole("table", { name: "Seguimiento de contratos de venta" });
    await within(tabla).findByText("V-DEMO/1");
    fireEvent.change(screen.getByLabelText("Contrato o comprador"), {
      target: { value: "otro comprador" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(screen.queryByText("V-DEMO/1")).not.toBeInTheDocument());
    const filtrada = await screen.findByRole("table", {
      name: "Seguimiento de contratos de venta",
    });
    expect(await within(filtrada).findByText("V-DEMO/2")).toBeInTheDocument();
  });
});
