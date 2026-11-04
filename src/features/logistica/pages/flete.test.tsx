import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { getResponse, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RolNombre } from "@/features/auth/types";
import { env } from "@/lib/env";
import { authHandlers } from "@/mocks/handlers/auth";
import { logisticaFlotaHandlers, resetFlotaDemo } from "@/mocks/handlers/logistica-flota";
import { camposHistorial } from "../lib/historial";
import type {
  Detalle,
  Evento,
  FichaFlotaDto,
  FichaFlotaRequest,
  FichaFlotaVersionDto,
  Pagina,
} from "../types";
import { FletePage } from "./flete-page";

const sesion = vi.hoisted(() => ({ roles: ["logistica-flete"] as RolNombre[] }));
vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: 7, nombre: "Operador ficticio", roles: sesion.roles } }),
}));
const API = env.apiUrl + "/logistica/flota";
const server = setupServer(...logisticaFlotaHandlers, ...authHandlers);
const routers: ReturnType<typeof createMemoryRouter>[] = [];
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  routers.splice(0).forEach((r) => r.dispose());
  server.resetHandlers();
  vi.restoreAllMocks();
  resetFlotaDemo();
  sesion.roles = ["logistica-flete"];
});
afterAll(() => server.close());
const ficha = (extra: Partial<FichaFlotaRequest> = {}): FichaFlotaRequest => ({
  patenteChasis: "AA-123 BB",
  patenteAcoplado: null,
  conductor: null,
  cuitConductor: null,
  transportista: null,
  cuitTransportista: null,
  importeReferencia: null,
  moneda: null,
  vigenteDesde: null,
  ...extra,
});
async function enviar(
  path: string,
  body: object,
  method = "POST",
  key: string = crypto.randomUUID(),
  actor?: number,
) {
  return fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": key,
      ...(actor ? { Authorization: "Bearer mock-access-" + actor } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function command(path: string, body: object, method = "POST", actor?: number) {
  const r = await enviar(path, body, method, undefined, actor);
  expect(r.ok).toBe(true);
  return (await r.json()) as FichaFlotaDto;
}
async function get<T>(path = "") {
  const r = await fetch(API + path);
  expect(r.ok).toBe(true);
  return (await r.json()) as T;
}
async function actual(id: string) {
  return (await get<Detalle<FichaFlotaDto>>("/" + id)).dato;
}
function mostrar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60000 }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: "/anterior", element: <p>Página anterior</p> },
      {
        path: "/logistica/flete",
        element: (
          <>
            <Link to="/salida">Salir de Flete</Link>
            <FletePage />
          </>
        ),
      },
      { path: "/salida", element: <p>Página salida</p> },
    ],
    { initialEntries: ["/anterior", "/logistica/flete"], initialIndex: 1 },
  );
  routers.push(router);
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { client, router };
}
async function alta() {
  fireEvent.click(await screen.findByRole("button", { name: "Nueva ficha" }));
  return screen.findByRole("dialog", { name: "Nueva ficha de flota" });
}
function completar() {
  fireEvent.change(screen.getByLabelText("Patente de chasis"), { target: { value: "AA-123 BB" } });
}
async function abrir(nombre: "Editar" | "Baja" | "Detalle") {
  fireEvent.click((await screen.findAllByRole("button", { name: nombre }))[0]);
  return screen.findByRole("dialog", {
    name:
      nombre === "Editar"
        ? "Editar ficha de flota"
        : nombre === "Baja"
          ? "Dar de baja ficha de flota"
          : "Detalle de ficha de flota",
  });
}

