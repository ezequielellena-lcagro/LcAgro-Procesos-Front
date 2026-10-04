import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { getResponse, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RolNombre } from "@/features/auth/types";
import { env } from "@/lib/env";
import { logisticaHandlers, resetLogisticaDemo } from "@/mocks/handlers/logistica";
import { fechaHoraArgentina, hoy, sumarDias } from "../format";
import { erpLogisticaDemo } from "@/mocks/handlers/logistica-conciliacion";
import { incidenciasErp } from "../lib/conciliacion";
import { camposHistorial } from "../lib/historial";
import type {
  ConciliacionFila,
  Detalle,
  Evento,
  OtorgarResultado,
  Pagina,
  Recepcion,
  Seguimiento,
} from "../types";
import { CargasPage } from "./cargas-page";

const sesion = vi.hoisted(() => ({ roles: ["logistica-cupos"] as RolNombre[] }));
vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: 7, nombre: "Operador ficticio", roles: sesion.roles } }),
}));
const API = `${env.apiUrl}/logistica`;
const server = setupServer(...logisticaHandlers);
const routers: ReturnType<typeof createMemoryRouter>[] = [];
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  routers.splice(0).forEach((r) => r.dispose());
  server.resetHandlers();
  vi.restoreAllMocks();
  resetLogisticaDemo();
  sesion.roles = ["logistica-cupos"];
});
afterAll(() => server.close());
async function enviar(
  ruta: string,
  body: object,
  metodo = "POST",
  clave = crypto.randomUUID(),
  auth?: string,
) {
  return fetch(`${API}/${ruta}`, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": clave,
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function post<T>(ruta: string, body: object) {
  const r = await enviar(ruta, body);
  expect(r.ok).toBe(true);
  return (await r.json()) as T;
}
async function get<T>(ruta: string) {
  const r = await fetch(`${API}/${ruta}`);
  expect(r.ok).toBe(true);
  return (await r.json()) as T;
}
async function recibir(n = 1, codigo: string | null = "DEMO-01") {
  return post<Recepcion>("cupos/recepciones", {
    contratoVenta: "V-DEMO/1",
    solicitudId: null,
    referencia: "Recepción ficticia C7",
    recibidoAl: `${hoy()}T12:00:00Z`,
    filas: Array.from({ length: n }, (_, i) => ({
      ordinal: i + 1,
      fechaCarga: hoy(),
      destinoCodigo: 101,
      codigoTerminal: codigo,
      circuito: "directa",
      lugarTipo: "planta",
      lugarReferencia: "Planta ficticia",
    })),
  });
}
async function actual(id: string) {
  return (await get<Detalle<Seguimiento>>(`seguimientos/${id}`)).dato;
}
async function preparar(n = 1, codigo: string | null = "DEMO-01") {
  const r = await recibir(n, codigo);
  await post<OtorgarResultado>("otorgamientos", {
    destinatarioTipo: "propio",
    cupos: r.cupos.map((c) => ({ id: c.id, revision: c.revision })),
  });
  return Promise.all(r.cupos.map((c) => actual(c.id)));
}
const rango = () => `desde=${hoy()}&hastaExclusivo=${sumarDias(hoy(), 1)}`;
const cuerpo = (s: Seguimiento, grupo = 701, cupo = 1) => ({
  revision: s.cupo.revision,
  clave: { contrato: "V-DEMO/1", grupo, cupo },
  evidencia: "Revisión ficticia del comprobante",
  confirmado: true,
});
function mostrar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: "/anterior", element: <p>Página anterior</p> },
      {
        path: "/logistica/cargas",
        element: (
          <>
            <Link to="/salida">Ir a otra página</Link>
            <CargasPage />
          </>
        ),
      },
      { path: "/salida", element: <p>Página de salida</p> },
    ],
    { initialEntries: ["/anterior", "/logistica/cargas"], initialIndex: 1 },
  );
  routers.push(router);
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { client, router };
}
async function abrir() {
  fireEvent.click((await screen.findAllByRole("button", { name: "Detalle" }))[0]);
  await screen.findByRole("dialog", { name: "Detalle de seguimiento" });
  fireEvent.click(await screen.findByRole("button", { name: "Vincular con MacroGest" }));
  return screen.getByRole("dialog", { name: "Vincular con MacroGest" });
}
async function completar() {
  fireEvent.click(
    await screen.findByRole("radio", { name: "Seleccionar V-DEMO/1 / grupo 701 / cupo 1" }),
  );
  fireEvent.change(screen.getByLabelText("Evidencia de la vinculación"), {
    target: { value: "Revisión ficticia del comprobante" },
  });
  fireEvent.click(
    screen.getByLabelText("Revisé la referencia completa y los datos de ambas fuentes"),
  );
}

