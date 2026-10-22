import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { getResponse, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RolNombre } from "@/features/auth/types";
import { env } from "@/lib/env";
import { logisticaHandlers, resetLogisticaDemo } from "@/mocks/handlers/logistica";
import { crearSeguimientosDemo } from "@/mocks/handlers/logistica-seguimientos";
import { erpLogisticaDemo } from "@/mocks/handlers/logistica-conciliacion";
import { hoy, fechaHoraArgentina } from "../format";
import { camposHistorial } from "../lib/historial";
import type { Detalle, Evento, Pagina, Recepcion, Seguimiento } from "../types";
import { CargasPage } from "./cargas-page";

const sesion = vi.hoisted(() => ({ roles: ["logistica-cupos"] as RolNombre[] }));
vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: 10, nombre: "Cupos ficticio", roles: sesion.roles } }),
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
  clave = crypto.randomUUID(),
  auth?: string,
  method = "POST",
) {
  return fetch(`${API}/${ruta}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": clave,
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function post<T>(ruta: string, body: object, method = "POST") {
  const r = await enviar(ruta, body, undefined, undefined, method);
  expect(r.ok).toBe(true);
  return (await r.json()) as T;
}
async function get<T>(ruta: string) {
  const r = await fetch(`${API}/${ruta}`);
  expect(r.ok).toBe(true);
  return (await r.json()) as T;
}
async function actual(id: string) {
  return (await get<Detalle<Seguimiento>>(`seguimientos/${id}`)).dato;
}
async function preparar(n = 1, asignar = true) {
  const r = await post<Recepcion>("cupos/recepciones", {
    contratoVenta: "V-DEMO/1",
    solicitudId: null,
    referencia: "Recepción ficticia C7.2",
    recibidoAl: `${hoy()}T12:00:00Z`,
    filas: Array.from({ length: n }, (_, i) => ({
      ordinal: i + 1,
      fechaCarga: hoy(),
      destinoCodigo: 101,
      codigoTerminal: "DEMO-01",
      circuito: "directa",
      lugarTipo: "planta",
      lugarReferencia: "Planta ficticia",
    })),
  });
  if (asignar)
    await post("otorgamientos", {
      destinatarioTipo: "propio",
      cupos: r.cupos.map((c) => ({ id: c.id, revision: c.revision })),
    });
  return Promise.all(r.cupos.map((c) => actual(c.id)));
}
async function vincular(s: Seguimiento, grupo = 701) {
  return (
    await post<{ seguimiento: Seguimiento }>(
      `cupos/${s.cupoId}/vinculo-erp`,
      {
        revision: s.cupo.revision,
        clave: { contrato: "V-DEMO/1", grupo, cupo: 1 },
        evidencia: "Primer comprobante ficticio",
        confirmado: true,
      },
      "PUT",
    )
  ).seguimiento;
}
const cuerpo = (s: Seguimiento) => ({
  revision: s.cupo.revision,
  vinculoActualId: s.vinculoErpVigente!.id,
  evidencia: "Comprobante ficticio corregido",
  motivo: "Referencia elegida por error",
  confirmado: true,
});
const reemplazo = (s: Seguimiento, grupo = 702) => ({
  ...cuerpo(s),
  claveNueva: { contrato: "V-DEMO/1", grupo, cupo: 1 },
});
const ruta = (s: Seguimiento, modo: string) => `cupos/${s.cupoId}/vinculo-erp/${modo}`;
async function historia(s: Seguimiento, recurso = "seguimientos") {
  return (await get<Pagina<Evento>>(`${recurso}/${s.cupoId}/historial`)).filas;
}
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
            <Link to="/salida">Salir de Cargas</Link>
            <CargasPage />
          </>
        ),
      },
      { path: "/salida", element: <p>Página salida</p> },
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
async function detalle() {
  fireEvent.click((await screen.findAllByRole("button", { name: "Detalle" }))[0]);
  return screen.findByRole("dialog", { name: "Detalle de seguimiento" });
}
async function abrir(modo: "reemplazar" | "retirar") {
  await detalle();
  const nombre = modo === "reemplazar" ? "Reemplazar referencia" : "Retirar referencia";
  fireEvent.click(await screen.findByRole("button", { name: nombre }));
  return screen.findByRole("dialog", { name: nombre });
}
async function completar(modo: "reemplazar" | "retirar") {
  if (modo === "reemplazar")
    fireEvent.click(
      await screen.findByRole("radio", { name: "Seleccionar V-DEMO/1 / grupo 702 / cupo 1" }),
    );
  fireEvent.change(screen.getByLabelText("Evidencia de la corrección"), {
    target: { value: "Comprobante ficticio corregido" },
  });
  fireEvent.change(screen.getByLabelText("Motivo de la corrección"), {
    target: { value: "Referencia elegida por error" },
  });
  fireEvent.click(
    screen.getByLabelText(
      modo === "reemplazar"
        ? "Revisé la referencia completa y los datos de ambas fuentes"
        : "Confirmo retirar esta referencia y conservar el otorgamiento y el viaje",
    ),
  );
}

describe("C7.2 correcciones MSW", () => {
  it("reemplaza A→B y retira conservando operación, pesos y dos historias; luego admite primer vínculo", async () => {
    const [inicial] = await preparar();
    await post(`seguimientos/${inicial.cupoId}/datos-operativos`, {
      revision: inicial.revision,
      tipo: "kg_carga",
      kilogramos: "30000.1234",
      fuente: "balanza",
      observadoAl: `${hoy()}T12:00:00Z`,
      referencia: "Ticket ficticio",
    });
    const a = await vincular(await actual(inicial.cupoId));
    const b = (await post<{ seguimiento: Seguimiento }>(ruta(a, "reemplazar"), reemplazo(a)))
      .seguimiento;
    expect(b.revision).toBe(a.revision + 1);
    expect(b.cupo.revision).toBe(a.cupo.revision + 1);
    expect(b.vinculoErpVigente).toMatchObject({ contrato: "V-DEMO/1", grupo: 702, cupo: 1 });
    expect(b.vinculoErpVigente!.id).not.toBe(a.vinculoErpVigente!.id);
    const lector = vi.spyOn(erpLogisticaDemo, "exacta").mockImplementation(() => {
      throw Error("ERP ficticio caído");
    });
    const retirado = await post<{ seguimiento: Seguimiento; retiradoAl: string }>(
      ruta(b, "retirar"),
      cuerpo(b),
    );
    expect(lector).not.toHaveBeenCalled();
    const c = retirado.seguimiento;
    expect(c.vinculoErpVigente).toBeNull();
    expect(c.cupo).toMatchObject({
      revision: b.cupo.revision + 1,
      tieneVinculoErpVigente: false,
      disponibleParaOtorgar: false,
    });
    expect(c.cupo.otorgamientoVigente).toEqual(a.cupo.otorgamientoVigente);
    expect(c.datosVigentes).toEqual(a.datosVigentes);
    expect(c.estadoObservado).toBe(a.estadoObservado);
    for (const recurso of ["cupos", "seguimientos"]) {
      const eventos = (await historia(c, recurso)).filter((e) =>
        ["vinculo_erp_reemplazado", "vinculo_erp_retirado"].includes(e.tipo),
      );
      expect(eventos).toHaveLength(2);
      const e = eventos.find((e) => e.tipo === "vinculo_erp_reemplazado")!;
      expect(e.motivo).toBe(cuerpo(a).motivo);
      expect(JSON.parse(e.datos)).toMatchObject({
        anterior: {
          id: a.vinculoErpVigente!.id,
          clave: { contrato: "V-DEMO/1", grupo: 701, cupo: 1 },
        },
        nuevo: {
          id: b.vinculoErpVigente!.id,
          clave: { contrato: "V-DEMO/1", grupo: 702, cupo: 1 },
        },
        evidencia: cuerpo(a).evidencia,
        motivo: cuerpo(a).motivo,
        registradoPorId: 1,
      });
      expect(
        JSON.parse(eventos.find((e) => e.tipo === "vinculo_erp_retirado")!.datos),
      ).toMatchObject({ nuevo: null, retiradoAl: retirado.retiradoAl });
    }
    lector.mockRestore();
    expect((await vincular(c)).vinculoErpVigente?.grupo).toBe(701);
  });
  it.each(["reemplazar", "retirar"])(
    "%s mantiene replay original sin ERP tras revisiones posteriores; UUID válido cambiado409 e inválido400",
    async (modo) => {
      const [s] = await preparar();
      const a = await vincular(s),
        body = modo === "reemplazar" ? reemplazo(a) : cuerpo(a),
        key = crypto.randomUUID();
      const r = await enviar(ruta(a, modo), body, key);
      expect(r.ok).toBe(true);
      const original = await r.json();
      await post(`seguimientos/${a.cupoId}/datos-operativos`, {
        revision: original.seguimiento.revision,
        tipo: "kg_carga",
        kilogramos: "1.1234",
        fuente: "balanza",
        observadoAl: `${hoy()}T12:00:00Z`,
        referencia: "Peso posterior",
      });
      const snapshot = await actual(a.cupoId),
        eventos = await historia(a);
      const lector = vi.spyOn(erpLogisticaDemo, "exacta").mockImplementation(() => {
        throw Error("ERP ficticio caído");
      });
      expect(await (await enviar(ruta(a, modo), body, key)).json()).toEqual(original);
      expect(lector).not.toHaveBeenCalled();
      expect(
        (await enviar(ruta(a, modo), { ...body, motivo: "Otro motivo válido" }, key)).status,
      ).toBe(409);
      expect((await enviar(ruta(a, modo), { ...body, confirmado: false }, key)).status).toBe(400);
      expect(await actual(a.cupoId)).toEqual(snapshot);
      expect(await historia(a)).toEqual(eventos);
    },
  );
  it.each(["reemplazar", "retirar"])(
    "%s rechaza estados, revisión o ID obsoletos sin cambiar nada",
    async (modo) => {
      const [s] = await preparar();
      const a = await vincular(s),
        snapshot = await actual(s.cupoId);
      const body = modo === "reemplazar" ? reemplazo(a) : cuerpo(a);
      for (const cambio of [
        { revision: a.cupo.revision - 1 },
        { vinculoActualId: crypto.randomUUID() },
      ]) {
        expect((await enviar(ruta(a, modo), { ...body, ...cambio })).status).toBe(409);
        expect(await actual(a.cupoId)).toEqual(snapshot);
      }
      expect((await enviar(`cupos/${crypto.randomUUID()}/vinculo-erp/${modo}`, body)).status).toBe(
        404,
      );
      await post(`seguimientos/${a.cupoId}/anular`, {
        revision: a.revision,
        motivo: "Anulación ficticia",
      });
      const anulado = await actual(a.cupoId);
      expect(
        (await enviar(ruta(anulado, modo), { ...body, revision: anulado.cupo.revision })).status,
      ).toBe(409);
      expect(await actual(a.cupoId)).toEqual(anulado);
      const [disponible] = await preparar(1, false);
      expect(
        (await enviar(ruta(disponible, modo), { ...body, revision: disponible.cupo.revision }))
          .status,
      ).toBe(409);
    },
  );
  it.each(["reemplazar", "retirar"])(
    "%s valida confirmación, evidencia, motivo y UUID; rechazos preservan filas e historia",
    async (modo) => {
      const [s] = await preparar();
      const a = await vincular(s),
        eventos = await historia(a),
        snapshot = await actual(s.cupoId);
      const body = modo === "reemplazar" ? reemplazo(a) : cuerpo(a);
      for (const cambio of [
        { revision: 0 },
        { revision: 1.5 },
        { vinculoActualId: "00000000-0000-0000-0000-000000000000" },
        { evidencia: " " },
        { motivo: "" },
        { motivo: "x\u0000" },
        { evidencia: "x".repeat(501) },
        { confirmado: false },
      ]) {
        expect((await enviar(ruta(a, modo), { ...body, ...cambio })).status).toBe(400);
      }
      expect(
        (
          await fetch(`${API}/${ruta(a, modo)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        ).status,
      ).toBe(400);
      expect(await actual(a.cupoId)).toEqual(snapshot);
      expect(await historia(a)).toEqual(eventos);
    },
  );
  it.each(["reemplazar", "retirar"])(
    "%s exige permiso Cupos y toma autor del token",
    async (modo) => {
      const [s] = await preparar();
      const a = await vincular(s),
        body = modo === "reemplazar" ? reemplazo(a) : cuerpo(a);
      for (const [token, status] of [
        ["invalido", 401],
        ["mock-access-8", 403],
        ["mock-access-9", 403],
        ["mock-access-11", 403],
      ] as const)
        expect((await enviar(ruta(a, modo), body, undefined, token)).status).toBe(status);
      expect(
        (
          await enviar(
            ruta(a, modo),
            { ...body, registradoPorId: 999 },
            undefined,
            "mock-access-10",
          )
        ).status,
      ).toBe(200);
      expect(
        (await historia(a)).find(
          (e) => e.tipo === `vinculo_erp_${modo === "reemplazar" ? "reemplazado" : "retirado"}`,
        )!.registradoPorId,
      ).toBe(10);
    },
  );
  it("reemplazo rechaza misma clave, ajena, sin cabecera, ocupada, exacta ausente y ERP caído; canonicaliza y permite ceros", async () => {
    const [s, t] = await preparar(2),
      a = await vincular(s);
    await vincular(t, 702);
    const snapshot = await actual(a.cupoId),
      eventos = await historia(a);
    for (const [claveNueva, status] of [
      [{ contrato: "V-DEMO/1", grupo: 701, cupo: 1 }, 409],
      [{ contrato: "V-OTRO/1", grupo: 701, cupo: 1 }, 409],
      [{ contrato: "V-DEMO/1", grupo: 703, cupo: 1 }, 400],
      [{ contrato: "V-DEMO/1", grupo: 702, cupo: 1 }, 409],
      [{ contrato: "V-DEMO/1", grupo: 799, cupo: 1 }, 404],
      [{ contrato: "V-DEMO/1", grupo: -1, cupo: 1 }, 400],
    ] as const)
      expect((await enviar(ruta(a, "reemplazar"), { ...cuerpo(a), claveNueva })).status).toBe(
        status,
      );
    const lector = vi.spyOn(erpLogisticaDemo, "exacta").mockImplementation(() => {
      throw Error("ERP ficticio caído");
    });
    expect((await enviar(ruta(a, "reemplazar"), reemplazo(a))).status).toBe(503);
    expect(await actual(a.cupoId)).toEqual(snapshot);
    expect(await historia(a)).toEqual(eventos);
    lector.mockRestore();
    const r = await post<{ seguimiento: Seguimiento }>(ruta(a, "reemplazar"), {
      ...cuerpo(a),
      claveNueva: { contrato: "v-demo/1 ", grupo: 0, cupo: 0 },
    });
    expect(r.seguimiento.vinculoErpVigente).toMatchObject({
      contrato: "V-DEMO/1",
      grupo: 0,
      cupo: 0,
    });
  });
});