describe("Flota MSW: contrato propio", () => {
  it("inicia vacío con wrapper de lista y conserva datos entre usuarios demo", async () => {
    expect(await get<Pagina<FichaFlotaDto>>()).toMatchObject({
      filas: [],
      hayMas: false,
      datosAl: expect.any(String),
    });
    const a = await command("", ficha(), "POST", 7);
    const login = await fetch(env.apiUrl + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "logistica-lectura@lcagro.local", password: "ficticio" }),
    });
    expect(login.status).toBe(200);
    expect((await actual(a.id)).id).toBe(a.id);
  });
  it("crea, edita y baja con versión exacta inmutable y eventos nested ficha", async () => {
    const a = await command(
      "",
      ficha({
        cuitConductor: "20-12345678-6",
        importeReferencia: "00012.3400",
        moneda: "ARS",
        vigenteDesde: "2026-10-04",
      }),
      "POST",
      7,
    );
    expect(a).toMatchObject({
      activo: true,
      revision: 1,
      creadoPorId: 7,
      actualizadoPorId: 7,
      ficha: { importeReferencia: "12.34", cuitConductor: "20123456786" },
    });
    expect(a.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(a.versionId).not.toBe(a.id);
    const version = await get<Detalle<FichaFlotaVersionDto>>(
      "/" + a.id + "/versiones/" + a.versionId,
    );
    const b = await command(
      "/" + a.id,
      {
        revision: 1,
        ficha: ficha({ conductor: "Conductor ficticio" }),
        motivo: " Corrección ficticia ",
      },
      "PUT",
      12,
    );
    expect(b).toMatchObject({
      revision: 2,
      creadoPorId: 7,
      actualizadoPorId: 12,
      ficha: { conductor: "Conductor ficticio" },
    });
    expect(
      (await get<Detalle<FichaFlotaVersionDto>>("/" + a.id + "/versiones/" + a.versionId)).dato,
    ).toEqual(version.dato);
    const c = await command(
      "/" + a.id + "/baja",
      { revision: 2, motivo: "Fin del registro ficticio" },
      "POST",
      7,
    );
    expect(c).toMatchObject({ activo: false, revision: 3, ficha: b.ficha });
    const h = await get<Pagina<Evento>>("/" + a.id + "/historial?despuesRevision=1&tamano=1");
    expect(h.filas.map((e) => e.tipo)).toEqual(["ficha_flota_editada", "ficha_flota_baja"]);
    expect(h.hayMas).toBe(false);
    expect(JSON.parse(h.filas[0].datos)).toMatchObject({
      anterior: { ficha: a.ficha },
      nuevo: { ficha: b.ficha },
      motivo: "Corrección ficticia",
      registradoPorId: 12,
    });
    expect(
      (await enviar("/" + a.id, { revision: 3, ficha: ficha(), motivo: "Intento" }, "PUT")).status,
    ).toBe(409);
    expect((await actual(a.id)).revision).toBe(3);
    const otro = await command("", ficha({ patenteChasis: "BB 456 CC" }));
    expect((await fetch(API + "/" + otro.id + "/versiones/" + a.versionId)).status).toBe(404);
    expect((await fetch(API + "/" + crypto.randomUUID())).status).toBe(404);
  });
  it("página UUID y filtros texto/estado, busca patente equivalente sin depender de página", async () => {
    const a = await command(
      "",
      ficha({
        conductor: "Ana ficticia",
        transportista: "Transporte Norte",
        patenteAcoplado: "AC-001",
      }),
    );
    const b = await command("", ficha({ patenteChasis: "BB 456 CC", conductor: "Bruno ficticio" }));
    const c = await command(
      "",
      ficha({ patenteChasis: "CC 789 DD", transportista: "Transporte Sur" }),
    );
    await command("/" + b.id + "/baja", { revision: 1, motivo: "Fin" });
    const p = await get<Pagina<FichaFlotaDto>>("?tamano=1");
    expect(p.filas).toHaveLength(1);
    expect(p.hayMas).toBe(true);
    const siguientes = await get<Pagina<FichaFlotaDto>>("?tamano=2&despuesId=" + p.filas[0].id);
    expect([p.filas[0].id, ...siguientes.filas.map((f) => f.id)]).toEqual(
      [a.id, b.id, c.id].sort(),
    );
    expect(siguientes.hayMas).toBe(false);
    for (const buscar of ["Ana", "Norte", "AA123BB", "AC-001"]) {
      expect(
        (await get<Pagina<FichaFlotaDto>>("?buscar=" + buscar)).filas.map((f) => f.id),
      ).toEqual([a.id]);
    }
    expect((await get<Pagina<FichaFlotaDto>>("?activo=false")).filas.map((f) => f.id)).toEqual([
      b.id,
    ]);
    expect((await get<Pagina<FichaFlotaDto>>("?activo=true")).filas).toHaveLength(2);
  });
  it("advierte sólo otro head activo global incluso fuera de página; históricos e inactivos no", async () => {
    const a = await command("", ficha());
    const b = await command("", ficha({ patenteChasis: "aa123\u00a0bb" }));
    expect(b.patenteChasisRepetida).toBe(true);
    expect((await actual(a.id)).patenteChasisRepetida).toBe(true);
    const p = await get<Pagina<FichaFlotaDto>>("?tamano=1");
    expect(p.filas[0].patenteChasisRepetida).toBe(true);
    await command(
      "/" + b.id,
      { revision: 1, ficha: ficha({ patenteChasis: "OTRA-01" }), motivo: "Cambio" },
      "PUT",
    );
    expect((await actual(a.id)).patenteChasisRepetida).toBe(false);
    const c = await command("", ficha());
    await command("/" + c.id + "/baja", { revision: 1, motivo: "Fin" });
    expect((await actual(a.id)).patenteChasisRepetida).toBe(false);
    expect((await actual(c.id)).patenteChasisRepetida).toBe(true);
  });
  it("replay guarda respuesta original y valida antes; route id, valores raw, usuario y operación forman alcance", async () => {
    const key = crypto.randomUUID();
    const body = ficha({ patenteChasis: " AA-123 BB " });
    const r = await enviar("", body, "POST", key, 7);
    expect(r.status).toBe(201);
    const a = (await r.json()) as FichaFlotaDto;
    const editKey = crypto.randomUUID();
    const edit = { revision: 1, ficha: ficha({ conductor: "Ana" }), motivo: " Cambio " };
    expect((await enviar("/" + a.id, edit, "PUT", editKey, 7)).status).toBe(200);
    await command("/" + a.id + "/baja", { revision: 2, motivo: "Fin" }, "POST", 7);
    const replay = await enviar("", body, "POST", key, 7);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(a);
    expect((await enviar("", ficha(), "POST", key, 7)).status).toBe(409);
    expect((await enviar("", ficha({ patenteChasis: "" }), "POST", key, 7)).status).toBe(400);
    const otro = await command("", ficha({ patenteChasis: "BB-456 CC" }), "POST", 7);
    expect((await enviar("/" + otro.id, edit, "PUT", editKey, 7)).status).toBe(409);
    expect(
      (await enviar("/" + a.id, { ...edit, motivo: "Cambio" }, "PUT", editKey, 7)).status,
    ).toBe(409);
    const sameEdit = await enviar("/" + a.id, edit, "PUT", editKey, 7);
    expect((await sameEdit.json()).revision).toBe(2);
    expect((await enviar("", body, "POST", key, 12)).status).toBe(201);
    expect(
      (await enviar("/" + otro.id + "/baja", { revision: 1, motivo: "Fin" }, "POST", key, 7))
        .status,
    ).toBe(200);
  });
  it.each([
    { patenteAcoplado: "" },
    { conductor: " " },
    { cuitTransportista: "20123456785" },
    { importeReferencia: 0 },
    { importeReferencia: "0" },
    { importeReferencia: "1,5", moneda: "ARS", vigenteDesde: "2026-10-04" },
    { importeReferencia: "100000000000000", moneda: "USD", vigenteDesde: "2026-10-04" },
    { importeReferencia: "1", moneda: "USD", vigenteDesde: "2026-02-29" },
    { moneda: "ARS" },
    { vigenteDesde: "2026-10-04" },
  ])("rechaza cuerpo inválido atómicamente %j", async (extra) => {
    expect((await enviar("", { ...ficha(), ...extra })).status).toBe(400);
    expect((await get<Pagina<FichaFlotaDto>>()).filas).toEqual([]);
  });
  it.each([
    "?tamano=0",
    "?tamano=201",
    "?tamano=x",
    "?activo=x",
    "?despuesId=bad",
    "?despuesId=00000000-0000-0000-0000-000000000000",
    "?buscar=%20",
    "?buscar=" + "x".repeat(201),
  ])("rechaza filtros %s", async (query) => {
    expect((await fetch(API + query)).status).toBe(400);
  });
  it("rechaza claves vacías/no UUID, motivo inválido y cursor revision negativo", async () => {
    for (const key of ["", "bad", "00000000-0000-0000-0000-000000000000"]) {
      expect((await enviar("", ficha(), "POST", key)).status).toBe(400);
    }
    const a = await command("", ficha());
    for (const motivo of ["", " ", "a\n", "x".repeat(501)]) {
      expect((await enviar("/" + a.id + "/baja", { revision: 1, motivo })).status).toBe(400);
    }
    expect(
      (await enviar("/" + a.id, { revision: 0, ficha: ficha(), motivo: "Cambio" }, "PUT")).status,
    ).toBe(400);
    expect((await fetch(API + "/" + a.id + "/historial?despuesRevision=-1")).status).toBe(400);
    expect((await actual(a.id)).revision).toBe(1);
  });
  it("permiso lector sólo lee; otros gestores no heredan Flete; actor usa autenticación", async () => {
    const a = await command("", ficha(), "POST", 12);
    for (const actor of [8, 9, 10, 11]) {
      expect((await enviar("", ficha(), "POST", undefined, actor)).status).toBe(403);
      const r = await fetch(API, { headers: { Authorization: "Bearer mock-access-" + actor } });
      expect(r.status).toBe(actor === 8 ? 200 : 403);
    }
    expect(a.creadoPorId).toBe(12);
    expect((await fetch(API, { headers: { Authorization: "Bearer desconocido" } })).status).toBe(
      401,
    );
  });
  it("historial fijo 200 usa revision y no sustituye versiones antiguas", async () => {
    let a = await command("", ficha());
    for (let n = 1; n <= 201; n++)
      a = await command(
        "/" + a.id,
        {
          revision: a.revision,
          ficha: ficha({ conductor: "Ficticio " + n }),
          motivo: "Cambio " + n,
        },
        "PUT",
      );
    const p = await get<Pagina<Evento>>("/" + a.id + "/historial?tamano=1");
    expect(p.filas).toHaveLength(200);
    expect(p.hayMas).toBe(true);
    const q = await get<Pagina<Evento>>("/" + a.id + "/historial?despuesRevision=200");
    expect(q.filas.map((e) => e.revision)).toEqual([201, 202]);
    expect(q.hayMas).toBe(false);
  });
});

