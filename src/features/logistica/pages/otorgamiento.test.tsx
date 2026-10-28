import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RolNombre } from "@/features/auth/types";
import { env } from "@/lib/env";
import { logisticaHandlers, pasarPlanDemo, resetLogisticaDemo } from "@/mocks/handlers/logistica";
import { hoy } from "../format";
import { camposHistorial } from "../lib/historial";
import { descargarPlanCarga } from "../lib/plan-carga-pdf";
import type {
  Evento,
  OtorgamientoConEstado,
  OtorgarBody,
  OtorgarResultado,
  Pagina,
  Pedido,
} from "../types";
import { CuposPage } from "./cupos-page";
import { OtorgarCuposPage } from "./otorgar-cupos-page";
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
  sesion.roles = ["logistica-cupos", "logistica-pedidos"];
});
afterAll(() => server.close());

async function post<T>(ruta: string, body: object, clave = crypto.randomUUID()) {
  const response = await fetch(`${API}/${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": clave },
    body: JSON.stringify(body),
  });
  return { status: response.status, dato: (await response.json()) as T };
}
async function get<T>(ruta: string) {
  return (await (await fetch(`${API}/${ruta}`)).json()) as T;
}
async function pedir(cantidad = 2, campania = "2025-2026") {
  return (
    await post<Pedido>("pedidos", {
      clienteNumero: 9000000001,
      producto: 10,
      campania,
      fechaSolicitada: hoy(),
      cantidadCupos: cantidad,
      preventa: null,
      observacion: null,
    })
  ).dato;
}
async function otorgarPorApi(
  pedido: Pedido,
  cupos: { contrato: string; plan: number; cupo: number }[],
) {
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
      { path: "/logistica/cupos/otorgar", element: <OtorgarCuposPage /> },
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
  return { client, router };
}
/** Del paso de los cupos al Plan de Carga. */
async function confirmar() {
  fireEvent.click(screen.getByRole("button", { name: /^Revisar/ }));
  fireEvent.click(await screen.findByRole("button", { name: /^Otorgar \d+ cupos?$/ }));
  return screen.findByText(/Se otorg(ó|aron) \d+ cupos? al pedido/);
}
async function otorgados() {
  return screen.findByRole("table", { name: "Otorgamientos registrados en la app" });
}

describe("Otorgar cupos por pasos, siempre desde un pedido", () => {
  it("desde la fila del pedido arranca en los cupos de su cereal y campaña, ya elegidos", async () => {
    await pedir(2);
    const cuerpos: OtorgarBody[] = [];
    server.use(
      http.post(`${API}/otorgamientos`, async ({ request }) => {
        cuerpos.push((await request.clone().json()) as OtorgarBody);
      }),
    );
    const { client, router } = mostrar("/logistica/pedidos");
    fireEvent.click(await screen.findByRole("button", { name: "Otorgar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/logistica/cupos/otorgar"));
    const tabla = await screen.findByRole("table", { name: "Cupos de planta 0 de Soja 2025-2026" });
    // Sólo planta 0 de hoy en adelante: sin vencidos ni planes ya pasados a planta 10.
    await within(tabla).findByText("COD-DEMO-1-1");
    expect(within(tabla).queryByText("COD-DEMO-3-1")).not.toBeInTheDocument();
    expect(within(tabla).queryByText("COD-DEMO-4-1")).not.toBeInTheDocument();
    // Los pendientes del pedido se eligen solos; el tercero queda bloqueado con el motivo.
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Elegir cupo COD-DEMO-1-1" })).toBeChecked(),
    );
    expect(screen.getByRole("checkbox", { name: "Elegir cupo COD-DEMO-1-2" })).toBeChecked();
    const tercero = screen.getByRole("checkbox", { name: "Elegir cupo COD-DEMO-2-1" });
    expect(tercero).toBeDisabled();
    expect(
      within(tercero.closest("tr")!).getByText("Ya cubriste los 2 pendientes del pedido"),
    ).toBeInTheDocument();
    await confirmar();
    expect(cuerpos[0]).toMatchObject({
      cupos: [
        { contrato: "V-DEMO/1", plan: 1, cupo: 1 },
        { contrato: "V-DEMO/1", plan: 1, cupo: 2 },
      ],
    });
    expect(cuerpos[0].pedidoId).toBeTruthy();
    expect(screen.getByText(/productor 9000000001 y planta 10/)).toBeInTheDocument();
    // En Cupos › Resumen se ve lo otorgado y se confirma al leer planta 10 con el mismo productor.
    fireEvent.click(screen.getByRole("button", { name: "Ver otorgados" }));
    const lista = await otorgados();
    await waitFor(() =>
      expect(within(lista).getAllByText("Falta pasarlo en MacroGest")).toHaveLength(2),
    );
    pasarPlanDemo("V-DEMO/1", 1, 10, 9000000001);
    await client.invalidateQueries({ queryKey: ["logistica"] });
    await waitFor(() =>
      expect(within(lista).getAllByText("Confirmado en MacroGest")).toHaveLength(2),
    );
    pasarPlanDemo("V-DEMO/1", 1, 10, 1);
    await client.invalidateQueries({ queryKey: ["logistica"] });
    await waitFor(() =>
      expect(within(lista).getAllByText("Otro productor en MacroGest")).toHaveLength(2),
    );
  });

  it("«Otorgar cupo» en Cupos arranca eligiendo el pedido, por prioridad de entrega", async () => {
    await pedir(1);
    const { router } = mostrar();
    expect(screen.queryByRole("tab", { name: "Otorgar" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Otorgar cupo" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/logistica/cupos/otorgar"));
    const pedidos = await screen.findByRole("table", { name: "Pedidos con cupos pendientes" });
    const siguiente = screen.getByRole("button", { name: "Elegir cupos" });
    expect(siguiente).toBeDisabled();
    fireEvent.click(
      await within(pedidos).findByRole("radio", { name: "Elegir pedido de Productor ficticio" }),
    );
    fireEvent.click(siguiente);
    expect(await screen.findByRole("region", { name: "Pedido elegido" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Elegir cupo COD-DEMO-1-1" })).toBeChecked(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cambiar pedido" }));
    expect(
      await screen.findByRole("table", { name: "Pedidos con cupos pendientes" }),
    ).toBeInTheDocument();
  });

  it("un cupo ya otorgado en la app queda bloqueado hasta que lo pasen o lo deshagan", async () => {
    const otro = await pedir(1);
    await otorgarPorApi(otro, [{ contrato: "V-DEMO/1", plan: 2, cupo: 1 }]);
    const pedido = await pedir(3);
    mostrar(`/logistica/cupos/otorgar?pedido=${pedido.id}`);
    const cupo = await screen.findByRole("checkbox", { name: "Elegir cupo COD-DEMO-2-1" });
    expect(cupo).toBeDisabled();
    expect(
      within(cupo.closest("tr")!).getByText(
        "Otorgado en la app a Productor ficticio; falta pasarlo en MacroGest",
      ),
    ).toBeInTheDocument();
  });

  it("avisa al otorgar parte de un plan, porque en MacroGest el plan va entero a un cliente", async () => {
    const pedido = await pedir(1);
    mostrar(`/logistica/cupos/otorgar?pedido=${pedido.id}`);
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Elegir cupo COD-DEMO-1-1" })).toBeChecked(),
    );
    await confirmar();
    expect(screen.getByText(/1 cupo\(s\) más sin otorgar/)).toBeInTheDocument();
  });

  it("deshacer pide motivo, libera el cupo y avisa si MacroGest ya tenía el plan pasado", async () => {
    const pedido = await pedir(1);
    const otorgado = await otorgarPorApi(pedido, [{ contrato: "V-DEMO/1", plan: 2, cupo: 1 }]);
    expect(otorgado.status).toBe(201);
    pasarPlanDemo("V-DEMO/1", 2, 10, 9000000001);
    mostrar();
    const tabla = await otorgados();
    await within(tabla).findByText("Confirmado en MacroGest");
    fireEvent.click(within(tabla).getByRole("button", { name: "Deshacer" }));
    const dialogo = await screen.findByRole("dialog", { name: "Deshacer otorgamiento" });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Deshacer otorgamiento" }));
    expect(within(dialogo).getByText(/Completá los campos obligatorios/)).toBeInTheDocument();
    fireEvent.change(within(dialogo).getByLabelText("Motivo"), {
      target: { value: "Se cargó por error" },
    });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Deshacer otorgamiento" }));
    expect(await screen.findByText(/sigue en planta 10: volvelo a planta 0/)).toBeInTheDocument();
    const deshechos = await get<Pagina<OtorgamientoConEstado>>(
      "otorgamientos?desde=2000-01-01&hastaExclusivo=2999-01-01&deshechos=true",
    );
    expect(deshechos.filas[0].estado).toBe("deshecho");
    fireEvent.click(screen.getByRole("checkbox", { name: "Ver deshechos" }));
    expect(await within(tabla).findByText("Deshecho")).toBeInTheDocument();
  });

  it("un 409 relee el pedido y limpia la selección", async () => {
    const pedido = await pedir(1);
    server.use(
      http.post(`${API}/otorgamientos`, () =>
        HttpResponse.json({ status: 409, detail: "Ya no está disponible" }, { status: 409 }),
      ),
    );
    mostrar(`/logistica/cupos/otorgar?pedido=${pedido.id}`);
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Elegir cupo COD-DEMO-1-1" })).toBeChecked(),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Revisar/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Otorgar 1 cupo" }));
    expect(await screen.findByText(/MacroGest u otro operador cambió/)).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Pedido elegido" })).toBeInTheDocument();
  });

  it("el servidor rechaza otorgar sin pedido", async () => {
    const r = await post("otorgamientos", { cupos: [{ contrato: "V-DEMO/1", plan: 1, cupo: 1 }] });
    expect(r.status).toBe(400);
  });

  it("lectura ve los otorgados sin otorgar ni deshacer", async () => {
    const pedido = await pedir(1);
    await otorgarPorApi(pedido, [{ contrato: "V-DEMO/1", plan: 1, cupo: 1 }]);
    sesion.roles = ["logistica-lectura"];
    mostrar();
    const lista = await otorgados();
    await within(lista).findByText("Falta pasarlo en MacroGest");
    expect(screen.queryByRole("button", { name: "Otorgar cupo" })).not.toBeInTheDocument();
    expect(within(lista).queryByRole("button", { name: "Deshacer" })).not.toBeInTheDocument();
  });

  it("el historial del otorgamiento muestra la clave de MacroGest y el motivo", async () => {
    const pedido = await pedir(1);
    const { dato } = await otorgarPorApi(pedido, [{ contrato: "V-DEMO/1", plan: 1, cupo: 2 }]);
    const id = dato.otorgamientos[0].id;
    await post(`otorgamientos/${id}/deshacer`, { revision: 1, motivo: "Motivo ficticio" });
    const h = await get<Pagina<Evento>>(`otorgamientos/${id}/historial`);
    expect(h.filas.map((e) => e.tipo)).toEqual(["otorgamiento_creado", "otorgamiento_deshecho"]);
    const campos = camposHistorial(h.filas[1].datos, "otorgamientos");
    expect(campos).toEqual(
      expect.arrayContaining([
        { campo: "Contrato de venta", anterior: "Sin dato", nuevo: "V-DEMO/1" },
        { campo: "Plan de carga", anterior: "Sin dato", nuevo: "1" },
        { campo: "Cupo", anterior: "Sin dato", nuevo: "2" },
        { campo: "Motivo", anterior: "Sin dato", nuevo: "Motivo ficticio" },
      ]),
    );
  });
});

describe("Plan de Carga", () => {
  it("al terminar ofrece el Plan de Carga de cada plan y lo arma con los datos del servidor", async () => {
    vi.mocked(descargarPlanCarga).mockClear();
    const pedido = await pedir(3);
    mostrar(`/logistica/cupos/otorgar?pedido=${pedido.id}`);
    // Se eligen solos 1-1, 1-2 y 2-1: dos planes, dos Planes de Carga.
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Elegir cupo COD-DEMO-2-1" })).toBeChecked(),
    );
    await confirmar();
    expect(screen.getByRole("button", { name: /Contrato V-DEMO\/1 · plan 1/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Contrato V-DEMO\/1 · plan 2/ }));
    await waitFor(() => expect(descargarPlanCarga).toHaveBeenCalledOnce());
    const plan = vi.mocked(descargarPlanCarga).mock.calls[0][0];
    expect(plan).toMatchObject({
      contrato: "V-DEMO/1",
      plan: 2,
      titular: { codigo: 9000000001, nombre: "Productor ficticio" },
      planta: { codigo: 10, nombre: "DIRECTA" },
    });
    expect(plan.cupos.map((c) => c.codigoOtorgado)).toEqual(["COD-DEMO-2-1"]);
  });

  it("la lista de otorgados también descarga el Plan de Carga", async () => {
    vi.mocked(descargarPlanCarga).mockClear();
    const pedido = await pedir(1);
    await otorgarPorApi(pedido, [{ contrato: "V-DEMO/1", plan: 1, cupo: 2 }]);
    mostrar();
    const tabla = await otorgados();
    fireEvent.click(await within(tabla).findByRole("button", { name: "Descargar Plan de Carga" }));
    await waitFor(() => expect(descargarPlanCarga).toHaveBeenCalledOnce());
  });
});

describe("Pedidos por prioridad de entrega", () => {
  it("muestra hace cuánto se le debe y ordena primero lo más viejo", async () => {
    await pedir(1);
    await post<Pedido>("pedidos", {
      clienteNumero: 9000000001,
      producto: 10,
      campania: "2025-2026",
      fechaSolicitada: hoy(),
      cantidadCupos: 1,
      preventa: { operacion: "PF", numero: "PF-DEMO/1" },
      observacion: null,
    });
    mostrar("/logistica/pedidos");
    const tabla = await screen.findByRole("table", { name: "Pedidos de Logística" });
    await within(tabla).findByText("PF PF-DEMO/1");
    fireEvent.click(screen.getByRole("button", { name: "Le debemos hace" }));
    await waitFor(() => {
      const filas = within(tabla).getAllByRole("row").slice(1);
      expect(within(filas[0]).getByText("PF PF-DEMO/1")).toBeInTheDocument();
    });
    expect(within(tabla).getByText(/Entrega desde|día/)).toBeInTheDocument();
  });
});

describe("Resumen de Cupos", () => {
  it("cuenta disponibles de hoy en adelante y avisa los vencidos sin usar", async () => {
    mostrar();
    const region = await screen.findByRole("region", { name: "Cupos disponibles" });
    expect(await within(region).findByText("Total disponibles")).toBeInTheDocument();
    expect(within(region).getAllByText("4").length).toBeGreaterThan(0);
    expect(within(region).getByText("1 vencidos sin usar")).toBeInTheDocument();
    fireEvent.click(within(region).getByRole("button", { name: "Ver vencidos" }));
    const vencidos = await screen.findByRole("table", { name: "Cupos vencidos sin usar" });
    expect(await within(vencidos).findByText("COD-DEMO-3-1")).toBeInTheDocument();
    expect(screen.queryByText("Seguimiento de solicitudes")).not.toBeInTheDocument();
  });
});
