import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RolNombre } from "@/features/auth/types";
import { env } from "@/lib/env";
import { descargarDemo, logisticaHandlers, resetLogisticaDemo } from "@/mocks/handlers/logistica";
import { hoy } from "../format";
import type { OtorgarResultado, Pedido } from "../types";
import { CuposPage } from "./cupos-page";
import { PedidosPage } from "./pedidos-page";

const sesion = vi.hoisted(() => ({ roles: ["logistica-pedidos"] as RolNombre[] }));
vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: 8, nombre: "Operador ficticio", roles: sesion.roles } }),
}));
const API = `${env.apiUrl}/logistica`;
const server = setupServer(...logisticaHandlers);
const routers: ReturnType<typeof createMemoryRouter>[] = [];
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  routers.splice(0).forEach((router) => router.dispose());
  server.resetHandlers();
  resetLogisticaDemo();
  sesion.roles = ["logistica-pedidos"];
});
afterAll(() => server.close());

async function post<T>(ruta: string, body: object) {
  const r = await fetch(`${API}/${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  return (await r.json()) as T;
}
const pedir = (cantidad: number, preventa: { operacion: string; numero: string } | null = null) =>
  post<Pedido>("pedidos", {
    clienteNumero: 9000000001,
    producto: 10,
    campania: "2025-2026",
    fechaSolicitada: hoy(),
    cantidadCupos: cantidad,
    preventa,
    observacion: null,
    seCargaEnPlanta: false,
  });
const otorgar = (pedido: Pedido, cupos: { contrato: string; plan: number; cupo: number }[]) =>
  post<OtorgarResultado>("otorgamientos", {
    pedidoId: pedido.id,
    pedidoRevision: pedido.revision,
    cupos,
  });
function mostrar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: "/logistica/pedidos", element: <PedidosPage /> },
      { path: "/logistica/cupos", element: <CuposPage /> },
      { path: "/logistica/cupos/otorgar", element: <div>Otorgar cupos</div> },
    ],
    { initialEntries: ["/logistica/pedidos"] },
  );
  routers.push(router);
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
const tabla = () => screen.findByRole("table", { name: "Pedidos de Logística" });

describe("Pedidos (devolución del 2026-10-23)", () => {
  it("el alta sin preventa elige la campaña de una lista y manda el check de carga en planta", async () => {
    const cuerpos: Record<string, unknown>[] = [];
    server.use(
      http.post(`${API}/pedidos`, async ({ request }) => {
        cuerpos.push((await request.clone().json()) as Record<string, unknown>);
      }),
    );
    mostrar();
    fireEvent.click(await screen.findByRole("button", { name: "Nuevo pedido" }));
    const dialogo = await screen.findByRole("dialog", { name: "Nuevo pedido" });
    fireEvent.click(within(dialogo).getByRole("radio", { name: "Sin preventa" }));
    const campania = await within(dialogo).findByRole("combobox", { name: "Campaña" });
    await within(campania).findByRole("option", { name: "2025-2026" });
    fireEvent.change(campania, { target: { value: "2025-2026" } });
    // El check está en las dos modalidades; el productor se sigue eligiendo.
    fireEvent.click(within(dialogo).getByRole("checkbox", { name: /Se carga en planta/ }));
    fireEvent.click(within(dialogo).getByRole("radio", { name: "Contra una preventa" }));
    expect(within(dialogo).getByRole("checkbox", { name: /Se carga en planta/ })).toBeChecked();
    fireEvent.click(
      await within(dialogo).findByRole("radio", { name: "Elegir preventa PF-DEMO/1" }),
    );
    fireEvent.click(within(dialogo).getByRole("button", { name: "Guardar pedido" }));
    await waitFor(() => expect(cuerpos).toHaveLength(1));
    expect(cuerpos[0]).toMatchObject({ seCargaEnPlanta: true, clienteNumero: 9000000001 });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Nuevo pedido" })).not.toBeInTheDocument(),
    );
    expect(await within(await tabla()).findByText("En planta")).toBeInTheDocument();
  });

  it("el pedido cumplido sale de la lista y se ve con «Ver cumplidos»; se busca por número de orden", async () => {
    const cumplido = await pedir(1, { operacion: "PF", numero: "PF-DEMO/1" });
    await pedir(2);
    await otorgar(cumplido, [{ contrato: "V-DEMO/1", plan: 1, cupo: 1 }]);
    mostrar();
    const lista = await tabla();
    await waitFor(() => expect(within(lista).getAllByRole("row")).toHaveLength(2));
    expect(within(lista).queryByText("PF PF-DEMO/1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ver cumplidos" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(await within(lista).findByText("PF PF-DEMO/1")).toBeInTheDocument();
    expect(within(lista).getByText("atendido")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ver cumplidos" }));
    fireEvent.change(screen.getByLabelText("N° de orden de la preventa"), {
      target: { value: "NO-EXISTE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(await screen.findByText(/Todavía no hay pedidos pendientes/)).toBeInTheDocument();
  });

  it("eliminar se bloquea con cupos otorgados y dice cuántos; sin otorgados elimina", async () => {
    const otorgado = await pedir(3);
    await otorgar(otorgado, [
      { contrato: "V-DEMO/1", plan: 2, cupo: 1 },
      { contrato: "V-DEMO/1", plan: 2, cupo: 2 },
    ]);
    await pedir(1);
    mostrar();
    const lista = await tabla();
    const parcial = (await within(lista).findByText("parcial")).closest("tr")!;
    fireEvent.click(within(parcial).getByRole("button", { name: "Eliminar" }));
    const dialogo = await screen.findByRole("dialog", { name: "Eliminar pedido" });
    expect(within(dialogo).getByRole("alert")).toHaveTextContent("tiene 2 cupos otorgados");
    expect(
      within(dialogo).queryByRole("button", { name: "Eliminar pedido" }),
    ).not.toBeInTheDocument();
    fireEvent.click(within(dialogo).getAllByRole("button", { name: "Cerrar" }).at(-1)!);
    const sinOtorgar = within(lista).getByText("pendiente").closest("tr")!;
    fireEvent.click(within(sinOtorgar).getByRole("button", { name: "Eliminar" }));
    const otro = await screen.findByRole("dialog", { name: "Eliminar pedido" });
    fireEvent.click(within(otro).getByRole("button", { name: "Eliminar pedido" }));
    await waitFor(() =>
      expect(within(lista).getAllByRole("button", { name: "Eliminar" })).toHaveLength(1),
    );
  });

  it("Otorgar desde la fila abre la pantalla por pasos con el pedido ya elegido", async () => {
    sesion.roles = ["logistica-pedidos", "logistica-cupos"];
    const pedido = await pedir(2);
    const router = mostrar();
    fireEvent.click(await within(await tabla()).findByRole("button", { name: "Otorgar" }));
    await waitFor(() =>
      expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(
        `/logistica/cupos/otorgar?pedido=${pedido.id}`,
      ),
    );
  });

  it("sin permiso de Cupos no aparece Otorgar en la fila", async () => {
    await pedir(1);
    mostrar();
    await within(await tabla()).findByText("pendiente");
    expect(screen.queryByRole("button", { name: "Otorgar" })).not.toBeInTheDocument();
  });

  it("la preventa queda cumplida recién cuando la descarga alcanza lo contratado", async () => {
    // La preventa demo tiene 300.000 kg: diez camiones de 30.000.
    const pedido = await pedir(4, { operacion: "PF", numero: "PF-DEMO/1" });
    const claves = [1, 2].flatMap((plan) =>
      [1, 2].map((cupo) => ({ contrato: "V-DEMO/1", plan, cupo })),
    );
    await otorgar(pedido, claves);
    claves.forEach((c) => descargarDemo(c, 75000));
    mostrar();
    fireEvent.click(screen.getByRole("tab", { name: "Preventas MacroGest" }));
    const grilla = await screen.findByRole("table", { name: "Elegir preventa" });
    expect(await within(grilla).findByText("Cumplida")).toBeInTheDocument();
    cleanup();
    // El puerto rechaza un camión: sin esa descarga vuelve sola a pendiente.
    descargarDemo(claves[0], null);
    mostrar();
    fireEvent.click(screen.getByRole("tab", { name: "Preventas MacroGest" }));
    const otra = await screen.findByRole("table", { name: "Elegir preventa" });
    expect(await within(otra).findByText("Pendiente")).toBeInTheDocument();
  });
});
