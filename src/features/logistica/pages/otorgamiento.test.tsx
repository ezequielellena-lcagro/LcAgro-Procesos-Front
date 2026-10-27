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

const sesion = vi.hoisted(() => ({ roles: ["logistica-cupos"] as RolNombre[] }));
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
  sesion.roles = ["logistica-cupos"];
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
function mostrar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter([{ path: "/logistica/cupos", element: <CuposPage /> }], {
    initialEntries: ["/logistica/cupos"],
  });
  routers.push(router);
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return client;
}
async function abrir() {
  fireEvent.click(screen.getByRole("tab", { name: "Otorgar" }));
  return screen.findByRole("table", { name: "Cupos de planta 0 para otorgar" });
}
const elegirCupo = async (codigo: string) =>
  fireEvent.click(await screen.findByRole("checkbox", { name: `Elegir cupo ${codigo}` }));
async function confirmar() {
  fireEvent.click(screen.getByRole("button", { name: "Revisar otorgamiento" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar otorgamiento" }));
  return screen.findByText(/Se otorgaron \d cupos/);
}
const registrados = () =>
  screen.findByRole("table", { name: "Otorgamientos registrados en la app" });

describe("Otorgamiento contra el cupo de MacroGest", () => {
  it("lista sólo planta 0 de hoy en adelante: sin vencidos ni planes ya pasados a planta 10", async () => {
    mostrar();
    const tabla = await abrir();
    await within(tabla).findByText("COD-DEMO-1-1");
    expect(within(tabla).getByText("COD-DEMO-2-2")).toBeInTheDocument();
    expect(within(tabla).queryByText("COD-DEMO-3-1")).not.toBeInTheDocument();
    expect(within(tabla).queryByText("COD-DEMO-4-1")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Cupos recibidos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Cupos MacroGest" })).not.toBeInTheDocument();
  });

  it("otorga a un pedido con la clave de MacroGest y lo confirma al leer planta 10 con el mismo productor", async () => {
    await pedir(2);
    const cuerpos: OtorgarBody[] = [];
    server.use(
      http.post(`${API}/otorgamientos`, async ({ request }) => {
        cuerpos.push((await request.clone().json()) as OtorgarBody);
      }),
    );
    const client = mostrar();
    await abrir();
    fireEvent.click(
      await screen.findByRole("radio", { name: "Elegir pedido de Productor ficticio" }),
    );
    await elegirCupo("COD-DEMO-1-1");
    await elegirCupo("COD-DEMO-1-2");
    await confirmar();
    expect(cuerpos[0].cupos).toEqual([
      { contrato: "V-DEMO/1", plan: 1, cupo: 1 },
      { contrato: "V-DEMO/1", plan: 1, cupo: 2 },
    ]);
    expect(cuerpos[0].clienteNumero).toBe(9000000001);
    const tabla = await registrados();
    await waitFor(() =>
      expect(within(tabla).getAllByText("Falta pasarlo en MacroGest")).toHaveLength(2),
    );
    // El operador pasa el plan en MacroGest; la app lo lee y lo da por confirmado.
    pasarPlanDemo("V-DEMO/1", 1, 10, 9000000001);
    await client.invalidateQueries({ queryKey: ["logistica"] });
    await waitFor(() =>
      expect(within(tabla).getAllByText("Confirmado en MacroGest")).toHaveLength(2),
    );
    // Si lo otorgan a otro productor, avisa con el que tiene MacroGest.
    pasarPlanDemo("V-DEMO/1", 1, 10, 1);
    await client.invalidateQueries({ queryKey: ["logistica"] });
    await waitFor(() =>
      expect(within(tabla).getAllByText("Otro productor en MacroGest")).toHaveLength(2),
    );
    expect(within(tabla).getAllByText(/Cliente de prueba uno/)).toHaveLength(2);
  });

  it("dice contra qué compara cuando el cupo no coincide con la campaña del pedido", async () => {
    await pedir(1, "2024-2025");
    mostrar();
    await abrir();
    fireEvent.click(
      await screen.findByRole("radio", { name: "Elegir pedido de Productor ficticio" }),
    );
    const cupo = await screen.findByRole("checkbox", { name: "Elegir cupo COD-DEMO-1-1" });
    expect(cupo).toBeDisabled();
    expect(
      within(cupo.closest("tr")!).getByText("Cupo Soja 2025-2026 · pedido Soja 2024-2025"),
    ).toBeInTheDocument();
  });

  it("un cupo ya otorgado en la app queda bloqueado hasta que lo pasen o lo deshagan", async () => {
    await post<OtorgarResultado>("otorgamientos", {
      destinatarioTipo: "propio",
      cupos: [{ contrato: "V-DEMO/1", plan: 2, cupo: 1 }],
    });
    mostrar();
    await abrir();
    const cupo = await screen.findByRole("checkbox", { name: "Elegir cupo COD-DEMO-2-1" });
    expect(cupo).toBeDisabled();
    expect(
      within(cupo.closest("tr")!).getByText(
        "Otorgado en la app a carga propia; falta pasarlo en MacroGest",
      ),
    ).toBeInTheDocument();
  });

  it("avisa al otorgar parte de un plan, porque en MacroGest el plan va entero a un cliente", async () => {
    mostrar();
    await abrir();
    fireEvent.click(screen.getByRole("radio", { name: "Propio" }));
    await elegirCupo("COD-DEMO-1-1");
    await confirmar();
    expect(screen.getByText(/1 cupo\(s\) más sin otorgar/)).toBeInTheDocument();
  });

  it("deshacer pide motivo, libera el cupo y avisa si MacroGest ya tenía el plan pasado", async () => {
    const otorgado = await post<OtorgarResultado>("otorgamientos", {
      destinatarioTipo: "propio",
      cupos: [{ contrato: "V-DEMO/1", plan: 2, cupo: 1 }],
    });
    expect(otorgado.status).toBe(201);
    pasarPlanDemo("V-DEMO/1", 2, 15, null);
    mostrar();
    await abrir();
    const tabla = await registrados();
    await within(tabla).findByText("Confirmado en MacroGest");
    fireEvent.click(within(tabla).getByRole("button", { name: "Deshacer" }));
    const dialogo = await screen.findByRole("dialog", { name: "Deshacer otorgamiento" });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Deshacer otorgamiento" }));
    expect(within(dialogo).getByText(/Completá los campos obligatorios/)).toBeInTheDocument();
    fireEvent.change(within(dialogo).getByLabelText("Motivo"), {
      target: { value: "Se cargó por error" },
    });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Deshacer otorgamiento" }));
    expect(await screen.findByText(/sigue en planta 15: volvelo a planta 0/)).toBeInTheDocument();
    const deshechos = await get<Pagina<OtorgamientoConEstado>>(
      "otorgamientos?desde=2000-01-01&hastaExclusivo=2999-01-01&deshechos=true",
    );
    expect(deshechos.filas[0].estado).toBe("deshecho");
    fireEvent.click(screen.getByRole("checkbox", { name: "Ver deshechos" }));
    expect(await within(tabla).findByText("Deshecho")).toBeInTheDocument();
  });

  it("un 409 refresca y limpia la selección", async () => {
    server.use(
      http.post(`${API}/otorgamientos`, () =>
        HttpResponse.json({ status: 409, detail: "Ya no está disponible" }, { status: 409 }),
      ),
    );
    mostrar();
    await abrir();
    fireEvent.click(screen.getByRole("radio", { name: "Propio" }));
    await elegirCupo("COD-DEMO-1-1");
    fireEvent.click(screen.getByRole("button", { name: "Revisar otorgamiento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar otorgamiento" }));
    expect(await screen.findByText(/MacroGest u otro operador cambió/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Elegir cupo COD-DEMO-1-1" })).not.toBeChecked();
  });

  it("lectura ve cupos y otorgamientos sin acciones de otorgar ni deshacer", async () => {
    await post<OtorgarResultado>("otorgamientos", {
      destinatarioTipo: "propio",
      cupos: [{ contrato: "V-DEMO/1", plan: 1, cupo: 1 }],
    });
    sesion.roles = ["logistica-lectura"];
    mostrar();
    const tabla = await abrir();
    await within(tabla).findByText("COD-DEMO-1-1");
    expect(screen.queryByRole("checkbox", { name: /Elegir cupo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revisar otorgamiento" })).not.toBeInTheDocument();
    const lista = await registrados();
    await within(lista).findByText("Falta pasarlo en MacroGest");
    expect(within(lista).queryByRole("button", { name: "Deshacer" })).not.toBeInTheDocument();
  });

  it("el historial del otorgamiento muestra la clave de MacroGest y el motivo", async () => {
    const { dato } = await post<OtorgarResultado>("otorgamientos", {
      destinatarioTipo: "propio",
      cupos: [{ contrato: "V-DEMO/1", plan: 1, cupo: 2 }],
    });
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
        { campo: "Tipo de destinatario", anterior: "Sin dato", nuevo: "Propio" },
        { campo: "Motivo", anterior: "Sin dato", nuevo: "Motivo ficticio" },
      ]),
    );
  });
});

describe("Plan de Carga", () => {
  it("al otorgar ofrece el Plan de Carga de cada plan y lo arma con los datos del servidor", async () => {
    vi.mocked(descargarPlanCarga).mockClear();
    mostrar();
    await abrir();
    fireEvent.click(screen.getByRole("radio", { name: "Propio" }));
    await elegirCupo("COD-DEMO-1-1");
    await elegirCupo("COD-DEMO-2-1");
    await confirmar();
    expect(screen.getByRole("button", { name: /Contrato V-DEMO\/1 · plan 1/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Contrato V-DEMO\/1 · plan 2/ }));
    await waitFor(() => expect(descargarPlanCarga).toHaveBeenCalledOnce());
    const plan = vi.mocked(descargarPlanCarga).mock.calls[0][0];
    // Propio: titular La Clementina (cargador 1) y planta 15; sólo el cupo otorgado de ese plan.
    expect(plan).toMatchObject({
      contrato: "V-DEMO/1",
      plan: 2,
      titular: { codigo: 1 },
      planta: { codigo: 15 },
    });
    expect(plan.cupos.map((c) => c.codigoOtorgado)).toEqual(["COD-DEMO-2-1"]);
  });

  it("la lista de otorgamientos también descarga el Plan de Carga del cliente", async () => {
    vi.mocked(descargarPlanCarga).mockClear();
    await post<OtorgarResultado>("otorgamientos", {
      destinatarioTipo: "cliente",
      clienteNumero: 9000000001,
      cupos: [{ contrato: "V-DEMO/1", plan: 1, cupo: 2 }],
    });
    mostrar();
    await abrir();
    const tabla = await registrados();
    fireEvent.click(await within(tabla).findByRole("button", { name: /Plan de Carga/ }));
    await waitFor(() => expect(descargarPlanCarga).toHaveBeenCalledOnce());
    expect(vi.mocked(descargarPlanCarga).mock.calls[0][0]).toMatchObject({
      titular: { codigo: 9000000001, nombre: "Productor ficticio" },
      planta: { codigo: 10, nombre: "DIRECTA" },
    });
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
