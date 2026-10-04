import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { strFromU8, unzipSync } from "fflate";
import { getResponse, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RolNombre } from "@/features/auth/types";
import { env } from "@/lib/env";
import { logisticaHandlers, resetLogisticaDemo } from "@/mocks/handlers/logistica";
import { logisticaFlotaHandlers, resetFlotaDemo } from "@/mocks/handlers/logistica-flota";
import { excelLogisticaDemo } from "@/mocks/handlers/logistica-excel";
import * as ExcelDemo from "@/mocks/handlers/logistica-excel";
import { hoy, periodoInicial } from "../format";
import { camposHistorial } from "../lib/historial";
import type {
  ConciliacionFila,
  Detalle,
  Evento,
  FichaFlotaDto,
  FichaFlotaRequest,
  FlotaSeguimientoDto,
  Pagina,
  Recepcion,
  Seguimiento,
} from "../types";
import { CargasPage } from "./cargas-page";

const sesion = vi.hoisted(() => ({ roles: ["logistica-cargas"] as RolNombre[] }));
vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: 9, nombre: "Operador ficticio", roles: sesion.roles } }),
}));
const API = `${env.apiUrl}/logistica`;
const handlers = [...logisticaHandlers, ...logisticaFlotaHandlers];
const server = setupServer(...handlers);
const routers: ReturnType<typeof createMemoryRouter>[] = [];
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  routers.splice(0).forEach((r) => r.dispose());
  server.resetHandlers();
  vi.restoreAllMocks();
  resetLogisticaDemo();
  resetFlotaDemo();
  sesion.roles = ["logistica-cargas"];
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
  ruta: string,
  body: object,
  method = "POST",
  key: string = crypto.randomUUID(),
  actor?: number,
) {
  return fetch(`${API}/${ruta}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": key,
      ...(actor ? { Authorization: `Bearer mock-access-${actor}` } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function comando<T>(ruta: string, body: object, method = "POST", actor?: number): Promise<T> {
  const r = await enviar(ruta, body, method, undefined, actor);
  expect(r.ok).toBe(true);
  return r.json();
}
async function get<T>(ruta: string, actor?: number): Promise<T> {
  const r = await fetch(`${API}/${ruta}`, {
    headers: actor ? { Authorization: `Bearer mock-access-${actor}` } : {},
  });
  expect(r.ok).toBe(true);
  return r.json();
}
async function recibir() {
  const r = await comando<Recepcion>("cupos/recepciones", {
    contratoVenta: "V-DEMO/1",
    solicitudId: null,
    referencia: "Recepción ficticia flota",
    recibidoAl: `${hoy()}T12:00:00Z`,
    filas: [
      {
        ordinal: 1,
        fechaCarga: hoy(),
        destinoCodigo: 101,
        codigoTerminal: "FLOTA-01",
        circuito: "directa",
        lugarTipo: "planta",
        lugarReferencia: null,
      },
    ],
  });
  return r.cupos[0].id;
}
const crear = (extra: Partial<FichaFlotaRequest> = {}) =>
  comando<FichaFlotaDto>("flota", ficha(extra));
const actual = async (id: string) => (await get<Detalle<Seguimiento>>(`seguimientos/${id}`)).dato;
const elegirBody = (f: FichaFlotaDto, revision = 1, motivo: string | null = null) => ({
  revision,
  fichaId: f.id,
  versionId: f.versionId,
  motivo,
});
const elegir = (id: string, f: FichaFlotaDto, revision = 1, motivo: string | null = null) =>
  comando<Seguimiento>(`seguimientos/${id}/flota`, elegirBody(f, revision, motivo), "PUT");
const editarFicha = (f: FichaFlotaDto) =>
  comando<FichaFlotaDto>(
    `flota/${f.id}`,
    {
      revision: f.revision,
      ficha: { ...f.ficha, conductor: "Conductor nuevo" },
      motivo: "Cambio ficticio",
    },
    "PUT",
  );
const baja = (f: FichaFlotaDto) =>
  comando<FichaFlotaDto>(`flota/${f.id}/baja`, { revision: f.revision, motivo: "Baja ficticia" });
const historia = (id: string, recurso = "seguimientos") =>
  get<Pagina<Evento>>(`${recurso}/${id}/historial`);
function operativo(f: FichaFlotaDto): FlotaSeguimientoDto {
  return {
    fichaId: f.id,
    versionId: f.versionId,
    revision: f.revision,
    patenteChasis: f.ficha.patenteChasis,
    patenteAcoplado: f.ficha.patenteAcoplado,
    conductor: f.ficha.conductor,
    transportista: f.ficha.transportista,
    importeReferencia: f.ficha.importeReferencia,
    moneda: f.ficha.moneda,
    vigenteDesde: f.ficha.vigenteDesde,
  };
}
function mostrar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60000 }, mutations: { retry: false } },
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
async function detalle() {
  fireEvent.click(await screen.findByRole("button", { name: "Detalle" }));
  const dialog = await screen.findByRole("dialog", { name: "Detalle de seguimiento" });
  await waitFor(() =>
    expect(
      within(dialog).queryByText("Consultando seguimiento actualizado…"),
    ).not.toBeInTheDocument(),
  );
  return dialog;
}
async function abrir(modo = "Elegir camión") {
  await detalle();
  fireEvent.click(screen.getByRole("button", { name: modo }));
  return screen.findByRole("dialog", { name: modo });
}
async function seleccionar(f: FichaFlotaDto) {
  const radio = await screen.findByRole("radio", {
    name: `Elegir ${f.ficha.patenteChasis}, ficha ${f.id}, versión ${f.versionId}`,
  });
  await waitFor(() => expect(radio).toBeEnabled());
  fireEvent.click(radio);
  fireEvent.click(screen.getByLabelText("Revisé el camión y la versión elegida"));
}
async function confirmar(nombre = "Confirmar camión") {
  fireEvent.click(screen.getByRole("button", { name: nombre }));
}
function libro(bytes: Uint8Array) {
  const zip = unzipSync(bytes),
    parser = new DOMParser();
  const strings = [
    ...parser
      .parseFromString(strFromU8(zip["xl/sharedStrings.xml"]), "application/xml")
      .querySelectorAll("si"),
  ].map((s) => s.textContent ?? "");
  const hojas = [1, 2].map((n) =>
    parser.parseFromString(strFromU8(zip[`xl/worksheets/sheet${n}.xml`]), "application/xml"),
  );
  const rows = hojas.map((h) =>
    [...h.querySelectorAll("sheetData row")].map((r) =>
      [...r.querySelectorAll("c")].map((c) => ({
        clave: c.getAttribute("r")!.replace(/[0-9]/g, ""),
        tipo: c.getAttribute("t"),
        valor:
          c.getAttribute("t") === "s"
            ? strings[Number(c.querySelector("v")?.textContent)]
            : (c.textContent ?? ""),
      })),
    ),
  );
  const datos = rows.map(([cabecera, ...resto]) =>
    resto.map((r) =>
      Object.fromEntries(
        cabecera.map((c) => [c.valor, r.find((x) => x.clave === c.clave)?.valor ?? ""]),
      ),
    ),
  );
  return { hojas, rows, datos };
}
const columnasFlota = [
  "Ficha flota ID",
  "Versión flota ID",
  "Revisión flota",
  "Patente chasis elegida",
  "Patente acoplado elegida",
  "Conductor elegido",
  "Transportista elegido",
  "Importe referencia flota",
  "Moneda referencia flota",
  "Vigente desde flota",
];

describe("Flota elegida por seguimiento MSW", () => {
  it.each(["fichaId", "versionId"] as const)(
    "P2 UUID %s rechaza un array de UUID sin efectos",
    async (campo) => {
      const id = await recibir(),
        f = await crear();
      const body = { ...elegirBody(f), [campo]: [campo === "fichaId" ? f.id : f.versionId] };
      const previo = await actual(id),
        h = await historia(id),
        c = await historia(id, "cupos");
      expect((await enviar(`seguimientos/${id}/flota`, body, "PUT")).status).toBe(400);
      expect(await actual(id)).toEqual(previo);
      expect(await historia(id)).toEqual({ ...h, datosAl: expect.any(String) });
      expect(await historia(id, "cupos")).toEqual({ ...c, datosAl: expect.any(String) });
    },
  );
  it.each([{ body: [] }, { body: [{}] }])(
    "P2 cuerpo array $body devuelve400 para selección/retiro sin efectos",
    async ({ body }) => {
      const id = await recibir();
      const previo = await actual(id),
        h = await historia(id),
        c = await historia(id, "cupos");
      expect((await enviar(`seguimientos/${id}/flota`, body, "PUT")).status).toBe(400);
      expect((await enviar(`seguimientos/${id}/flota/retirar`, body)).status).toBe(400);
      expect(await actual(id)).toEqual(previo);
      expect(await historia(id)).toEqual({ ...h, datosAl: expect.any(String) });
      expect(await historia(id, "cupos")).toEqual({ ...c, datosAl: expect.any(String) });
    },
  );
  it.each([
    ["array", [1]],
    ["objeto", { valor: 1 }],
    ["texto", "1"],
    ["booleano", true],
    ["null", null],
    ["cero", 0],
    ["negativo", -1],
    ["fraccionario", 1.5],
    ["no finito serializado null", Number.POSITIVE_INFINITY],
    ["NaN serializado null", Number.NaN],
    ["sobre Int64", 1e20],
    ["2^63", 2 ** 63],
    ["Int64 máximo redondeado por Number", Number(9223372036854775807n)],
  ])("P2 revisión %s devuelve400 sin efectos en ambas operaciones", async (_caso, revision) => {
    const id = await recibir(),
      f = await crear();
    const previo = await actual(id),
      h = await historia(id),
      c = await historia(id, "cupos");
    expect(
      (await enviar(`seguimientos/${id}/flota`, { ...elegirBody(f), revision }, "PUT")).status,
    ).toBe(400);
    expect(
      (await enviar(`seguimientos/${id}/flota/retirar`, { revision, motivo: "Retiro ficticio" }))
        .status,
    ).toBe(400);
    expect(await actual(id)).toEqual(previo);
    expect(await historia(id)).toEqual({ ...h, datosAl: expect.any(String) });
    expect(await historia(id, "cupos")).toEqual({ ...c, datosAl: expect.any(String) });
  });
  it.each([2 ** 53, 2 ** 63 - 1024])(
    "P2 revisión entera dentro Int64 %s es válida estructuralmente y termina409 stale",
    async (revision) => {
      const id = await recibir(),
        f = await crear();
      const previo = await actual(id),
        h = await historia(id),
        c = await historia(id, "cupos");
      expect(
        (await enviar(`seguimientos/${id}/flota`, elegirBody(f, revision), "PUT")).status,
      ).toBe(409);
      expect(
        (await enviar(`seguimientos/${id}/flota/retirar`, { revision, motivo: "Retiro ficticio" }))
          .status,
      ).toBe(409);
      expect(await actual(id)).toEqual(previo);
      expect(await historia(id)).toEqual({ ...h, datosAl: expect.any(String) });
      expect(await historia(id, "cupos")).toEqual({ ...c, datosAl: expect.any(String) });
    },
  );
  it("primera selección rechaza motivo válido no-null y no produce efectos", async () => {
    const id = await recibir(),
      f = await crear();
    const previo = await actual(id),
      h = await historia(id),
      c = await historia(id, "cupos");
    const r = await enviar(`seguimientos/${id}/flota`, elegirBody(f, 1, "Motivo inicial"), "PUT");
    expect(r.status).toBe(400);
    expect(await actual(id)).toEqual(previo);
    expect(await historia(id)).toEqual({ ...h, datosAl: expect.any(String) });
    expect(await historia(id, "cupos")).toEqual({ ...c, datosAl: expect.any(String) });
  });
  it("elegir y retirar conservan pesos, otorgamiento y ERP; C7.1/C7.2 conservan Flota histórica", async () => {
    const id = await recibir(),
      f = await crear();
    await comando("otorgamientos", { destinatarioTipo: "propio", cupos: [{ id, revision: 1 }] });
    await comando(`seguimientos/${id}/datos-operativos`, {
      revision: 1,
      tipo: "kg_carga",
      kilogramos: "1.0001",
      fuente: "balanza",
      observadoAl: `${hoy()}T12:00:00Z`,
      referencia: "Balanza ficticia",
    });
    const s = await actual(id);
    const a = (
      await comando<{ seguimiento: Seguimiento }>(
        `cupos/${id}/vinculo-erp`,
        {
          revision: s.cupo.revision,
          clave: { contrato: "V-DEMO/1", grupo: 701, cupo: 1 },
          evidencia: "Vínculo ficticio",
          confirmado: true,
        },
        "PUT",
      )
    ).seguimiento;
    const elegido = await elegir(id, f, a.revision);
    expect(elegido.datosVigentes).toEqual(a.datosVigentes);
    expect(elegido.cupo.otorgamientoVigente).toEqual(a.cupo.otorgamientoVigente);
    expect(elegido.vinculoErpVigente).toEqual(a.vinculoErpVigente);
    expect(elegido.cupo.disponibleParaOtorgar).toBe(a.cupo.disponibleParaOtorgar);
    const b = (
      await comando<{ seguimiento: Seguimiento }>(`cupos/${id}/vinculo-erp/reemplazar`, {
        revision: elegido.cupo.revision,
        vinculoActualId: elegido.vinculoErpVigente!.id,
        claveNueva: { contrato: "V-DEMO/1", grupo: 702, cupo: 1 },
        evidencia: "Referencia corregida",
        motivo: "Otra referencia",
        confirmado: true,
      })
    ).seguimiento;
    expect(b.flotaVigente).toEqual(operativo(f));
    const c = (
      await comando<{ seguimiento: Seguimiento }>(`cupos/${id}/vinculo-erp/retirar`, {
        revision: b.cupo.revision,
        vinculoActualId: b.vinculoErpVigente!.id,
        evidencia: "Comprobante ficticio",
        motivo: "Retiro de referencia",
        confirmado: true,
      })
    ).seguimiento;
    expect(c.flotaVigente).toEqual(operativo(f));
    const d = await comando<Seguimiento>(`seguimientos/${id}/flota/retirar`, {
      revision: c.revision,
      motivo: "Retiro de camión",
    });
    expect(d.datosVigentes).toEqual(c.datosVigentes);
    expect(d.cupo.otorgamientoVigente).toEqual(c.cupo.otorgamientoVigente);
    expect(d.vinculoErpVigente).toEqual(c.vinculoErpVigente);
    expect(d.cupo.disponibleParaOtorgar).toBe(c.cupo.disponibleParaOtorgar);
    const eventos = (await historia(id, "cupos")).filas.filter(
      (e) => e.tipo === "seguimiento_modificado" && JSON.parse(e.datos).cupoId,
    );
    expect(eventos.map((e) => JSON.parse(e.datos))).toEqual([
      { cupoId: id, seguimientoRevision: elegido.revision },
      { cupoId: id, seguimientoRevision: d.revision },
    ]);
  });
  it("comienza sin referencia y selecciona, reemplaza y retira sin alterar elegibilidad, observaciones, pesos ni ERP", async () => {
    const id = await recibir(),
      f = await crear(),
      g = await crear({ patenteChasis: "CC-456 DD" });
    const inicial = await actual(id);
    expect(inicial.flotaVigente).toBeNull();
    const original = await elegir(id, f);
    expect(original.flotaVigente).toEqual(operativo(f));
    expect(original.revision).toBe(2);
    expect(original.cupo.revision).toBe(2);
    expect(original.cupo.disponibleParaOtorgar).toBe(inicial.cupo.disponibleParaOtorgar);
    expect(original.datosVigentes).toEqual([]);
    expect(original.vinculoErpVigente).toBeNull();
    expect(original.estadoObservado).toBe(inicial.estadoObservado);
    const reemplazo = await elegir(id, g, 2, "Otro camión");
    expect(reemplazo.flotaVigente).toEqual(operativo(g));
    const retirada = await comando<Seguimiento>(`seguimientos/${id}/flota/retirar`, {
      revision: 3,
      motivo: "Sin camión confirmado",
    });
    expect(retirada.flotaVigente).toBeNull();
    expect(retirada.revision).toBe(4);
    expect(retirada.cupo.revision).toBe(4);
    const h = (await historia(id)).filas.filter((e) => e.tipo.startsWith("flota_"));
    expect(h.map((e) => e.tipo)).toEqual([
      "flota_seleccionada",
      "flota_reemplazada",
      "flota_retirada",
    ]);
    expect(h.map((e) => JSON.parse(e.datos))).toEqual([
      { anterior: null, nuevo: operativo(f), motivo: null },
      { anterior: operativo(f), nuevo: operativo(g), motivo: "Otro camión" },
      { anterior: operativo(g), nuevo: null, motivo: "Sin camión confirmado" },
    ]);
    expect(
      (await historia(id, "cupos")).filas.filter((e) => e.tipo === "seguimiento_modificado"),
    ).toHaveLength(3);
  });
  it("selector devuelve activos head antes del límite, búsqueda aplicada, cursor y sólo campos operativos", async () => {
    const a = await crear({
      conductor: "Nombre ficticio",
      cuitConductor: "20329642330",
      importeReferencia: "99999999999999.9999",
      moneda: "USD",
      vigenteDesde: "2026-10-04",
    });
    await crear({
      patenteChasis: "AA 123-BB",
      importeReferencia: "0",
      moneda: "ARS",
      vigenteDesde: "2026-10-04",
    });
    const b = await crear();
    await baja(b);
    const actualizado = await editarFicha(a);
    const primera = await get<Pagina<FlotaSeguimientoDto>>(
      "seguimientos/flota-disponible?tamano=1&buscar=aa123bb",
    );
    expect(primera.filas).toHaveLength(1);
    expect(primera.hayMas).toBe(true);
    expect(primera.datosAl).toBeTruthy();
    const segunda = await get<Pagina<FlotaSeguimientoDto>>(
      `seguimientos/flota-disponible?tamano=1&buscar=aa123bb&despuesId=${primera.filas[0].fichaId.toUpperCase()}`,
    );
    expect(segunda.filas).toHaveLength(1);
    expect(segunda.hayMas).toBe(false);
    const todas = [...primera.filas, ...segunda.filas];
    expect(todas.map((x) => x.importeReferencia).sort()).toEqual(["0", "99999999999999.9999"]);
    expect(todas.find((x) => x.fichaId === a.id)?.versionId).toBe(actualizado.versionId);
    expect(JSON.stringify(todas)).not.toMatch(/cuit/i);
  });
  it.each([
    "tamano=0",
    "tamano=201",
    "tamano=1.5",
    "despuesId=mal",
    "buscar=%20%20",
    "buscar=abc%00",
  ])("rechaza selector inválido %s", async (query) => {
    expect((await fetch(`${API}/seguimientos/flota-disponible?${query}`)).status).toBe(400);
  });
  it.each([
    [8, 200, 403],
    [9, 200, 200],
    [10, 200, 403],
    [12, 403, 403],
  ])("respeta lectura/escritura del operador %s", async (actor, lectura, escritura) => {
    const id = await recibir(),
      f = await crear();
    expect(
      (
        await fetch(`${API}/seguimientos/flota-disponible`, {
          headers: { Authorization: `Bearer mock-access-${actor}` },
        })
      ).status,
    ).toBe(lectura);
    expect(
      (await enviar(`seguimientos/${id}/flota`, elegirBody(f), "PUT", undefined, actor)).status,
    ).toBe(escritura);
  });
  it("Cargas sin Flete puede seleccionar pero no leer ni escribir el ABM; cambiar usuario conserva el padrón", async () => {
    const f = await crear();
    expect(
      (await fetch(`${API}/flota`, { headers: { Authorization: "Bearer mock-access-9" } })).status,
    ).toBe(403);
    expect((await enviar("flota", ficha(), "POST", undefined, 9)).status).toBe(403);
    expect(
      (await get<Pagina<FlotaSeguimientoDto>>("seguimientos/flota-disponible", 9)).filas[0],
    ).toEqual(operativo(f));
  });
  it("conserva la versión histórica después de edición y baja del maestro y cambios del viaje", async () => {
    const id = await recibir(),
      f = await crear({
        conductor: "Conductor elegido",
        transportista: "Empresa ficticia",
        importeReferencia: "0",
        moneda: "ARS",
        vigenteDesde: "2026-10-04",
      });
    await elegir(id, f);
    const nueva = await editarFicha(f);
    await baja(nueva);
    await comando(
      `seguimientos/${id}/estado`,
      {
        revision: 2,
        estadoObservado: "cargando",
        observadoAl: `${hoy()}T12:00:00Z`,
        fuente: "operador",
        referencia: "Llamada ficticia",
      },
      "PUT",
    );
    await comando(`seguimientos/${id}/anular`, { revision: 3, motivo: "Anulación ficticia" });
    expect((await actual(id)).flotaVigente).toEqual(operativo(f));
    expect(
      JSON.parse((await historia(id)).filas.find((e) => e.tipo === "flota_seleccionada")!.datos)
        .nuevo,
    ).toEqual(operativo(f));
  });
  it.each([
    "revision",
    "editada",
    "baja",
    "anulado",
    "otra-ficha",
    "version-ausente",
    "ficha-ausente",
    "seguimiento-ausente",
    "misma-version",
    "retiro-vacio",
  ])("guarda %s no produce efectos", async (caso) => {
    const id = await recibir(),
      f = await crear(),
      g = await crear({ patenteChasis: "GG-111 HH" });
    let body: object = elegirBody(f),
      ruta = `seguimientos/${id}/flota`,
      metodo = "PUT",
      status = 409;
    if (caso === "revision") body = elegirBody(f, 2);
    if (caso === "editada") await editarFicha(f);
    if (caso === "baja") await baja(f);
    if (caso === "anulado")
      await comando(`seguimientos/${id}/anular`, { revision: 1, motivo: "Anulado" });
    if (caso === "otra-ficha") {
      body = { ...elegirBody(f), versionId: g.versionId };
      status = 404;
    }
    if (caso === "version-ausente") {
      body = { ...elegirBody(f), versionId: crypto.randomUUID() };
      status = 404;
    }
    if (caso === "ficha-ausente") {
      body = { ...elegirBody(f), fichaId: crypto.randomUUID() };
      status = 404;
    }
    if (caso === "seguimiento-ausente") {
      ruta = `seguimientos/${crypto.randomUUID()}/flota`;
      status = 404;
    }
    if (caso === "misma-version") {
      await elegir(id, f);
      body = elegirBody(f, 2, "Otra elección");
    }
    if (caso === "retiro-vacio") {
      ruta += "/retirar";
      metodo = "POST";
      body = { revision: 1, motivo: "Retiro" };
    }
    const previo = await actual(id),
      h = await historia(id),
      c = await historia(id, "cupos");
    expect((await enviar(ruta, body, metodo)).status).toBe(status);
    expect(await actual(id)).toEqual(previo);
    expect(await historia(id)).toEqual({ ...h, datosAl: expect.any(String) });
    expect(await historia(id, "cupos")).toEqual({ ...c, datosAl: expect.any(String) });
  });
  it.each([null, "", "   ", "\u0000", "x".repeat(501)])(
    "reemplazo y retiro exigen motivo visible válido %j",
    async (motivo) => {
      const id = await recibir(),
        f = await crear(),
        g = await crear();
      await elegir(id, f);
      const previo = await actual(id);
      expect(
        (await enviar(`seguimientos/${id}/flota`, elegirBody(g, 2, motivo), "PUT")).status,
      ).toBe(400);
      expect(
        (await enviar(`seguimientos/${id}/flota/retirar`, { revision: 2, motivo })).status,
      ).toBe(400);
      expect(await actual(id)).toEqual(previo);
    },
  );
  it.each([
    { revision: 0 },
    { revision: 1.5 },
    { fichaId: "no-guid" },
    { versionId: "00000000-0000-0000-0000-000000000000" },
    { motivo: "   " },
  ])("rechaza cuerpo inválido sin efectos %j", async (extra) => {
    const id = await recibir(),
      f = await crear(),
      previo = await actual(id);
    expect(
      (await enviar(`seguimientos/${id}/flota`, { ...elegirBody(f), ...extra }, "PUT")).status,
    ).toBe(400);
    expect(await actual(id)).toEqual(previo);
  });
  it("normaliza GUID y DTO hash; replay guarda la respuesta original y scope usuario/operación/clave", async () => {
    const id = await recibir(),
      otro = await recibir(),
      f = await crear(),
      body = elegirBody(f),
      key = crypto.randomUUID();
    const r = await enviar(`seguimientos/${id}/flota`, body, "PUT", key, 9);
    expect(r.status).toBe(200);
    const original = await r.json();
    await editarFicha(f);
    const replay = await enviar(
      `seguimientos/${id.toUpperCase()}/flota`,
      {
        motivo: null,
        versionId: f.versionId.toUpperCase(),
        revision: 1,
        fichaId: f.id.toUpperCase(),
        extraIgnorado: "x",
      },
      "PUT",
      key.toUpperCase(),
      9,
    );
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(original);
    expect((await enviar(`seguimientos/${otro}/flota`, body, "PUT", key, 9)).status).toBe(409);
    expect(
      (await enviar(`seguimientos/${id}/flota`, { ...body, motivo: "Cambió" }, "PUT", key, 9))
        .status,
    ).toBe(409);
    const g = await crear();
    expect((await enviar(`seguimientos/${otro}/flota`, elegirBody(g), "PUT", key, 7)).status).toBe(
      200,
    );
    expect(
      (
        await enviar(
          `seguimientos/${id}/flota/retirar`,
          { revision: 2, motivo: "Retiro" },
          "POST",
          key,
          9,
        )
      ).status,
    ).toBe(200);
    expect((await actual(id)).flotaVigente).toBeNull();
    expect((await enviar(`seguimientos/${id}/flota`, body, "PUT", key, 9)).status).toBe(200);
  });
});

describe("Flota elegida en Cargas", () => {
  it("P2 reabrir antes de60s exige GET nuevo y permite seleccionar con caché fresca sin claves ilimitadas", async () => {
    const id = await recibir(),
      f = await crear();
    let lecturas = 0;
    server.use(
      http.get(`${API}/seguimientos/flota-disponible`, async ({ request }) => {
        lecturas++;
        return getResponse(handlers, request);
      }),
    );
    const { client } = mostrar(),
      inicio = Date.now();
    const primera = await abrir();
    await seleccionar(f);
    fireEvent.click(within(primera).getByRole("button", { name: "Cancelar" }));
    const segunda = await abrir();
    await waitFor(() => expect(lecturas).toBe(2));
    expect(Date.now() - inicio).toBeLessThan(60_000);
    expect(
      client.getQueryCache().findAll({ queryKey: ["logistica", "seguimientos/flota-disponible"] }),
    ).toHaveLength(1);
    await seleccionar(f);
    await confirmar();
    await waitFor(() => expect(segunda).not.toBeInTheDocument());
    expect((await actual(id)).flotaVigente).toEqual(operativo(f));
  });
  it("P2 head nuevo al reabrir se consulta sin cambiar el snapshot elegido en el modal abierto", async () => {
    const id = await recibir(),
      f = await crear();
    let lecturas = 0;
    server.use(
      http.get(`${API}/seguimientos/flota-disponible`, async ({ request }) => {
        lecturas++;
        return getResponse(handlers, request);
      }),
    );
    const { client } = mostrar();
    const primera = await abrir();
    await seleccionar(f);
    const nuevo = await editarFicha(f);
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["logistica", "seguimientos/flota-disponible"] });
    });
    const review = within(primera).getByRole("table", { name: "Camión a confirmar" });
    expect(review).toHaveTextContent(f.versionId);
    expect(review).not.toHaveTextContent(nuevo.versionId);
    fireEvent.click(within(primera).getByRole("button", { name: "Cancelar" }));
    const segunda = await abrir();
    await waitFor(() => expect(lecturas).toBe(3));
    expect(
      within(segunda).queryByRole("table", { name: "Camión a confirmar" }),
    ).not.toBeInTheDocument();
    await seleccionar(nuevo);
    await confirmar();
    await waitFor(() => expect(segunda).not.toBeInTheDocument());
    expect((await actual(id)).flotaVigente).toEqual(operativo(nuevo));
  });
  it.each([null, "0"])(
    "tabla del camión conserva referencia %j y campos desconocidos",
    async (importe) => {
      await recibir();
      const f = await crear(
        importe === null
          ? {}
          : { importeReferencia: importe, moneda: "ARS", vigenteDesde: "2026-10-04" },
      );
      mostrar();
      const modal = await abrir();
      await seleccionar(f);
      const tabla = within(modal).getByRole("table", { name: "Camión a confirmar" });
      expect(
        within(tabla).getByRole("cell", {
          name: importe === null ? "Sin referencia" : "0",
        }),
      ).toBeInTheDocument();
      expect(
        within(tabla).getAllByRole("cell", { name: "Sin dato" }).length,
      ).toBeGreaterThanOrEqual(3);
      expect(within(modal).queryByLabelText("Motivo del reemplazo")).not.toBeInTheDocument();
    },
  );
  it("selección manual muestra tabla, revisión/version exactas y confirma motivo null sin CUIT", async () => {
    const id = await recibir(),
      f = await crear({
        importeReferencia: "99999999999999.9999",
        moneda: "USD",
        vigenteDesde: "2026-10-04",
        cuitConductor: "20329642330",
      });
    const bodies: unknown[] = [];
    server.use(
      http.put(`${API}/seguimientos/:id/flota`, async ({ request }) => {
        bodies.push(await request.clone().json());
        return getResponse(handlers, request);
      }),
    );
    mostrar();
    const modal = await abrir();
    await seleccionar(f);
    expect(within(modal).getByRole("table", { name: "Camión a confirmar" })).toHaveTextContent(
      f.versionId,
    );
    expect(within(modal).getByRole("table", { name: "Camión a confirmar" })).toHaveTextContent(
      "99.999.999.999.999,9999",
    );
    expect(within(modal).queryByText("20329642330")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aplicar filtros" })).toBeDisabled();
    await confirmar();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Elegir camión" })).not.toBeInTheDocument(),
    );
    expect(bodies).toEqual([elegirBody(f)]);
    expect((await actual(id)).flotaVigente).toEqual(operativo(f));
    const det = await detalle();
    expect(within(det).getByRole("table", { name: "Camión elegido" })).toHaveTextContent(
      f.versionId,
    );
    expect(within(det).getByRole("button", { name: "Reemplazar camión" })).toBeEnabled();
    expect(within(det).getByRole("button", { name: "Retirar camión" })).toBeEnabled();
  });
  it("búsqueda se aplica al enviar y paginación usa fichaId; patentes duplicadas tienen radios diferentes", async () => {
    await recibir();
    const a = await crear(),
      b = await crear();
    const urls: URL[] = [];
    server.use(
      http.get(`${API}/seguimientos/flota-disponible`, ({ request }) => {
        const u = new URL(request.url);
        urls.push(u);
        const buscar = u.searchParams.get("buscar"),
          cursor = u.searchParams.get("despuesId");
        return HttpResponse.json({
          filas: buscar ? [operativo(b)] : [operativo(cursor ? b : a)],
          hayMas: !buscar && !cursor,
          datosAl: "2026-10-04T12:00:00Z",
        });
      }),
    );
    mostrar();
    const modal = await abrir();
    await screen.findByRole("radio");
    const input = within(modal).getByLabelText("Buscar camión");
    fireEvent.change(input, { target: { value: "Conductor" } });
    expect(urls).toHaveLength(1);
    fireEvent.click(within(modal).getByRole("button", { name: "Cargar más filas" }));
    await screen.findByRole("radio", {
      name: `Elegir ${b.ficha.patenteChasis}, ficha ${b.id}, versión ${b.versionId}`,
    });
    expect(within(modal).getAllByRole("radio")).toHaveLength(2);
    expect(urls[1].searchParams.get("despuesId")).toBe(a.id);
    expect(urls[1].searchParams.get("tamano")).toBe("50");
    fireEvent.click(within(modal).getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get("buscar")).toBe("Conductor"));
    expect(within(modal).getByRole("table", { name: "Camiones disponibles" })).toHaveTextContent(
      "Consultado al",
    );
  });
  it("distingue padrón vacío de error y permite reintentar sin habilitar datos viejos", async () => {
    await recibir();
    let falla = true;
    server.use(
      http.get(`${API}/seguimientos/flota-disponible`, () =>
        falla
          ? HttpResponse.json(
              { detail: "No se pudo consultar el padrón", status: 503 },
              { status: 503 },
            )
          : HttpResponse.json({ filas: [], hayMas: false, datosAl: new Date().toISOString() }),
      ),
    );
    mostrar();
    const modal = await abrir();
    await within(modal).findByText("No se pudo consultar el padrón");
    expect(
      within(modal).queryByText("No hay camiones activos para esta búsqueda."),
    ).not.toBeInTheDocument();
    falla = false;
    fireEvent.click(within(modal).getByRole("button", { name: "Reintentar" }));
    await within(modal).findByText("No hay camiones activos para esta búsqueda.");
    await confirmar();
    expect(within(modal).getByRole("alert")).toHaveTextContent("Completá");
  });
  it.each(["editar", "baja", "revision", "anular"])(
    "cambio %s entre elección y confirmación termina 409 sin rebase",
    async (cambio) => {
      const id = await recibir(),
        f = await crear();
      const bodies: unknown[] = [];
      server.use(
        http.put(`${API}/seguimientos/:id/flota`, async ({ request }) => {
          bodies.push(await request.clone().json());
          return getResponse(handlers, request);
        }),
      );
      const { client } = mostrar();
      const modal = await abrir();
      await seleccionar(f);
      if (cambio === "editar") {
        await editarFicha(f);
        await act(async () => {
          await client.invalidateQueries({
            queryKey: ["logistica", "seguimientos/flota-disponible"],
          });
        });
      }
      if (cambio === "baja") await baja(f);
      if (cambio === "revision")
        await comando(
          `seguimientos/${id}/estado`,
          {
            revision: 1,
            estadoObservado: "cargando",
            observadoAl: `${hoy()}T12:00:00Z`,
            fuente: "operador",
            referencia: "Cambio",
          },
          "PUT",
        );
      if (cambio === "anular")
        await comando(`seguimientos/${id}/anular`, { revision: 1, motivo: "Anulación" });
      expect(within(modal).getByRole("table", { name: "Camión a confirmar" })).toHaveTextContent(
        f.versionId,
      );
      await confirmar();
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Elegir camión" })).not.toBeInTheDocument(),
      );
      expect(bodies).toEqual([elegirBody(f)]);
      expect((await actual(id)).flotaVigente).toBeNull();
      expect(screen.getByRole("status")).toHaveTextContent("nuevo intento explícito");
    },
  );
  it("reenvía cuerpo/UUID inmutables tras commit incierto y acumula bloqueo hasta éxito/409", async () => {
    const id = await recibir(),
      f = await crear();
    const intentos: { key: string | null; body: unknown }[] = [];
    server.use(
      http.put(`${API}/seguimientos/:id/flota`, async ({ request }) => {
        intentos.push({
          key: request.headers.get("Idempotency-Key"),
          body: await request.clone().json(),
        });
        if (intentos.length === 1) {
          const r = await getResponse(handlers, request);
          expect(r!.status).toBe(200);
          return HttpResponse.error();
        }
        if (intentos.length === 2)
          return HttpResponse.json(
            { detail: "Reintento no confirmado", status: 400 },
            { status: 400 },
          );
        return getResponse(handlers, request);
      }),
    );
    const { router } = mostrar();
    const modal = await abrir();
    await seleccionar(f);
    await confirmar();
    await within(modal).findByRole("button", { name: "Reintentar operación" });
    expect(within(modal).getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(within(modal).getByRole("checkbox")).toBeDisabled();
    fireEvent.click(screen.getByRole("link", { name: "Ir a otra página" }));
    await act(async () => {
      await router.navigate(-1);
    });
    expect(router.state.location.pathname).toBe("/logistica/cargas");
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    fireEvent.click(within(modal).getByRole("button", { name: "Reintentar operación" }));
    await within(modal).findByText(/Reintento no confirmado/);
    expect(within(modal).getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent.click(within(modal).getByRole("button", { name: "Reintentar operación" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Elegir camión" })).not.toBeInTheDocument(),
    );
    expect(intentos).toHaveLength(3);
    expect(
      intentos.every(
        (x) =>
          x.key === intentos[0].key && JSON.stringify(x.body) === JSON.stringify(intentos[0].body),
      ),
    ).toBe(true);
    expect((await actual(id)).revision).toBe(2);
    expect((await historia(id)).filas.filter((e) => e.tipo === "flota_seleccionada")).toHaveLength(
      1,
    );
  });
  it("reemplaza con motivo y evita elegir la misma versión; retiro tiene su diálogo sin selector", async () => {
    const id = await recibir(),
      f = await crear({ importeReferencia: "0", moneda: "ARS", vigenteDesde: "2026-10-04" }),
      g = await crear();
    await elegir(id, f);
    mostrar();
    const modal = await abrir("Reemplazar camión");
    const radio = await screen.findByRole("radio", {
      name: `Elegir ${f.ficha.patenteChasis}, ficha ${f.id}, versión ${f.versionId}`,
    });
    expect(radio).toBeDisabled();
    await seleccionar(g);
    await confirmar("Reemplazar camión");
    expect(within(modal).getByRole("alert")).toHaveTextContent("Completá");
    fireEvent.change(within(modal).getByLabelText("Motivo del reemplazo"), {
      target: { value: "Otro camión confirmado" },
    });
    await confirmar("Reemplazar camión");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Reemplazar camión" })).not.toBeInTheDocument(),
    );
    expect((await actual(id)).flotaVigente).toEqual(operativo(g));
    const retiro = await abrir("Retirar camión");
    expect(within(retiro).queryByRole("radio")).not.toBeInTheDocument();
    fireEvent.change(within(retiro).getByLabelText("Motivo del retiro"), {
      target: { value: "Cancelación del camión" },
    });
    fireEvent.click(within(retiro).getByLabelText("Confirmo el retiro del camión elegido"));
    await confirmar("Retirar camión");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Retirar camión" })).not.toBeInTheDocument(),
    );
    expect((await actual(id)).flotaVigente).toBeNull();
    expect(await screen.findByText("Sin camión elegido")).toBeInTheDocument();
  });
  it.each(["logistica-lectura", "logistica-cupos", "logistica-flete"])(
    "rol %s consulta sin acciones de camión",
    async (rol) => {
      const id = await recibir(),
        f = await crear();
      await elegir(id, f);
      sesion.roles = [rol as RolNombre];
      mostrar();
      const modal = await detalle();
      expect(within(modal).getByRole("table", { name: "Camión elegido" })).toHaveTextContent(
        f.ficha.patenteChasis,
      );
      expect(
        within(modal).queryByRole("button", { name: "Reemplazar camión" }),
      ).not.toBeInTheDocument();
      expect(
        within(modal).queryByRole("button", { name: "Retirar camión" }),
      ).not.toBeInTheDocument();
      expect(within(modal).getByRole("button", { name: "Historial" })).toBeEnabled();
    },
  );
  it("detalle cacheado con lectura fallida nunca habilita acciones de camión", async () => {
    await recibir();
    mostrar();
    const modal = await detalle();
    expect(within(modal).getByRole("button", { name: "Elegir camión" })).toBeEnabled();
    fireEvent.click(within(modal).getByRole("button", { name: "Cerrar" }));
    server.use(
      http.get(`${API}/seguimientos/:id`, () =>
        HttpResponse.json({ detail: "Lectura fallida", status: 503 }, { status: 503 }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Detalle" }));
    const viejo = await screen.findByRole("dialog", { name: "Detalle de seguimiento" });
    await within(viejo).findByText("Lectura fallida");
    expect(within(viejo).queryByRole("button", { name: "Elegir camión" })).not.toBeInTheDocument();
  });
});

describe("Historia y Excel de camión elegido", () => {
  it("XLSX API entrega un error explícito si la revisión Flota no es representable", async () => {
    await recibir();
    vi.spyOn(ExcelDemo, "excelLogisticaDemo").mockRejectedValueOnce(
      new Error("La revisión de flota no se puede exportar sin pérdida de precisión."),
    );
    const r = await fetch(`${API}/seguimientos/excel?${new URLSearchParams(periodoInicial())}`);
    expect(r.status).toBe(500);
    expect(await r.json()).toMatchObject({
      status: 500,
      detail: "La revisión de flota no se puede exportar sin pérdida de precisión.",
    });
  });
  it("XLSX sin referencia conserva diez columnas vacías; revisión segura máxima es texto literal", async () => {
    const id = await recibir(),
      f = await crear();
    const s = await actual(id);
    const filas: ConciliacionFila[] = [
      { seguimiento: s, estadoConsulta: "sin_vinculo", erp: null, incidencias: [] },
    ];
    let x = libro(
      await excelLogisticaDemo(
        filas,
        new URLSearchParams(periodoInicial()),
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
      ),
    );
    expect(columnasFlota.map((c) => x.datos[0][0][c])).toEqual(Array(10).fill(""));
    s.flotaVigente = { ...operativo(f), revision: Number.MAX_SAFE_INTEGER };
    x = libro(
      await excelLogisticaDemo(
        filas,
        new URLSearchParams(periodoInicial()),
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
      ),
    );
    expect(x.datos[0][0]["Revisión flota"]).toBe("9007199254740991");
  });
  it("XLSX rechaza revisión Flota no representable sin fabricar precisión", async () => {
    const id = await recibir(),
      f = await crear(),
      s = await elegir(id, f);
    s.flotaVigente!.revision = 9007199254740992;
    const fila: ConciliacionFila = {
      seguimiento: s,
      estadoConsulta: "sin_vinculo",
      erp: null,
      incidencias: [],
    };
    await expect(
      excelLogisticaDemo(
        [fila],
        new URLSearchParams(periodoInicial()),
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
      ),
    ).rejects.toThrow("La revisión de flota no se puede exportar sin pérdida de precisión.");
  });
  it("historia humana allowlist presenta ausencia/null/cero y no filtra propiedades extra ni CUIT", () => {
    const ref = {
      fichaId: "ficha",
      versionId: "version",
      revision: 3,
      patenteChasis: "AA-123 BB",
      patenteAcoplado: null,
      conductor: null,
      transportista: "Empresa",
      importeReferencia: "0",
      moneda: "ARS",
      vigenteDesde: "2026-10-04",
      cuitConductor: "NO-EXPOSICION",
      extra: { privado: "NO-EXPOSICION" },
    };
    const campos = camposHistorial(
      JSON.stringify({ anterior: ref, nuevo: null, motivo: "Retirado", extra: "NO-EXPOSICION" }),
      "seguimientos",
    );
    expect(campos).toContainEqual({
      campo: "Camión elegido",
      anterior: "AA-123 BB",
      nuevo: "Sin camión elegido",
    });
    expect(campos).toContainEqual({
      campo: "Importe de referencia",
      anterior: "0",
      nuevo: "Sin referencia",
    });
    expect(campos).toContainEqual({
      campo: "Revisión de la ficha",
      anterior: "3",
      nuevo: "Sin dato",
    });
    expect(JSON.stringify(campos)).not.toMatch(/CUIT|NO-EXPOSICION|privado/i);
  });
  it.each([
    "null",
    "[]",
    '{"anterior":[],"nuevo":"mal"}',
    '{"anterior":{"versionId":{},"patenteChasis":{"cuit":"privado"}},"nuevo":null}',
    "invalido",
  ])("historia malformada %s es segura y no filtra objetos", (json) => {
    const campos = camposHistorial(json, "seguimientos");
    expect(JSON.stringify(campos)).not.toMatch(/privado|\[object Object\]|cuit/i);
  });
  it("XLSX conserva elección histórica tras edición/baja, diez columnas literales y fuentes anteriores", async () => {
    const id = await recibir(),
      f = await crear({
        patenteChasis: "=CHASIS",
        conductor: "=CONDUCTOR",
        importeReferencia: "99999999999999.9999",
        moneda: "USD",
        vigenteDesde: "2026-10-04",
      });
    await elegir(id, f);
    await baja(await editarFicha(f));
    const r = await fetch(`${API}/seguimientos/excel?${new URLSearchParams(periodoInicial())}`);
    expect(r.status).toBe(200);
    const x = libro(new Uint8Array(await r.arrayBuffer()));
    expect(x.rows[0][0].map((c) => c.valor)).toEqual(expect.arrayContaining(columnasFlota));
    const row = x.datos[0][0];
    expect(columnasFlota.map((c) => row[c])).toEqual([
      f.id,
      f.versionId,
      "1",
      "=CHASIS",
      "",
      "=CONDUCTOR",
      "",
      "99999999999999.9999",
      "USD",
      "2026-10-04",
    ]);
    expect(x.hojas[0].querySelector("f")).toBeNull();
    expect(x.rows[0][1].every((c) => c.tipo === "s" || c.tipo === "inlineStr")).toBe(true);
    const meta = Object.fromEntries(x.datos[1].map((r) => [r["Filtro o fuente"], r.Valor]));
    expect(meta["Fuente flota"]).toMatch(/versión.*manual.*sin cálculos/i);
    expect(meta["Fuente operativa"]).toBeTruthy();
    expect(meta["Fuente administrativa"]).toBeTruthy();
    expect(JSON.stringify(x.datos)).not.toMatch(/\bCUIT\b|cuitConductor|cuitTransportista/i);
  });
  it.each([null, "0", "1.0001"])(
    "XLSX referencia %j es literal exacta distinta de ausencia",
    async (importe) => {
      const id = await recibir(),
        f = await crear(
          importe === null
            ? {}
            : { importeReferencia: importe, moneda: "ARS", vigenteDesde: "2026-10-04" },
        );
      const s = await elegir(id, f);
      const fila: ConciliacionFila = {
        seguimiento: s,
        estadoConsulta: "sin_vinculo",
        erp: null,
        incidencias: [],
      };
      const x = libro(
        await excelLogisticaDemo(
          [fila],
          new URLSearchParams(periodoInicial()),
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
        ),
      );
      expect(x.datos[0][0]["Importe referencia flota"]).toBe(importe ?? "");
    },
  );
});