describe("Flete UI", () => {
  it("vacío por defecto y alta opcional, cero con moneda/fecha explícitas y decimal string exacto", async () => {
    mostrar();
    expect(
      await screen.findByText("Todavía no hay fichas de flota. Registrá la primera ficha."),
    ).toBeInTheDocument();
    await alta();
    completar();
    expect(screen.getByLabelText("Moneda")).toHaveValue("");
    expect(screen.getByLabelText("Vigente desde")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Importe de referencia"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar ficha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Completá");
    fireEvent.change(screen.getByLabelText("Moneda"), { target: { value: "USD" } });
    fireEvent.change(screen.getByLabelText("Vigente desde"), { target: { value: "2026-10-04" } });
    fireEvent.change(screen.getByLabelText("Importe de referencia"), {
      target: { value: "99999999999999,9999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar ficha" }));
    expect(await screen.findByText("USD 99.999.999.999.999,9999")).toBeInTheDocument();
    expect((await get<Pagina<FichaFlotaDto>>()).filas[0].ficha).toMatchObject({
      importeReferencia: "99999999999999.9999",
      moneda: "USD",
      conductor: null,
      cuitConductor: null,
    });
  });
  it("edita/baja tras lectura fresca, mantiene detalle/auditoría e historial humano para lector", async () => {
    const a = await command("", ficha({ cuitConductor: "20-12345678-6" }));
    const { client } = mostrar();
    client.setQueryData(["logistica", "flota/" + a.id, {}], a);
    await command(
      "/" + a.id,
      { revision: 1, ficha: ficha({ conductor: "Actualizado" }), motivo: "Cambio externo" },
      "PUT",
    );
    const d = await abrir("Editar");
    expect(within(d).getByLabelText("Conductor")).toHaveValue("Actualizado");
    fireEvent.change(screen.getByLabelText("Conductor"), { target: { value: "Ana ficticia" } });
    fireEvent.change(screen.getByLabelText("Motivo de la edición"), {
      target: { value: "Corregir conductor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Ana ficticia")).toBeInTheDocument();
    await abrir("Baja");
    fireEvent.change(screen.getByLabelText("Motivo de la baja"), {
      target: { value: "Fin de vigencia" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar baja" }));
    expect(await screen.findByText("Inactiva")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Baja" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Historial" }));
    const h = await screen.findByRole("dialog", { name: "Historial de la ficha" });
    expect(await within(h).findByText("Ficha dada de baja")).toBeInTheDocument();
    // El alta muestra lo cargado; la baja, sólo lo que cambió y su motivo.
    expect(within(h).getAllByText("Patente de chasis").length).toBeGreaterThan(0);
    expect(within(h).getAllByText("Fin de vigencia").length).toBeGreaterThan(0);
    expect(within(h).queryByText("ID de versión")).not.toBeInTheDocument();
  });
  it("lector consulta detalle/CUIT e historial sin acciones de gestión y navegación Flete-only", async () => {
    await command("", ficha({ conductor: "Ana", cuitConductor: "20-12345678-6" }));
    sesion.roles = ["logistica-lectura"];
    mostrar();
    await screen.findByText("Ana");
    expect(screen.queryByRole("button", { name: "Nueva ficha" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Baja" })).not.toBeInTheDocument();
    expect(screen.queryByText("20123456786")).not.toBeInTheDocument();
    const d = await abrir("Detalle");
    expect(within(d).getByLabelText("CUIT del conductor")).toHaveValue("20123456786");
    expect(within(d).getByText(/Creada por Usuario/)).toBeInTheDocument();
  });
  it("usuario sólo Flete no ve Pedidos/Cupos y filtros aplican explícitamente", async () => {
    await command("", ficha({ conductor: "Ana ficticia" }));
    await command("", ficha({ patenteChasis: "OTRA-01", conductor: "Bruno ficticio" }));
    mostrar();
    await screen.findByText("Bruno ficticio");
    expect(screen.queryByRole("link", { name: "Pedidos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cupos" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar flota"), { target: { value: "Ana" } });
    expect(screen.getByText("Bruno ficticio")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(screen.queryByText("Bruno ficticio")).not.toBeInTheDocument());
  });
  it("timeout→400 conserva incertidumbre, UUID y cuerpo congelado; bloquea Esc/overlay/ruta/back/unload", async () => {
    const intentos: { body: unknown; key: string | null }[] = [];
    let n = 0;
    server.use(
      http.post(API, async ({ request }) => {
        intentos.push({
          body: await request.clone().json(),
          key: request.headers.get("Idempotency-Key"),
        });
        if (++n === 1) {
          await getResponse(logisticaFlotaHandlers, request);
          return HttpResponse.error();
        }
        if (n === 2)
          return HttpResponse.json(
            { status: 400, detail: "Fallo conocido ficticio" },
            { status: 400 },
          );
        return getResponse(logisticaFlotaHandlers, request);
      }),
    );
    const { router } = mostrar();
    await alta();
    completar();
    fireEvent.click(screen.getByRole("button", { name: "Guardar ficha" }));
    await screen.findByRole("button", { name: "Reintentar operación" });
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByLabelText("Patente de chasis")).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    fireEvent.click(screen.getByRole("dialog").parentElement!.firstElementChild!);
    fireEvent.click(screen.getByRole("link", { name: "Salir de Flete" }));
    await act(() => router.navigate(-1));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/logistica/flete");
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar operación" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Fallo conocido ficticio");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar operación" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(intentos).toHaveLength(3);
    expect(intentos[1]).toEqual(intentos[0]);
    expect(intentos[2]).toEqual(intentos[0]);
    expect((await get<Pagina<FichaFlotaDto>>()).filas).toHaveLength(1);
  });
  it("409 relee y exige un nuevo intento explícito con datos/revisión y UUID nuevos", async () => {
    const a = await command("", ficha());
    const intentos: { body: unknown; key: string | null }[] = [];
    let primera = true;
    server.use(
      http.put(API + "/:id", async ({ request }) => {
        intentos.push({
          body: await request.clone().json(),
          key: request.headers.get("Idempotency-Key"),
        });
        if (primera) {
          primera = false;
          await getResponse(
            logisticaFlotaHandlers,
            new Request(API + "/" + a.id, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": crypto.randomUUID(),
              },
              body: JSON.stringify({
                revision: 1,
                ficha: ficha({ conductor: "Dato externo" }),
                motivo: "Externo",
              }),
            }),
          );
          return HttpResponse.json({ status: 409, detail: "La ficha cambió" }, { status: 409 });
        }
        return getResponse(logisticaFlotaHandlers, request);
      }),
    );
    mostrar();
    await abrir("Editar");
    fireEvent.change(screen.getByLabelText("Conductor"), { target: { value: "Dato anterior" } });
    fireEvent.change(screen.getByLabelText("Motivo de la edición"), {
      target: { value: "Cambio" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const d = await screen.findByRole("dialog", { name: "Detalle de ficha de flota" });
    expect(within(d).getByLabelText("Conductor")).toHaveValue("Dato externo");
    expect(intentos).toHaveLength(1);
    fireEvent.click(within(d).getByRole("button", { name: "Cerrar detalle" }));
    await abrir("Editar");
    fireEvent.change(screen.getByLabelText("Conductor"), { target: { value: "Dato revisado" } });
    fireEvent.change(screen.getByLabelText("Motivo de la edición"), {
      target: { value: "Nuevo intento" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Dato revisado")).toBeInTheDocument();
    expect(intentos[1].body).toMatchObject({ revision: 2, ficha: { conductor: "Dato revisado" } });
    expect(intentos[1].key).not.toBe(intentos[0].key);
  });
  it("pending protege cancelación antes de recibir respuesta", async () => {
    let liberar!: () => void;
    const espera = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    server.use(
      http.post(API, async ({ request }) => {
        await espera;
        return getResponse(logisticaFlotaHandlers, request);
      }),
    );
    mostrar();
    await alta();
    completar();
    fireEvent.click(screen.getByRole("button", { name: "Guardar ficha" }));
    expect(await screen.findByRole("button", { name: "Guardando…" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    liberar();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("historial allowlist Flota aplana ficha y limita metadatos sin alterar histories anteriores", () => {
    const campos = camposHistorial(
      JSON.stringify({
        anterior: null,
        nuevo: {
          id: "version",
          revision: 1,
          activo: true,
          ficha: ficha({ importeReferencia: "0", moneda: "ARS", vigenteDesde: "2026-10-04" }),
          registradoPorId: 7,
          registradoAl: "2026-10-04T12:00:00Z",
          secreto: "No mostrar",
        },
        motivo: null,
      }),
      "flota",
    );
    expect(campos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ campo: "Importe de referencia", nuevo: "0" }),
        expect.objectContaining({ campo: "Vigente desde", nuevo: "04/10/2026" }),
        expect.objectContaining({ campo: "Estado de la ficha", nuevo: "Activa" }),
      ]),
    );
    expect(JSON.stringify(campos)).not.toContain("No mostrar");
    expect(
      camposHistorial(JSON.stringify({ vigenteDesde: "2026-10-04T12:00:00Z" }), "otorgamientos")[0]
        .campo,
    ).toBe("Vinculado al");
  });
});

describe("Flete: continuidad de filtros y errores conocidos", () => {
  it("buscar guiones sin contenido equivalente no selecciona todo el padrón", async () => {
    await command("", ficha({ patenteChasis: "AA123BB" }));
    expect((await get<Pagina<FichaFlotaDto>>("?buscar=--")).filas).toEqual([]);
  });
  it("aplicar filtros reinicia cursor aunque vuelva a una búsqueda ya paginada", async () => {
    for (let n = 0; n < 51; n++)
      await command(
        "",
        ficha({
          patenteChasis: "FICTICIO" + n,
          conductor: n === 0 ? "Ana ficticia" : "Otro ficticio",
        }),
      );
    const lecturas: URLSearchParams[] = [];
    server.use(
      http.get(API, ({ request }) => {
        lecturas.push(new URL(request.url).searchParams);
        return getResponse(logisticaFlotaHandlers, request);
      }),
    );
    mostrar();
    // Paginado como el resto de las tablas: Anterior / Página N / Siguiente.
    expect(screen.queryByRole("button", { name: "Cargar más filas" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /Siguiente/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(await screen.findByText("Página 2")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar flota"), { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(screen.getAllByText("Ana ficticia")).toHaveLength(1));
    expect(screen.getByText("Página 1")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar flota"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Siguiente/ })).toBeEnabled());
    expect(lecturas.at(-1)?.has("despuesId")).toBe(false);
    expect(screen.getByRole("table", { name: "Flete y camiones" }).parentElement).toHaveClass(
      "overflow-x-auto",
    );
  });
  it("400 anterior a cualquier incertidumbre permite cerrar sin crear ni alterar fichas", async () => {
    server.use(
      http.post(API, () =>
        HttpResponse.json({ status: 400, detail: "Rechazo ficticio" }, { status: 400 }),
      ),
    );
    mostrar();
    await alta();
    completar();
    fireEvent.click(screen.getByRole("button", { name: "Guardar ficha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Rechazo ficticio");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect((await get<Pagina<FichaFlotaDto>>()).filas).toHaveLength(0);
  });
});

describe("Flete: límites de lectura y escritura", () => {
  it.each(["ARS", "USD"] as const)(
    "guarda cero explícito en %s y mantiene ausencia separada",
    async (moneda) => {
      mostrar();
      await alta();
      completar();
      fireEvent.change(screen.getByLabelText("Importe de referencia"), { target: { value: "0" } });
      fireEvent.change(screen.getByLabelText("Moneda"), { target: { value: moneda } });
      fireEvent.change(screen.getByLabelText("Vigente desde"), { target: { value: "1753-01-01" } });
      fireEvent.click(screen.getByRole("button", { name: "Guardar ficha" }));
      expect(await screen.findByText(moneda + " 0")).toBeInTheDocument();
      expect((await get<Pagina<FichaFlotaDto>>()).filas[0].ficha).toMatchObject({
        importeReferencia: "0",
        moneda,
        vigenteDesde: "1753-01-01",
      });
    },
  );
  it("ningún dato cacheado abre gestión si la nueva lectura falla", async () => {
    const a = await command("", ficha());
    const { client } = mostrar();
    client.setQueryData(["logistica", "flota/" + a.id, {}], a);
    server.use(
      http.get(API + "/:id", () =>
        HttpResponse.json({ status: 500, detail: "Lectura ficticia fallida" }, { status: 500 }),
      ),
    );
    fireEvent.click((await screen.findAllByRole("button", { name: "Editar" }))[0]);
    const d = await screen.findByRole("dialog", { name: "Leer ficha de flota" });
    expect(await within(d).findByText("Lectura ficticia fallida")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Patente de chasis")).not.toBeInTheDocument();
  });
  it("dos ediciones concurrentes con la misma revisión dejan una sola nueva versión y evento", async () => {
    const a = await command("", ficha());
    const r = await Promise.all([
      enviar("/" + a.id, { revision: 1, ficha: ficha({ conductor: "Uno" }), motivo: "Uno" }, "PUT"),
      enviar("/" + a.id, { revision: 1, ficha: ficha({ conductor: "Dos" }), motivo: "Dos" }, "PUT"),
    ]);
    expect(r.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await actual(a.id)).revision).toBe(2);
    expect((await get<Pagina<Evento>>("/" + a.id + "/historial")).filas).toHaveLength(2);
  });
  it("ficha HTTP mínima omite opcionales como null y firma monto/CUIT raw antes de normalizar", async () => {
    const minimo = await command("", { patenteChasis: "MINIMO" });
    expect(minimo.ficha).toEqual(ficha({ patenteChasis: "MINIMO" }));
    const key = crypto.randomUUID();
    const raw = ficha({
      importeReferencia: "0001.2300",
      moneda: "ARS",
      vigenteDesde: "2026-10-04",
      cuitConductor: "20-12345678-6",
    });
    expect((await enviar("", raw, "POST", key)).status).toBe(201);
    expect((await enviar("", { ...raw, importeReferencia: "1.23" }, "POST", key)).status).toBe(409);
    expect((await enviar("", { ...raw, cuitConductor: "20123456786" }, "POST", key)).status).toBe(
      409,
    );
  });
  it("acepta cursores revision Int64 no negativos y binding entero, sin comprometer revisiones", async () => {
    const a = await command("", ficha());
    expect((await fetch(API + "?tamano=%2B1")).status).toBe(200);
    expect(
      (await fetch(API + "/" + a.id + "/historial?despuesRevision=9223372036854775807")).status,
    ).toBe(200);
    expect(
      (await fetch(API + "/" + a.id + "/historial?despuesRevision=9223372036854775808")).status,
    ).toBe(400);
    expect(
      (await enviar("/" + a.id + "/baja", { revision: 9007199254740992, motivo: "Desactualizado" }))
        .status,
    ).toBe(409);
    expect((await actual(a.id)).revision).toBe(1);
  });
});

describe("SPEC: opcionales crudos y equivalencia de patentes", () => {
  it("rechaza whitespace-only y controles en cada opcional antes de producir null", async () => {
    mostrar();
    await alta();
    completar();
    const campos = [
      "Patente de acoplado",
      "Conductor",
      "Transportista",
      "CUIT del conductor",
      "CUIT del transportista",
    ];
    for (const campo of campos) {
      for (const valor of [" ", "\u00A0", "\u0085"]) {
        fireEvent.change(screen.getByLabelText(campo), { target: { value: valor } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar ficha" }));
        expect(screen.getByRole("alert")).toHaveTextContent("Completá");
        expect(screen.getByRole("button", { name: "Guardar ficha" })).toBeEnabled();
        expect((await get<Pagina<FichaFlotaDto>>()).filas).toHaveLength(0);
      }
      fireEvent.change(screen.getByLabelText(campo), { target: { value: "" } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Guardar ficha" }));
    expect(await screen.findByText("AA-123 BB")).toBeInTheDocument();
    expect((await get<Pagina<FichaFlotaDto>>()).filas[0].ficha).toEqual(ficha());
  });
  it("rechaza un control junto al importe antes del trim, aun con moneda y fecha válidas", async () => {
    mostrar();
    await alta();
    completar();
    fireEvent.change(screen.getByLabelText("Moneda"), { target: { value: "ARS" } });
    fireEvent.change(screen.getByLabelText("Vigente desde"), { target: { value: "2026-10-04" } });
    fireEvent.change(screen.getByLabelText("Importe de referencia"), {
      target: { value: "0\u0085" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar ficha" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Completá");
    expect(screen.getByRole("button", { name: "Guardar ficha" })).toBeEnabled();
    expect((await get<Pagina<FichaFlotaDto>>()).filas).toHaveLength(0);
  });
  it("ß y SS no colisionan ni en advertencia ni en búsqueda, mientras ASCII conserva case-insensitivity", async () => {
    const a = await command("", ficha({ patenteChasis: "Aß-123" }));
    const b = await command("", ficha({ patenteChasis: "ASS123" }));
    expect(b.patenteChasisRepetida).toBe(false);
    expect((await actual(a.id)).patenteChasisRepetida).toBe(false);
    expect((await get<Pagina<FichaFlotaDto>>("?buscar=A%C3%9F123")).filas.map((f) => f.id)).toEqual(
      [a.id],
    );
    expect((await get<Pagina<FichaFlotaDto>>("?buscar=ass123")).filas.map((f) => f.id)).toEqual([
      b.id,
    ]);
    const c = await command("", ficha({ patenteChasis: "ab-123 cd" }));
    const d = await command("", ficha({ patenteChasis: "AB 123 CD" }));
    expect(d.patenteChasisRepetida).toBe(true);
    expect((await actual(c.id)).patenteChasisRepetida).toBe(true);
  });
});
