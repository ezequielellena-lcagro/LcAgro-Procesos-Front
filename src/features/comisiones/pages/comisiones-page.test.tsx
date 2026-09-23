import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/features/auth/auth-context";
import { comisionesHandlers } from "@/mocks/handlers/comisiones";
import { ComisionesPage } from "./comisiones-page";

/**
 * La pantalla se lee en dos solapas: el Resumen por vendedor del mes y el Detalle renglón por
 * renglón. Lo que se verifica acá es el cableado entre las dos: qué se ve en cada una y que elegir
 * un vendedor en el resumen sea un drill-down real (filtra Y lleva al detalle).
 */
vi.mock("@/features/auth/auth-context", () => ({ useAuth: vi.fn() }));

const server = setupServer(...comisionesHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers(...comisionesHandlers));
afterAll(() => server.close());

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 1, nombre: "Usuario Demo", email: "demo@local.test", roles: ["comisiones"] },
    status: "authenticated",
    hasAnyRole: (requeridos) => requeridos.includes("comisiones"),
    login: async () => {},
    logout: () => {},
  });
});

/**
 * Renderiza la página y la para en julio 2026, el mes que tienen cargado los fixtures. El período
 * se fija desde los filtros (no desde el reloj) para que el test no dependa de la fecha del día.
 */
async function abrirComisiones() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ComisionesPage />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Año"), { target: { value: "2026" } });
  fireEvent.change(screen.getByLabelText("Mes"), { target: { value: "7" } });
  await screen.findByRole("cell", { name: "PAMPA SUR" });
}

describe("ComisionesPage", () => {
  it("arranca en Resumen por vendedor, con el detalle guardado en su solapa", async () => {
    await abrirComisiones();

    expect(screen.getByRole("tab", { name: "Resumen por vendedor" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Contador de renglones del período en la solapa (8 ventas de julio en la fixture).
    expect(screen.getByRole("tab", { name: "Detalle (8)" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("cell", { name: "TOTAL GENERAL" })).toBeInTheDocument();
    // La tabla de detalle no se dibuja mientras su solapa está cerrada.
    expect(screen.queryByText("FAC A 0007-0038401")).not.toBeInTheDocument();
  });

  it("elegir un vendedor en el resumen abre el detalle ya filtrado por ese vendedor", async () => {
    await abrirComisiones();

    fireEvent.click(screen.getByRole("cell", { name: "PAMPA SUR" }));

    expect(screen.getByRole("tab", { name: /^Detalle/ })).toHaveAttribute("aria-selected", "true");
    // Mientras vuelve la respuesta filtrada se sigue viendo el listado anterior, así que el filtro
    // se comprueba esperando a que se vaya la venta del otro vendedor.
    await waitFor(() => expect(screen.queryByText("FAC A 0007-0038401")).not.toBeInTheDocument());
    expect(screen.getByText("FAC A 0007-0038409")).toBeInTheDocument(); // venta de PAMPA SUR
  });

  it("volver al resumen y tocar el vendedor ya elegido limpia el filtro sin sacarte del resumen", async () => {
    await abrirComisiones();
    fireEvent.click(screen.getByRole("cell", { name: "PAMPA SUR" }));
    await screen.findByText("FAC A 0007-0038409");

    fireEvent.click(screen.getByRole("tab", { name: "Resumen por vendedor" }));
    fireEvent.click(await screen.findByRole("cell", { name: "PAMPA SUR" }));

    expect(screen.getByRole("tab", { name: "Resumen por vendedor" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByRole("tab", { name: "Detalle (8)" })).toBeInTheDocument();
  });
});
