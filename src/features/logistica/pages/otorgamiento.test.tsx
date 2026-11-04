import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RolNombre } from "@/features/auth/types";
import { env } from "@/lib/env";
import { logisticaHandlers, resetLogisticaDemo } from "@/mocks/handlers/logistica";
import { hoy, sumarDias } from "../format";
import { descargarPlanCarga } from "../lib/plan-carga-pdf";
import type { ClaveCupo, OtorgarBody, OtorgarResultado, Pedido } from "../types";
import { CuposPage } from "./cupos-page";
import { PedidosPage } from "./pedidos-page";

const sesion = vi.hoisted(() => ({
  roles: ["logistica-cupos", "logistica-pedidos"] as RolNombre[],
}));
vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: 8, nombre: "Operador ficticio", roles: sesion.roles } }),
}));
vi.mock("../lib/plan-carga-pdf", async (original) => ({
  ...(await original<typeof import("../lib/plan-carga-pdf")>()),
  descargarPlanCarga: vi.fn(),
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
  vi.mocked(descargarPlanCarga).mockClear();
  sesion.roles = ["logistica-cupos", "logistica-pedidos"];
});
afterAll(() => server.close());

const PRODUCTOR = 9000000001;
/** Los planes de carga del MacroGest simulado (ver `macroInicial`). */
const cupo = (plan: number, n: number): ClaveCupo => ({ contrato: "V-DEMO/1", plan, cupo: n });
async function post<T>(ruta: string, body: object) {
  const response = await fetch(`${API}/${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  return { status: response.status, dato: (await response.json()) as T };
}
async function pedir(cantidad = 2, producto = 10, fechaSolicitada = hoy()) {
  return (
    await post<Pedido>("pedidos", {
      clienteNumero: PRODUCTOR,
      producto,
      campania: "2025-2026",
      fechaSolicitada,
      cantidadCupos: cantidad,
      preventa: null,
      observacion: null,
    })
  ).dato;
}
async function vincularPorApi(pedido: Pedido, cupos: ClaveCupo[]) {
  return post<OtorgarResultado>("otorgamientos", {
    pedidoId: pedido.id,
    pedidoRevision: pedido.revision,
    cupos,
  } satisfies OtorgarBody);
}
function mostrar(ruta = "/logistica/cupos") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: "/logistica/cupos", element: <CuposPage /> },
      { path: "/logistica/pedidos", element: <PedidosPage /> },
    ],
    { initialEntries: [ruta] },
  );
  routers.push(router);
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router };
}
const lista = () => screen.findByRole("table", { name: "Cupos del plan de carga" });
const fila = async (codigo: string) =>
  (await within(await lista()).findByText(codigo)).closest("tr")!;
const codigos = (tabla: HTMLElement) =>
  within(tabla)
    .getAllByRole("row")
    .map((tr) => tr.textContent?.match(/COD-DEMO-\d-\d/)?.[0])
    .filter(Boolean);

describe("Cupos: los del plan de carga de MacroGest, vinculados a un pedido", () => {
  it("la lista trae los cupos de los planes, del día de carga más nuevo al más viejo, con su pedido", async () => {
    await vincularPorApi(await pedir(1), [cupo(4, 1)]);
    mostrar();
    const tabla = await lista();
    await within(tabla).findByText("COD-DEMO-3-1");
    expect(codigos(tabla)).toEqual([
      "COD-DEMO-2-1",
      "COD-DEMO-2-2",
      "COD-DEMO-1-1",
      "COD-DEMO-1-2",
      "COD-DEMO-4-1",
      "COD-DEMO-3-1",
    ]);
    // El plan 4 está en planta 10 a nombre de un cliente, y ya está vinculado al pedido.
    const vinculado = await fila("COD-DEMO-4-1");
    expect(within(vinculado).getByText("Planta 10")).toBeInTheDocument();
    expect(within(vinculado).getByText("Cliente de prueba uno")).toBeInTheDocument();
    expect(within(vinculado).getByText("Productor ficticio")).toBeInTheDocument();
    expect(within(vinculado).queryByRole("checkbox")).not.toBeInTheDocument();
    // No hay recepción de cupos en la app ni solapas de disponibles u otorgados.
    expect(screen.queryByRole("button", { name: /Recibir cupos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Cupos disponibles" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Cupos otorgados" })).not.toBeInTheDocument();
  });

  it("vincula los cupos elegidos a un pedido y ofrece el Plan de Carga de ese plan", async () => {
    await pedir(2);
    const cuerpos: OtorgarBody[] = [];
    server.events.on("request:start", async ({ request }) => {
      if (request.method === "POST" && request.url.endsWith("/logistica/otorgamientos"))
        cuerpos.push((await request.clone().json()) as OtorgarBody);
    });
    mostrar();
    fireEvent.click(
      within(await fila("COD-DEMO-1-1")).getByRole("checkbox", {
        name: "Elegir cupo COD-DEMO-1-1",
      }),
    );
    fireEvent.click(
      within(await fila("COD-DEMO-1-2")).getByRole("checkbox", {
        name: "Elegir cupo COD-DEMO-1-2",
      }),
    );
    expect(screen.getByText("2 cupos elegidos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Vincular 2 cupos a un pedido" }));
    const dialogo = await screen.findByRole("dialog", { name: "Vincular a un pedido" });
    fireEvent.click(
      await within(dialogo).findByRole("radio", { name: "Elegir pedido de Productor ficticio" }),
    );
    fireEvent.click(
      within(dialogo).getByRole("button", {
        name: "Vincular 2 cupos al pedido de Productor ficticio",
      }),
    );
    expect(
      await screen.findByText("Se vincularon 2 cupos al pedido de Productor ficticio."),
    ).toBeInTheDocument();
    expect(cuerpos).toHaveLength(1);
    expect(cuerpos[0].cupos).toEqual([cupo(1, 1), cupo(1, 2)]);
    // La fila ya muestra el pedido.
    await waitFor(async () =>
      expect(
        within(await fila("COD-DEMO-1-1")).getByText("Productor ficticio"),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Contrato V-DEMO/1 · plan 1" }));
    await waitFor(() => expect(descargarPlanCarga).toHaveBeenCalledTimes(1));
    const plan = vi.mocked(descargarPlanCarga).mock.calls[0][0];
    expect(plan.plan).toBe(1);
    expect(plan.cupos.map((c) => c.codigoOtorgado)).toEqual(["COD-DEMO-1-1", "COD-DEMO-1-2"]);
    server.events.removeAllListeners();
  });

  it("el diálogo trae todos los pedidos pendientes, sin filtros; los de otro cereal se ven y dicen por qué", async () => {
    await pedir(1, 1);
    await pedir(1, 10, sumarDias(hoy(), -90));
    mostrar();
    fireEvent.click(
      within(await fila("COD-DEMO-1-1")).getByRole("checkbox", {
        name: "Elegir cupo COD-DEMO-1-1",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Vincular 1 cupo a un pedido" }));
    const dialogo = await screen.findByRole("dialog", { name: "Vincular a un pedido" });
    const tabla = await within(dialogo).findByRole("table", {
      name: "Pedidos con cupos pendientes",
    });
    await within(tabla).findByText("Maíz 2025-2026");
    const filas = within(tabla).getAllByRole("row").slice(1);
    // Primero el que se puede elegir (soja, de hace tres meses); después el de maíz, bloqueado.
    expect(filas[0]).toHaveTextContent("Soja 2025-2026");
    expect(within(filas[0]).getByRole("radio")).toBeEnabled();
    expect(within(filas[1]).getByRole("radio")).toBeDisabled();
    expect(
      within(filas[1]).getByText("Es Maíz 2025-2026; el cupo es Soja 2025-2026"),
    ).toBeInTheDocument();
    expect(within(dialogo).queryByLabelText(/desde/)).not.toBeInTheDocument();
  });

  it("en el diálogo, un pedido al que le faltan menos cupos que los elegidos no se puede elegir", async () => {
    await pedir(1);
    mostrar();
    fireEvent.click(
      within(await fila("COD-DEMO-2-1")).getByRole("checkbox", {
        name: "Elegir cupo COD-DEMO-2-1",
      }),
    );
    fireEvent.click(
      within(await fila("COD-DEMO-2-2")).getByRole("checkbox", {
        name: "Elegir cupo COD-DEMO-2-2",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Vincular 2 cupos a un pedido" }));
    const dialogo = await screen.findByRole("dialog", { name: "Vincular a un pedido" });
    expect(
      await within(dialogo).findByRole("radio", { name: "Elegir pedido de Productor ficticio" }),
    ).toBeDisabled();
    expect(within(dialogo).getByText("Le falta 1 cupo")).toBeInTheDocument();
  });

  it("desde la fila del pedido vincula directo a ese pedido y no deja pasar lo que le falta", async () => {
    const pedido = await pedir(1);
    const { router } = mostrar(`/logistica/cupos?pedido=${pedido.id}`);
    const ficha = await screen.findByRole("region", { name: "Pedido elegido" });
    expect(within(ficha).getByText("1 de 1")).toBeInTheDocument();
    fireEvent.click(
      within(await fila("COD-DEMO-1-1")).getByRole("checkbox", {
        name: "Elegir cupo COD-DEMO-1-1",
      }),
    );
    // Con el pendiente cubierto, el resto no se puede elegir y dice por qué.
    expect(
      within(await fila("COD-DEMO-1-2")).getByRole("checkbox", {
        name: "Elegir cupo COD-DEMO-1-2",
      }),
    ).toBeDisabled();
    expect(
      within(await fila("COD-DEMO-1-2")).getByText("Ya cubriste el que le falta al pedido"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Vincular 1 cupo a este pedido" }));
    expect(
      await screen.findByText("Se vinculó 1 cupo al pedido de Productor ficticio."),
    ).toBeInTheDocument();
    expect(await within(ficha).findByText("0 de 1")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Volver a Pedidos" })[0]);
    await waitFor(() => expect(router.state.location.pathname).toBe("/logistica/pedidos"));
  });

  it("un 409 al vincular se muestra y se relee la lista", async () => {
    await pedir(2);
    server.use(
      http.post(`${API}/otorgamientos`, () =>
        HttpResponse.json(
          {
            status: 409,
            detail: "Ya está vinculado a un pedido: COD-DEMO-1-1. Actualizá los datos.",
          },
          { status: 409 },
        ),
      ),
    );
    mostrar();
    fireEvent.click(
      within(await fila("COD-DEMO-1-1")).getByRole("checkbox", {
        name: "Elegir cupo COD-DEMO-1-1",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Vincular 1 cupo a un pedido" }));
    const dialogo = await screen.findByRole("dialog", { name: "Vincular a un pedido" });
    fireEvent.click(
      await within(dialogo).findByRole("radio", { name: "Elegir pedido de Productor ficticio" }),
    );
    fireEvent.click(within(dialogo).getByRole("button", { name: /^Vincular 1 cupo/ }));
    expect(
      await within(dialogo).findByText(/Ya está vinculado a un pedido: COD-DEMO-1-1/),
    ).toBeInTheDocument();
  });

  it("desvincular pide motivo, deja el cupo sin pedido y queda en el historial", async () => {
    const pedido = await pedir(1);
    await vincularPorApi(pedido, [cupo(1, 1)]);
    mostrar();
    const vinculado = await fila("COD-DEMO-1-1");
    fireEvent.click(within(vinculado).getByRole("button", { name: "Desvincular del pedido" }));
    const dialogo = await screen.findByRole("dialog", { name: "Desvincular del pedido" });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Desvincular" }));
    expect(within(dialogo).getByText(/Completá los campos obligatorios/)).toBeInTheDocument();
    fireEvent.change(within(dialogo).getByLabelText("Motivo"), {
      target: { value: "Se vinculó al pedido equivocado" },
    });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Desvincular" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Desvincular del pedido" }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(async () =>
      expect(
        within(await fila("COD-DEMO-1-1")).getByRole("checkbox", {
          name: "Elegir cupo COD-DEMO-1-1",
        }),
      ).toBeInTheDocument(),
    );
    const actual = (await (await fetch(`${API}/pedidos/${pedido.id}`)).json()) as { dato: Pedido };
    expect(actual.dato.pendientes).toBe(1);
  });

  it("el historial del cupo vinculado dice cuándo y a qué pedido", async () => {
    await vincularPorApi(await pedir(1), [cupo(1, 1)]);
    mostrar();
    fireEvent.click(within(await fila("COD-DEMO-1-1")).getByRole("button", { name: "Historial" }));
    const dialogo = await screen.findByRole("dialog", { name: "Historial del cupo vinculado" });
    expect(await within(dialogo).findByText("Cupo vinculado al pedido")).toBeInTheDocument();
  });

  it("con permiso de lectura se ve la lista sin casilleros ni acciones de vincular", async () => {
    await vincularPorApi(await pedir(1), [cupo(4, 1)]);
    sesion.roles = ["logistica-lectura"];
    mostrar();
    await fila("COD-DEMO-4-1");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vincular a un pedido" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Desvincular del pedido" }),
    ).not.toBeInTheDocument();
    expect(
      within(await fila("COD-DEMO-4-1")).getByRole("button", { name: "Descargar Plan de Carga" }),
    ).toBeInTheDocument();
  });
});