describe("C7.2 UI", () => {
  it("ofrece las correcciones desde GET propio fresco y presenta tabla vigente con ID y tupla", async () => {
    const [s] = await preparar();
    const a = await vincular(s);
    mostrar();
    await detalle();
    expect(
      await screen.findByRole("button", { name: "Reemplazar referencia" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retirar referencia" }));
    const tabla = await screen.findByRole("table", { name: "Referencia vigente a retirar" });
    for (const valor of [a.vinculoErpVigente!.id, "V-DEMO/1", "701", "1"])
      expect(within(tabla).getByText(valor)).toBeInTheDocument();
    expect(screen.getByText(/conserva el otorgamiento y el viaje/)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
  it.each(["logistica-cargas", "logistica-lectura"] as const)(
    "no ofrece correcciones para %s",
    async (rol) => {
      const [s] = await preparar();
      await vincular(s);
      sesion.roles = [rol];
      mostrar();
      await detalle();
      await waitFor(() =>
        expect(screen.queryByText("Consultando seguimiento actualizado…")).not.toBeInTheDocument(),
      );
      expect(
        screen.queryByRole("button", { name: "Reemplazar referencia" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Retirar referencia" })).not.toBeInTheDocument();
    },
  );
  it("cache propio con GET fallido no autoriza corregir; retry exitoso requiere lectura nueva", async () => {
    const [s] = await preparar();
    const a = await vincular(s);
    let fallo = true;
    server.use(
      http.get(`${API}/seguimientos/:id`, ({ request }) =>
        fallo
          ? HttpResponse.json({ detail: "Lectura ficticia fallida" }, { status: 503 })
          : getResponse(logisticaHandlers, request),
      ),
    );
    const { client } = mostrar();
    client.setQueryData(["logistica", `seguimientos/${a.cupoId}`, {}, "con-origen"], {
      dato: a,
      datosAl: new Date().toISOString(),
    });
    await detalle();
    await screen.findByText("Lectura ficticia fallida");
    expect(screen.queryByRole("button", { name: "Reemplazar referencia" })).not.toBeInTheDocument();
    fallo = false;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar detalle" }));
    expect(await screen.findByRole("button", { name: "Retirar referencia" })).toBeInTheDocument();
  });
  it("reemplazo exige elección diferente/manual, evidencia, motivo y confirmación; filtrar/paginar borra elección", async () => {
    const [s] = await preparar();
    await vincular(s);
    let envios = 0;
    const base = erpLogisticaDemo.exacta({ contrato: "V-DEMO/1", grupo: 701, cupo: 1 })!;
    server.use(
      http.get(`${API}/cupos/:id/candidatos-erp`, ({ request }) => {
        const mas = new URL(request.url).searchParams.has("despuesGrupo");
        return HttpResponse.json({
          filas: mas
            ? [{ erp: { ...base, grupo: 704 }, ocupado: false }]
            : [
                { erp: base, ocupado: false },
                { erp: { ...base, grupo: 702 }, ocupado: false },
                { erp: { ...base, grupo: 703, tieneCabecera: false }, ocupado: false },
                { erp: { ...base, grupo: 705 }, ocupado: true },
              ],
          hayMas: !mas,
          datosAl: new Date().toISOString(),
        });
      }),
      http.post(`${API}/cupos/:id/vinculo-erp/reemplazar`, ({ request }) => {
        envios++;
        return getResponse(logisticaHandlers, request);
      }),
    );
    mostrar();
    await abrir("reemplazar");
    expect(
      await screen.findByRole("radio", { name: "Seleccionar V-DEMO/1 / grupo 701 / cupo 1" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("radio", { name: "Seleccionar V-DEMO/1 / grupo 703 / cupo 1" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("radio", { name: "Seleccionar V-DEMO/1 / grupo 705 / cupo 1" }),
    ).toBeDisabled();
    const radio = screen.getByRole("radio", { name: "Seleccionar V-DEMO/1 / grupo 702 / cupo 1" });
    expect(radio).not.toBeChecked();
    fireEvent.click(radio);
    fireEvent.change(screen.getByLabelText("Plan de carga (opcional)"), { target: { value: "0" } });
    expect(radio).not.toBeChecked();
    fireEvent.click(radio);
    fireEvent.click(screen.getByRole("button", { name: "Cargar más filas" }));
    await screen.findByRole("radio", { name: "Seleccionar V-DEMO/1 / grupo 704 / cupo 1" });
    expect(radio).not.toBeChecked();
    fireEvent.click(radio);
    fireEvent.change(screen.getByLabelText("Evidencia de la corrección"), {
      target: { value: "Evidencia válida" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reemplazar referencia" }));
    expect(envios).toBe(0);
    fireEvent.change(screen.getByLabelText("Motivo de la corrección"), {
      target: { value: "x\u0000" },
    });
    fireEvent.click(
      screen.getByLabelText("Revisé la referencia completa y los datos de ambas fuentes"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reemplazar referencia" }));
    expect(envios).toBe(0);
    fireEvent.change(screen.getByLabelText("Motivo de la corrección"), {
      target: { value: "Motivo válido" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reemplazar referencia" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(envios).toBe(1);
    await detalle();
    expect(
      await screen.findByText(/Vínculo vigente: V-DEMO\/1 \/ grupo 702 \/ cupo 1/),
    ).toBeInTheDocument();
  });
  it("retirar no lee ERP, conserva otorgamiento y peso y vuelve a habilitar C7.1", async () => {
    const [s] = await preparar();
    await vincular(s);
    mostrar();
    await abrir("retirar");
    const lector = vi.spyOn(erpLogisticaDemo, "exacta").mockImplementation(() => {
      throw Error("ERP ficticio caído");
    });
    await completar("retirar");
    fireEvent.click(screen.getByRole("button", { name: "Retirar referencia" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(lector).not.toHaveBeenCalled();
    await detalle();
    expect(
      await screen.findByRole("button", { name: "Vincular con MacroGest" }),
    ).toBeInTheDocument();
    expect((await actual(s.cupoId)).cupo.otorgamientoVigente).toEqual(s.cupo.otorgamientoVigente);
  });
  it.each(["reemplazar", "retirar"] as const)(
    "%s acumula red/503→403, congela cuerpo/UUID y protege cierre, Escape, overlay, ruta, Atrás y unload",
    async (modo) => {
      const [s] = await preparar();
      const a = await vincular(s);
      const requests: { body: unknown; key: string | null }[] = [];
      let liberar: (() => void) | undefined;
      server.use(
        http.post(`${API}/cupos/:id/vinculo-erp/${modo}`, async ({ request }) => {
          requests.push({
            body: await request.clone().json(),
            key: request.headers.get("Idempotency-Key"),
          });
          if (requests.length === 1) {
            await new Promise<void>((resolve) => {
              liberar = resolve;
            });
            await getResponse(logisticaHandlers, request);
            return modo === "reemplazar"
              ? HttpResponse.error()
              : HttpResponse.json({ detail: "ERP ficticio caído" }, { status: 503 });
          }
          if (requests.length === 2)
            return HttpResponse.json({ detail: "Permiso ficticio rechazado" }, { status: 403 });
          return getResponse(logisticaHandlers, request);
        }),
      );
      const { router } = mostrar();
      const modal = await abrir(modo);
      await completar(modo);
      fireEvent.click(
        screen.getByRole("button", {
          name: modo === "reemplazar" ? "Reemplazar referencia" : "Retirar referencia",
        }),
      );
      await waitFor(() => expect(liberar).toBeDefined());
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
      fireEvent.keyDown(document, { key: "Escape" });
      expect(modal).toBeInTheDocument();
      liberar!();
      await screen.findByRole("button", { name: "Reintentar operación" });
      fireEvent.click(screen.getByRole("button", { name: "Reintentar operación" }));
      await screen.findByText(/Permiso ficticio rechazado/);
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
      expect(screen.getByLabelText("Evidencia de la corrección")).toBeDisabled();
      expect(screen.getByRole("tab", { name: "Desfasajes" })).toBeDisabled();
      fireEvent.click(modal.parentElement!.querySelector("[aria-hidden]")!);
      fireEvent.keyDown(document, { key: "Escape" });
      fireEvent.click(screen.getByRole("link", { name: "Salir de Cargas" }));
      await act(() => router.navigate(-1));
      expect(router.state.location.pathname).toBe("/logistica/cargas");
      expect(modal).toBeInTheDocument();
      const unload = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(unload);
      expect(unload.defaultPrevented).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Reintentar operación" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(requests).toHaveLength(3);
      expect(requests[1]).toEqual(requests[0]);
      expect(requests[2]).toEqual(requests[0]);
      expect(requests[0].key).toMatch(/^[0-9a-f-]{36}$/);
      expect(requests[0].body).toEqual(modo === "reemplazar" ? reemplazo(a) : cuerpo(a));
      expect(
        (await historia(a)).filter(
          (e) => e.tipo === `vinculo_erp_${modo === "reemplazar" ? "reemplazado" : "retirado"}`,
        ),
      ).toHaveLength(1);
    },
  );
  it.each(["reemplazar", "retirar"] as const)(
    "%s ante409 cierra intento, exige GET fresco y nueva confirmación explícita",
    async (modo) => {
      const [s] = await preparar();
      await vincular(s);
      const keys: string[] = [];
      server.use(
        http.post(`${API}/cupos/:id/vinculo-erp/${modo}`, ({ request }) => {
          keys.push(request.headers.get("Idempotency-Key")!);
          return keys.length === 1
            ? HttpResponse.json({ detail: "Conflicto ficticio" }, { status: 409 })
            : getResponse(logisticaHandlers, request);
        }),
      );
      mostrar();
      await abrir(modo);
      await completar(modo);
      fireEvent.click(
        screen.getByRole("button", {
          name: modo === "reemplazar" ? "Reemplazar referencia" : "Retirar referencia",
        }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.getByText(/Abrí el detalle actualizado/)).toBeInTheDocument();
      await abrir(modo);
      expect(screen.getByLabelText("Evidencia de la corrección")).toHaveValue("");
      await completar(modo);
      fireEvent.click(
        screen.getByRole("button", {
          name: modo === "reemplazar" ? "Reemplazar referencia" : "Retirar referencia",
        }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(keys).toHaveLength(2);
      expect(keys[0]).not.toBe(keys[1]);
    },
  );
});

describe("historia humana C7.2", () => {
  it.each([true, false])(
    "preserva tuplas e ID anterior/nuevo y metadatos sin JSON crudo (nuevo %s)",
    (conNuevo) => {
      const momento = "2026-10-03T12:34:56Z";
      const campos = camposHistorial(
        JSON.stringify({
          cupoId: crypto.randomUUID(),
          seguimientoRevision: 4,
          anterior: {
            id: "anterior-ficticio",
            clave: { contrato: "V-DEMO/1", grupo: 701, cupo: 1 },
          },
          nuevo: conNuevo
            ? { id: "nuevo-ficticio", clave: { contrato: "V-DEMO/1", grupo: 702, cupo: 1 } }
            : null,
          evidencia: "Comprobante ficticio",
          motivo: "Referencia equivocada",
          registradoPorId: 10,
          ...(conNuevo ? { verificadoAl: momento } : { retiradoAl: momento }),
          secreto: "NO-MOSTRAR",
        }),
        "seguimientos",
      );
      expect(campos).toEqual(
        expect.arrayContaining([
          {
            campo: "ID del vínculo",
            anterior: "anterior-ficticio",
            nuevo: conNuevo ? "nuevo-ficticio" : "Sin dato",
          },
          {
            campo: "Referencia MacroGest",
            anterior: "V-DEMO/1 / grupo 701 / cupo 1",
            nuevo: conNuevo ? "V-DEMO/1 / grupo 702 / cupo 1" : "Sin dato",
          },
          { campo: "Evidencia", anterior: "Sin dato", nuevo: "Comprobante ficticio" },
          { campo: "Motivo de corrección", anterior: "Sin dato", nuevo: "Referencia equivocada" },
          { campo: "Autor del registro", anterior: "Sin dato", nuevo: "Usuario 10" },
          {
            campo: conNuevo ? "Verificado al (Argentina)" : "Retirado al (Argentina)",
            anterior: "Sin dato",
            nuevo: fechaHoraArgentina(momento),
          },
        ]),
      );
      expect(JSON.stringify(campos)).not.toContain("NO-MOSTRAR");
    },
  );
});

describe("C7.2 vigencias y elegibilidad", () => {
  it("store canónico cierra historia preservando evidencia y autor originales", async () => {
    const [s] = await preparar();
    const demo = crearSeguimientosDemo({
      cupos: () => [s.cupo],
      conNombre: (c) => c,
      registrar: vi.fn(),
    });
    demo.iniciar(s.cupo, "Recepción ficticia");
    const a = {
      id: crypto.randomUUID(),
      contrato: "V-DEMO/1",
      grupo: 701,
      cupo: 1,
      vigenteDesde: "2026-10-03T10:00:00Z",
      evidencia: "Evidencia original",
      registradoPorId: 7,
    };
    const b = {
      ...a,
      id: crypto.randomUUID(),
      grupo: 702,
      vigenteDesde: "2026-10-03T11:00:00Z",
      evidencia: "Evidencia de reemplazo",
      registradoPorId: 10,
    };
    demo.vincular(s.cupoId, a);
    demo.corregirVinculo(s.cupoId, b, b.vigenteDesde, 10);
    demo.corregirVinculo(s.cupoId, null, "2026-10-03T12:00:00Z", 11);
    expect(demo.historialVinculos(s.cupoId)).toEqual([
      { ...a, vigenteHasta: b.vigenteDesde, retiradoPorId: 10 },
      { ...b, vigenteHasta: "2026-10-03T12:00:00Z", retiradoPorId: 11 },
    ]);
    expect(demo.obtener(s.cupoId)!.cupo.disponibleParaOtorgar).toBe(false);
  });
  it("UUID queda ligado al cupo y operación, y retirar libera referencia para otro cupo", async () => {
    const [s, t] = await preparar(2),
      a = await vincular(s),
      b = await vincular(t, 702),
      key = crypto.randomUUID();
    expect((await enviar(ruta(a, "retirar"), cuerpo(a), key)).status).toBe(200);
    expect((await enviar(ruta(b, "retirar"), cuerpo(b), key)).status).toBe(409);
    expect((await enviar(ruta(b, "reemplazar"), reemplazo(b, 701), key)).status).toBe(200);
    expect((await actual(t.cupoId)).vinculoErpVigente?.grupo).toBe(701);
  });
  it.each(["sin asignación", "anulado", "sin vínculo"])(
    "UI no habilita correcciones para %s",
    async (situacion) => {
      const [s] = await preparar(1, situacion !== "sin asignación");
      if (situacion === "anulado") {
        const a = await vincular(s);
        await post(`seguimientos/${a.cupoId}/anular`, {
          revision: a.revision,
          motivo: "Anulación ficticia",
        });
      }
      mostrar();
      if (situacion === "anulado")
        fireEvent.click(await screen.findByRole("tab", { name: "Anuladas" }));
      await detalle();
      await waitFor(() =>
        expect(screen.queryByText("Consultando seguimiento actualizado…")).not.toBeInTheDocument(),
      );
      expect(
        screen.queryByRole("button", { name: "Reemplazar referencia" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Retirar referencia" })).not.toBeInTheDocument();
    },
  );
  it("retiro valida evidencia, motivo y checkbox antes de emitir comando", async () => {
    const [s] = await preparar();
    await vincular(s);
    let envios = 0;
    server.use(
      http.post(`${API}/cupos/:id/vinculo-erp/retirar`, ({ request }) => {
        envios++;
        return getResponse(logisticaHandlers, request);
      }),
    );
    mostrar();
    await abrir("retirar");
    for (const [evidencia, motivo] of [
      [" ", "Motivo válido"],
      ["Evidencia válida", "x\u0000"],
      ["Evidencia válida", "x".repeat(501)],
      ["Evidencia válida", "Motivo válido"],
    ]) {
      fireEvent.change(screen.getByLabelText("Evidencia de la corrección"), {
        target: { value: evidencia },
      });
      fireEvent.change(screen.getByLabelText("Motivo de la corrección"), {
        target: { value: motivo },
      });
      fireEvent.click(screen.getByRole("button", { name: "Retirar referencia" }));
      expect(envios).toBe(0);
    }
    fireEvent.click(
      screen.getByLabelText(
        "Confirmo retirar esta referencia y conservar el otorgamiento y el viaje",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Retirar referencia" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(envios).toBe(1);
  });
});