describe("C7 contratos MSW", () => {
  it("arranca sin operación propia ni conciliación sembrada", async () => {
    expect((await get<Pagina<unknown>>(`conciliacion?${rango()}`)).filas).toEqual([]);
    expect((await get<Pagina<Seguimiento>>(`seguimientos?${rango()}`)).filas).toEqual([]);
  });
  it("candidatos usa contrato propio, código repetido y cursor de clave completa", async () => {
    const [s] = await preparar();
    const ruta = `cupos/${s.cupoId}/candidatos-erp?${rango()}&tamano=1`;
    const p =
      await get<
        Pagina<{ erp: { grupo: number; cupo: number; codigoTerminal: string }; ocupado: boolean }>
      >(ruta);
    expect(p.hayMas).toBe(true);
    expect(p.filas[0].erp.codigoTerminal).toBe("DEMO-01");
    const f = p.filas[0].erp;
    const siguiente = await get<typeof p>(`${ruta}&despuesGrupo=${f.grupo}&despuesCupo=${f.cupo}`);
    expect(siguiente.filas[0].erp).not.toEqual(f);
  });
  it("sin código consulta contrato sin inventar código y permite grupo cero", async () => {
    const [s] = await preparar(1, null);
    const p = await get<Pagina<{ erp: { codigoTerminal: string | null } }>>(
      `cupos/${s.cupoId}/candidatos-erp?${rango()}&porCodigo=true`,
    );
    expect(p.filas.length).toBeGreaterThan(2);
    expect(
      (await get<Pagina<unknown>>(`cupos/${s.cupoId}/candidatos-erp?${rango()}&grupo=0`)).filas,
    ).toHaveLength(1);
  });
  it.each([
    "tamano=0",
    "tamano=201",
    "grupo=-1",
    "despuesGrupo=1",
    "despuesCupo=1",
    "despuesGrupo=1&despuesCupo=1000",
    "porCodigo=otro",
  ])("rechaza filtro candidatos %s", async (filtro) => {
    const [s] = await preparar();
    expect(
      (await fetch(`${API}/cupos/${s.cupoId}/candidatos-erp?${rango()}&${filtro}`)).status,
    ).toBe(400);
  });
  it("rechaza más de 31 días y propio inexistente", async () => {
    const [s] = await preparar();
    expect(
      (
        await fetch(
          `${API}/cupos/${s.cupoId}/candidatos-erp?desde=${hoy()}&hastaExclusivo=${sumarDias(hoy(), 32)}`,
        )
      ).status,
    ).toBe(400);
    expect(
      (await fetch(`${API}/cupos/${crypto.randomUUID()}/candidatos-erp?${rango()}`)).status,
    ).toBe(404);
  });
  it("registra ambas revisiones una vez, audita verificación y replay conserva respuesta original sin nombres", async () => {
    const [s] = await preparar();
    expect(s.revision).not.toBe(s.cupo.revision);
    const clave = crypto.randomUUID(),
      body = cuerpo(s);
    const r = await enviar(`cupos/${s.cupoId}/vinculo-erp`, body, "PUT", clave);
    expect(r.status).toBe(200);
    const original = await r.json();
    expect(original.seguimiento.revision).toBe(s.revision + 1);
    expect(original.seguimiento.cupo.revision).toBe(s.cupo.revision + 1);
    expect(original.seguimiento.cupo.otorgamientoVigente).toEqual(s.cupo.otorgamientoVigente);
    expect(original.seguimiento.cupo.productoNombre).toBeNull();
    expect(original.verificadoAl).toBeTruthy();
    const replay = await enviar(`cupos/${s.cupoId}/vinculo-erp`, body, "PUT", clave);
    expect(await replay.json()).toEqual(original);
    expect(
      (await enviar(`cupos/${s.cupoId}/vinculo-erp`, { ...body, evidencia: "otra" }, "PUT", clave))
        .status,
    ).toBe(409);
    const h = await get<Pagina<Evento>>(`seguimientos/${s.cupoId}/historial`);
    expect(h.filas.filter((e) => e.tipo === "vinculo_erp_registrado")).toHaveLength(1);
    expect(JSON.parse(h.filas.at(-1)!.datos).verificadoAl).toBe(original.verificadoAl);
  });
  it("marca ocupado sólo para otra operación propia y rechaza volver a vincular", async () => {
    const [a, b] = await preparar(2);
    expect((await enviar(`cupos/${a.cupoId}/vinculo-erp`, cuerpo(a), "PUT")).status).toBe(200);
    const p = await get<Pagina<{ ocupado: boolean }>>(
      `cupos/${b.cupoId}/candidatos-erp?${rango()}&grupo=701`,
    );
    expect(p.filas[0].ocupado).toBe(true);
    expect((await enviar(`cupos/${b.cupoId}/vinculo-erp`, cuerpo(b), "PUT")).status).toBe(409);
    expect(
      (await enviar(`cupos/${a.cupoId}/vinculo-erp`, cuerpo(await actual(a.cupoId), 702), "PUT"))
        .status,
    ).toBe(409);
  });
  it.each([
    { confirmado: false },
    { evidencia: " " },
    { evidencia: "x\u0000" },
    { motivoCambio: "reemplazo" },
    { revision: 1 },
  ])("rechaza cuerpo inválido o revisión obsoleta %j", async (extra) => {
    const [s] = await preparar();
    const r = await enviar(`cupos/${s.cupoId}/vinculo-erp`, { ...cuerpo(s), ...extra }, "PUT");
    expect(r.status).toBe("revision" in extra ? 409 : 400);
    expect((await actual(s.cupoId)).vinculoErpVigente).toBeNull();
  });
  it("no vincula sin asignación, sin cabecera, ausente ni contrato diferente", async () => {
    const recibida = await recibir();
    let s = await actual(recibida.cupos[0].id);
    expect((await enviar(`cupos/${s.cupoId}/vinculo-erp`, cuerpo(s), "PUT")).status).toBe(409);
    await post("otorgamientos", {
      destinatarioTipo: "propio",
      cupos: [{ id: s.cupoId, revision: s.cupo.revision }],
    });
    s = await actual(s.cupoId);
    expect((await enviar(`cupos/${s.cupoId}/vinculo-erp`, cuerpo(s, 703), "PUT")).status).toBe(400);
    expect((await enviar(`cupos/${s.cupoId}/vinculo-erp`, cuerpo(s, 999), "PUT")).status).toBe(404);
    expect(
      (
        await enviar(
          `cupos/${s.cupoId}/vinculo-erp`,
          { ...cuerpo(s), clave: { contrato: "V-OTRO/1", grupo: 701, cupo: 1 } },
          "PUT",
        )
      ).status,
    ).toBe(409);
  });
  it("Cargas lee candidatos y conciliación pero sólo Cupos escribe vínculo", async () => {
    const [s] = await preparar();
    expect(
      (
        await fetch(`${API}/conciliacion?${rango()}`, {
          headers: { Authorization: "Bearer mock-access-9" },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await enviar(
          `cupos/${s.cupoId}/vinculo-erp`,
          cuerpo(s),
          "PUT",
          crypto.randomUUID(),
          "mock-access-9",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await enviar(
          `cupos/${s.cupoId}/vinculo-erp`,
          cuerpo(s),
          "PUT",
          crypto.randomUUID(),
          "mock-access-10",
        )
      ).status,
    ).toBe(200);
  });
});

describe("C7 pantalla tabular", () => {
  it("exige selección explícita con códigos repetidos y permite ampliar otros del mismo contrato", async () => {
    await preparar();
    mostrar();
    const modal = await abrir();
    expect(within(modal).getAllByRole("table").length).toBeGreaterThan(1);
    const radios = await within(modal).findAllByRole("radio");
    expect(radios.length).toBe(2);
    expect(radios.every((r) => !(r as HTMLInputElement).checked)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Vincular referencia" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Completá");
    fireEvent.click(screen.getByLabelText("Ampliar a otros códigos del mismo contrato"));
    expect((await within(modal).findAllByRole("radio")).length).toBeGreaterThanOrEqual(2);
    await waitFor(() => expect(within(modal).getAllByRole("radio").length).toBeGreaterThan(2));
  });
  it("congela revisión del cupo, evidencia y selección en incertidumbre acumulada 503 → 403 → replay con mismo UUID", async () => {
    const [s] = await preparar();
    const intentos: { body: unknown; key: string | null }[] = [];
    server.use(
      http.put(`${API}/cupos/:id/vinculo-erp`, async ({ request }) => {
        intentos.push({
          body: await request.clone().json(),
          key: request.headers.get("Idempotency-Key"),
        });
        if (intentos.length === 1) {
          const confirmada = await getResponse(logisticaHandlers, request.clone());
          expect(confirmada?.status).toBe(200);
          vi.spyOn(erpLogisticaDemo, "exacta").mockImplementation(() => {
            throw new Error("ERP ficticio caído después de confirmar");
          });
          return HttpResponse.json({ detail: "Fallo ficticio" }, { status: 503 });
        }
        if (intentos.length === 2)
          return HttpResponse.json({ detail: "Fallo ficticio" }, { status: 403 });
        return getResponse(logisticaHandlers, request);
      }),
    );
    const { router } = mostrar();
    await abrir();
    await completar();
    fireEvent.click(screen.getByRole("button", { name: "Vincular referencia" }));
    await screen.findByRole("button", { name: "Reintentar operación" });
    expect(screen.getByLabelText("Evidencia de la vinculación")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByRole("dialog", { name: "Vincular con MacroGest" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Ir a otra página" }));
    expect(router.state.location.pathname).toBe("/logistica/cargas");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar operación" }));
    await waitFor(() => expect(intentos).toHaveLength(2));
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar operación" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Vincular con MacroGest" }),
      ).not.toBeInTheDocument(),
    );
    expect(intentos).toHaveLength(3);
    expect(intentos[0].body).toEqual(cuerpo(s));
    expect(intentos[1]).toEqual(intentos[0]);
    expect(intentos[2]).toEqual(intentos[0]);
  });
  it.each([400, 403])("un rechazo inicial %s permite cerrar", async (status) => {
    await preparar();
    server.use(
      http.put(`${API}/cupos/:id/vinculo-erp`, () =>
        HttpResponse.json({ detail: "Rechazo ficticio" }, { status }),
      ),
    );
    mostrar();
    await abrir();
    await completar();
    fireEvent.click(screen.getByRole("button", { name: "Vincular referencia" }));
    await screen.findByText("Rechazo ficticio");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("409 cierra editor y exige nueva lectura exitosa propia", async () => {
    await preparar();
    server.use(
      http.put(`${API}/cupos/:id/vinculo-erp`, () =>
        HttpResponse.json({ detail: "Cambió" }, { status: 409 }),
      ),
    );
    mostrar();
    await abrir();
    await completar();
    fireEvent.click(screen.getByRole("button", { name: "Vincular referencia" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("detalle actualizado");
  });
  it("Cargas sin Cupos no muestra vínculo y Cupos sin Cargas no muestra edición física", async () => {
    await preparar();
    mostrar();
    fireEvent.click(await screen.findByRole("button", { name: "Detalle" }));
    await screen.findByRole("button", { name: "Vincular con MacroGest" });
    expect(
      screen.queryByRole("button", { name: "Registrar peso de carga" }),
    ).not.toBeInTheDocument();
  });
  it("Desfasajes consulta página20 propia, conserva sin diferencias y hora por página", async () => {
    const [s] = await preparar();
    const llamadas: URL[] = [];
    server.use(
      http.get(`${API}/conciliacion`, ({ request }) => {
        const url = new URL(request.url);
        llamadas.push(url);
        const segunda = url.searchParams.has("despuesId");
        return HttpResponse.json({
          filas: [
            {
              seguimiento: {
                ...s,
                cupoId: segunda ? "22222222-2222-4222-8222-222222222222" : s.cupoId,
              },
              estadoConsulta: "verificado",
              erp: null,
              incidencias: [],
            },
          ],
          hayMas: !segunda,
          datosAl: segunda ? "2026-10-03T13:00:00Z" : "2026-10-03T12:00:00Z",
        });
      }),
    );
    mostrar();
    fireEvent.click(await screen.findByRole("tab", { name: "Desfasajes" }));
    await screen.findByText("Sin diferencias detectadas");
    expect(llamadas[0].searchParams.get("tamano")).toBe("20");
    expect(llamadas[0].searchParams.get("anulados")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Cargar más filas" }));
    await screen.findByText(fechaHoraArgentina("2026-10-03T13:00:00Z"));
    expect(screen.getByText(fechaHoraArgentina("2026-10-03T12:00:00Z"))).toBeInTheDocument();
    expect(screen.getAllByText("Sin diferencias detectadas")).toHaveLength(2);
  });
  it("historia presenta clave completa, evidencia, autor y fecha verificada sin UUID crudo", () => {
    const campos = camposHistorial(
      JSON.stringify({
        clave: { contrato: "V-DEMO/1", grupo: 701, cupo: 1 },
        evidencia: "Ticket_FICTICIO/1",
        registradoPorId: 7,
        verificadoAl: "2026-10-03T12:00:00Z",
        vinculoId: crypto.randomUUID(),
      }),
      "seguimientos",
    );
    expect(campos.find((c) => c.campo === "Referencia MacroGest")?.nuevo).toBe(
      "V-DEMO/1 / grupo 701 / cupo 1",
    );
    expect(campos.find((c) => c.campo === "Verificado al (Argentina)")?.nuevo).toBe(
      fechaHoraArgentina("2026-10-03T12:00:00Z"),
    );
    expect(campos.map((c) => c.nuevo)).toContain("Ticket_FICTICIO/1");
    expect(campos.some((c) => /[a-f0-9]{8}-/.test(c.nuevo))).toBe(false);
  });
});

describe("C7 garantías adicionales", () => {
  it("replay confirmado no consulta ERP caído y guarda clave canónica devuelta", async () => {
    const [s] = await preparar();
    const key = crypto.randomUUID();
    const body = { ...cuerpo(s), clave: { contrato: "v-demo/1", grupo: 701, cupo: 1 } };
    const r = await enviar(`cupos/${s.cupoId}/vinculo-erp`, body, "PUT", key);
    expect(r.status).toBe(200);
    const original = await r.json();
    expect(original.seguimiento.vinculoErpVigente.contrato).toBe("V-DEMO/1");
    const lector = vi.spyOn(erpLogisticaDemo, "exacta").mockImplementation(() => {
      throw new Error("ERP ficticio caído");
    });
    expect(await (await enviar(`cupos/${s.cupoId}/vinculo-erp`, body, "PUT", key)).json()).toEqual(
      original,
    );
    expect(lector).not.toHaveBeenCalled();
  });
  it("503 exacta y 404 no cambian revisiones ni escriben evento", async () => {
    const [s] = await preparar();
    const lector = vi.spyOn(erpLogisticaDemo, "exacta").mockImplementation(() => {
      throw new Error("ERP ficticio caído");
    });
    expect((await enviar(`cupos/${s.cupoId}/vinculo-erp`, cuerpo(s), "PUT")).status).toBe(503);
    lector.mockReturnValue(null);
    expect((await enviar(`cupos/${s.cupoId}/vinculo-erp`, cuerpo(s), "PUT")).status).toBe(404);
    expect(await actual(s.cupoId)).toEqual(s);
    expect(
      (await get<Pagina<Evento>>(`seguimientos/${s.cupoId}/historial`)).filas.some(
        (e) => e.tipo === "vinculo_erp_registrado",
      ),
    ).toBe(false);
  });
  it("header obligatorio y seguimiento anulado no se vincula", async () => {
    const [s] = await preparar();
    expect(
      (
        await fetch(`${API}/cupos/${s.cupoId}/vinculo-erp`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cuerpo(s)),
        })
      ).status,
    ).toBe(400);
    await post(`seguimientos/${s.cupoId}/anular`, {
      revision: s.revision,
      motivo: "Prueba ficticia",
    });
    expect(
      (await enviar(`cupos/${s.cupoId}/vinculo-erp`, cuerpo(await actual(s.cupoId)), "PUT")).status,
    ).toBe(409);
  });
  it("grupo0 y cupo0 son claves válidas sin cambiar asignación propia", async () => {
    const [s] = await preparar(1, null);
    const r = await enviar(`cupos/${s.cupoId}/vinculo-erp`, cuerpo(s, 0, 0), "PUT");
    expect(r.status).toBe(200);
    expect((await actual(s.cupoId)).vinculoErpVigente).toMatchObject({ grupo: 0, cupo: 0 });
    expect((await actual(s.cupoId)).cupo.otorgamientoVigente).toEqual(s.cupo.otorgamientoVigente);
  });
  it("diagnóstico conserva página propia/cursor completo aun sin diferencias", async () => {
    const [a, b] = await preparar(2);
    await enviar(`cupos/${a.cupoId}/vinculo-erp`, cuerpo(a), "PUT");
    const p = await get<Pagina<ConciliacionFila>>(`conciliacion?${rango()}&tamano=1`);
    expect(p.filas).toHaveLength(1);
    expect(p.hayMas).toBe(true);
    const s = p.filas[0].seguimiento;
    const segunda = await get<Pagina<ConciliacionFila>>(
      `conciliacion?${rango()}&tamano=1&despuesFecha=${s.cupo.fechaCarga}&despuesId=${s.cupoId}`,
    );
    expect(segunda.filas).toHaveLength(1);
    expect(segunda.hayMas).toBe(false);
    expect(new Set([p.filas[0].seguimiento.cupoId, segunda.filas[0].seguimiento.cupoId])).toEqual(
      new Set([a.cupoId, b.cupoId]),
    );
    const vinculada = [...p.filas, ...segunda.filas].find(
      (f) => f.seguimiento.cupoId === a.cupoId,
    )!;
    expect(vinculada.estadoConsulta).toBe("verificado");
    expect(vinculada.incidencias).toEqual([]);
    expect((await fetch(`${API}/conciliacion?${rango()}&despuesId=${s.cupoId}`)).status).toBe(400);
  });
  it("ERP caído, exacta ausente y sin vínculo se distinguen sin perder filas", async () => {
    const [a, b] = await preparar(2);
    await enviar(`cupos/${a.cupoId}/vinculo-erp`, cuerpo(a), "PUT");
    const lector = vi.spyOn(erpLogisticaDemo, "lote").mockImplementation(() => {
      throw new Error("ERP ficticio caído");
    });
    let p = await get<Pagina<ConciliacionFila>>(`conciliacion?${rango()}`);
    expect(p.filas).toHaveLength(2);
    expect(p.filas.find((f) => f.seguimiento.cupoId === a.cupoId)).toMatchObject({
      estadoConsulta: "no_disponible",
      erp: null,
      incidencias: ["erp_no_disponible"],
    });
    expect(p.filas.find((f) => f.seguimiento.cupoId === b.cupoId)).toMatchObject({
      estadoConsulta: "sin_vinculo",
      incidencias: ["vinculo_pendiente"],
    });
    lector.mockReturnValue([]);
    p = await get<Pagina<ConciliacionFila>>(`conciliacion?${rango()}`);
    expect(p.filas.find((f) => f.seguimiento.cupoId === a.cupoId)).toMatchObject({
      estadoConsulta: "no_encontrado",
      erp: null,
      incidencias: ["referencia_no_encontrada"],
    });
    expect((await actual(a.cupoId)).vinculoErpVigente).not.toBeNull();
  });
  it("documentos independientes, presencia whitespace, igualdad decimal exacta y null ≠ cero", async () => {
    const [s] = await preparar();
    const erp = erpLogisticaDemo.exacta({ contrato: "V-DEMO/1", grupo: 701, cupo: 1 })!;
    expect(incidenciasErp(s, { ...erp, tieneCartaPorte: false, tieneDescarga: false })).toEqual([
      "cp_pendiente",
    ]);
    expect(incidenciasErp(s, { ...erp, tieneDescarga: false })).toEqual(["descarga_pendiente"]);
    await post(`seguimientos/${s.cupoId}/datos-operativos`, {
      revision: s.revision,
      tipo: "kg_carga",
      kilogramos: "30000.0000",
      fuente: "balanza",
      observadoAl: `${hoy()}T12:00:00Z`,
      referencia: "Ticket ficticio",
    });
    const conPeso = await actual(s.cupoId);
    expect(incidenciasErp(conPeso, erp)).toEqual([]);
    expect(incidenciasErp(conPeso, { ...erp, kgCargaErp: null })).toEqual([]);
    expect(incidenciasErp(conPeso, { ...erp, kgCargaErp: "0" })).toContain("kg_carga_diferente");
    expect(
      incidenciasErp(conPeso, { ...erp, kgCargaErp: "30000.00000000000000000000000001" }),
    ).toContain("kg_carga_diferente");
    expect(incidenciasErp(s, { ...erp, codigoTerminal: "  " })).not.toContain("codigo_diferente");
    expect(incidenciasErp(s, { ...erp, codigoTerminal: "DEMO-01 " })).toContain("codigo_diferente");
  });
  it("los rechazos de candidatos 404/503 conservan operación y permiten reintentar lectura", async () => {
    await preparar();
    let status = 503;
    server.use(
      http.get(`${API}/cupos/:id/candidatos-erp`, () =>
        HttpResponse.json(
          {
            detail:
              status === 503 ? "MacroGest ficticio no disponible" : "Propio ficticio no encontrado",
          },
          { status },
        ),
      ),
    );
    mostrar();
    await abrir();
    await screen.findByText("MacroGest ficticio no disponible");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    status = 404;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("Propio ficticio no encontrado");
    expect(screen.getByRole("table", { name: "Operación propia a vincular" })).toBeInTheDocument();
  });
  it("un único resultado nunca queda elegido; filtro o nueva página borran elección", async () => {
    await preparar();
    const erp = erpLogisticaDemo.exacta({ contrato: "V-DEMO/1", grupo: 701, cupo: 1 })!;
    const llamadas: URL[] = [];
    server.use(
      http.get(`${API}/cupos/:id/candidatos-erp`, ({ request }) => {
        const url = new URL(request.url);
        llamadas.push(url);
        return HttpResponse.json({
          filas: [
            {
              erp: { ...erp, grupo: url.searchParams.has("despuesGrupo") ? 702 : 701 },
              ocupado: false,
            },
          ],
          hayMas: !url.searchParams.has("despuesGrupo"),
          datosAl: new Date().toISOString(),
        });
      }),
    );
    mostrar();
    await abrir();
    const radio = await screen.findByRole("radio");
    expect(radio).not.toBeChecked();
    fireEvent.click(radio);
    expect(radio).toBeChecked();
    fireEvent.change(screen.getByLabelText("Grupo ERP (opcional)"), { target: { value: "0" } });
    expect(radio).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Buscar grupo" }));
    await waitFor(() => expect(llamadas.at(-1)!.searchParams.get("grupo")).toBe("0"));
    fireEvent.click(await screen.findByRole("radio"));
    fireEvent.click(screen.getByRole("button", { name: "Cargar más filas" }));
    await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(2));
    expect(screen.getAllByRole("radio").every((r) => !(r as HTMLInputElement).checked)).toBe(true);
    expect(llamadas.at(-1)!.searchParams.get("despuesCupo")).toBe("1");
  });
  it("referencia ocupada o cabecera pendiente no se puede seleccionar", async () => {
    const [s] = await preparar();
    server.use(
      http.get(`${API}/cupos/:id/candidatos-erp`, () =>
        HttpResponse.json({
          filas: [
            {
              erp: erpLogisticaDemo.exacta({ contrato: "V-DEMO/1", grupo: 701, cupo: 1 }),
              ocupado: true,
            },
            {
              erp: erpLogisticaDemo.exacta({ contrato: "V-DEMO/1", grupo: 703, cupo: 1 }),
              ocupado: false,
            },
          ],
          hayMas: false,
          datosAl: new Date().toISOString(),
        }),
      ),
    );
    mostrar();
    await abrir();
    expect(
      (await screen.findAllByRole("radio")).every((r) => (r as HTMLInputElement).disabled),
    ).toBe(true);
    expect(screen.getByText("Vinculada a otro cupo")).toBeInTheDocument();
    expect(screen.getByText("Requiere cabecera")).toBeInTheDocument();
    expect((await actual(s.cupoId)).vinculoErpVigente).toBeNull();
  });
  it("código pendiente explica búsqueda por contrato sin inventarlo", async () => {
    await preparar(1, null);
    mostrar();
    await abrir();
    await screen.findByText(/Código propio pendiente/);
    expect(
      screen.queryByLabelText("Ampliar a otros códigos del mismo contrato"),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("radio", { name: "Seleccionar V-DEMO/1 / grupo 0 / cupo 0" }),
    ).not.toBeChecked();
  });
  it("Cargas sin Cupos sólo puede editar datos físicos; sin asignación no habilita vínculo", async () => {
    await preparar();
    sesion.roles = ["logistica-cargas"];
    mostrar();
    fireEvent.click(await screen.findByRole("button", { name: "Detalle" }));
    await screen.findByRole("button", { name: "Registrar peso de carga" });
    expect(
      screen.queryByRole("button", { name: "Vincular con MacroGest" }),
    ).not.toBeInTheDocument();
  });
  it("cache propio y GET fallido no habilitan vínculo; nuevo GET exitoso sí", async () => {
    const [s] = await preparar();
    let fallar = true;
    server.use(
      http.get(`${API}/seguimientos/:id`, ({ request }) =>
        fallar
          ? HttpResponse.json({ detail: "Lectura ficticia fallida" }, { status: 503 })
          : getResponse(logisticaHandlers, request),
      ),
    );
    const { client } = mostrar();
    client.setQueryData(["logistica", `seguimientos/${s.cupoId}`, {}, "con-origen"], {
      dato: s,
      datosAl: new Date().toISOString(),
    });
    fireEvent.click(await screen.findByRole("button", { name: "Detalle" }));
    await screen.findByText("Lectura ficticia fallida");
    expect(
      screen.queryByRole("button", { name: "Vincular con MacroGest" }),
    ).not.toBeInTheDocument();
    fallar = false;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar detalle" }));
    await screen.findByRole("button", { name: "Vincular con MacroGest" });
  });
  it("red → 400 acumula incertidumbre, bloquea Atrás/overlay/beforeunload y permite replay manual", async () => {
    await preparar();
    let llamadas = 0;
    server.use(
      http.put(`${API}/cupos/:id/vinculo-erp`, ({ request }) => {
        llamadas++;
        return llamadas === 1
          ? HttpResponse.error()
          : llamadas === 2
            ? HttpResponse.json({ detail: "Rechazo posterior ficticio" }, { status: 400 })
            : getResponse(logisticaHandlers, request);
      }),
    );
    const { router } = mostrar();
    const modal = await abrir();
    await completar();
    fireEvent.click(screen.getByRole("button", { name: "Vincular referencia" }));
    await screen.findByRole("button", { name: "Reintentar operación" });
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    fireEvent.click(modal.parentElement!.querySelector("[aria-hidden]")!);
    expect(modal).toBeInTheDocument();
    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe("/logistica/cargas");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar operación" }));
    await screen.findByText(/Rechazo posterior ficticio/);
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Desfasajes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Aplicar filtros" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar operación" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(llamadas).toBe(3);
  });
  it("A→B→A y cambiar pestaña reinician cursor de conciliación aun volviendo al mismo filtro", async () => {
    const [s] = await preparar();
    const urls: URL[] = [];
    server.use(
      http.get(`${API}/conciliacion`, ({ request }) => {
        const u = new URL(request.url);
        urls.push(u);
        return HttpResponse.json({
          filas: [
            {
              seguimiento: s,
              estadoConsulta: "sin_vinculo",
              erp: null,
              incidencias: ["vinculo_pendiente"],
            },
          ],
          hayMas: !u.searchParams.has("despuesId"),
          datosAl: new Date().toISOString(),
        });
      }),
    );
    mostrar();
    fireEvent.click(await screen.findByRole("tab", { name: "Desfasajes" }));
    await screen.findByText("Vínculo pendiente");
    fireEvent.click(screen.getByRole("button", { name: "Cargar más filas" }));
    await waitFor(() => expect(urls.some((u) => u.searchParams.has("despuesId"))).toBe(true));
    for (const contrato of ["B-FICTICIO", ""]) {
      fireEvent.change(screen.getByLabelText("Contrato"), { target: { value: contrato } });
      fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
      await waitFor(() => expect(urls.at(-1)!.searchParams.get("contrato") ?? "").toBe(contrato));
      expect(urls.at(-1)!.searchParams.has("despuesId")).toBe(false);
    }
    const previas = urls.length;
    fireEvent.click(screen.getByRole("tab", { name: "Período" }));
    fireEvent.click(screen.getByRole("tab", { name: "Desfasajes" }));
    await waitFor(() => expect(urls.length).toBeGreaterThan(previas));
    expect(urls.at(-1)!.searchParams.has("despuesId")).toBe(false);
  });
  it("documentación ERP desconocida no muestra CP pendiente falsa en filas degradadas", async () => {
    const [s] = await preparar();
    server.use(
      http.get(`${API}/conciliacion`, () =>
        HttpResponse.json({
          filas: [
            {
              seguimiento: s,
              estadoConsulta: "no_disponible",
              erp: null,
              incidencias: ["erp_no_disponible"],
            },
          ],
          hayMas: false,
          datosAl: new Date().toISOString(),
        }),
      ),
    );
    mostrar();
    fireEvent.click(await screen.findByRole("tab", { name: "Desfasajes" }));
    await screen.findByText("No verificable: MacroGest no disponible");
    expect(screen.getAllByText("No verificable")).toHaveLength(2);
    expect(screen.queryByText("Carta de Porte pendiente")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver detalle" }));
    await screen.findByRole("dialog", { name: "Detalle de seguimiento" });
  });
});

describe("C7 confirmación y elegibilidad", () => {
  it("requiere evidencia sin controles y checkbox antes de enviar", async () => {
    await preparar();
    let envios = 0;
    server.use(
      http.put(`${API}/cupos/:id/vinculo-erp`, ({ request }) => {
        envios++;
        return getResponse(logisticaHandlers, request);
      }),
    );
    mostrar();
    await abrir();
    fireEvent.click(
      await screen.findByRole("radio", { name: "Seleccionar V-DEMO/1 / grupo 701 / cupo 1" }),
    );
    for (const evidencia of ["  ", "x\u0000", "x".repeat(501), "Referencia válida"]) {
      fireEvent.change(screen.getByLabelText("Evidencia de la vinculación"), {
        target: { value: evidencia },
      });
      fireEvent.click(screen.getByRole("button", { name: "Vincular referencia" }));
      expect(envios).toBe(0);
    }
    fireEvent.click(
      screen.getByLabelText("Revisé la referencia completa y los datos de ambas fuentes"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Vincular referencia" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(envios).toBe(1);
  });
  it.each(["sin asignación", "anulado", "ya vinculado"])(
    "no ofrece primer vínculo para %s",
    async (situacion) => {
      if (situacion === "sin asignación") await recibir();
      else {
        const [s] = await preparar();
        if (situacion === "anulado")
          await post(`seguimientos/${s.cupoId}/anular`, {
            revision: s.revision,
            motivo: "Prueba ficticia",
          });
        else await enviar(`cupos/${s.cupoId}/vinculo-erp`, cuerpo(s), "PUT");
      }
      mostrar();
      if (situacion === "anulado") {
        fireEvent.click(await screen.findByRole("tab", { name: "Anuladas" }));
      }
      fireEvent.click(await screen.findByRole("button", { name: "Detalle" }));
      await screen.findByRole("dialog", { name: "Detalle de seguimiento" });
      await waitFor(() =>
        expect(screen.queryByText("Consultando seguimiento actualizado…")).not.toBeInTheDocument(),
      );
      expect(
        screen.queryByRole("button", { name: "Vincular con MacroGest" }),
      ).not.toBeInTheDocument();
    },
  );
  it("productor del plan no cambia el cliente destinatario propio", async () => {
    const r = await recibir();
    await post("otorgamientos", {
      destinatarioTipo: "cliente",
      clienteNumero: 1,
      cupos: [{ id: r.cupos[0].id, revision: 1 }],
    });
    const s = await actual(r.cupos[0].id);
    const respuesta = await enviar(`cupos/${s.cupoId}/vinculo-erp`, cuerpo(s), "PUT");
    expect(respuesta.status).toBe(200);
    const resultado = await respuesta.json();
    expect(resultado.seguimiento.cupo.otorgamientoVigente).toMatchObject({
      id: s.cupo.otorgamientoVigente!.id,
      clienteNumero: 1,
      clienteNombre: null,
    });
    expect((await actual(s.cupoId)).cupo.otorgamientoVigente!.clienteNombre).toBe(
      "Cliente de prueba uno",
    );
  });
});
