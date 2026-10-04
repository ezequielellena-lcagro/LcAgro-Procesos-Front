import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { getResponse, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RolNombre } from "@/features/auth/types";
import { env } from "@/lib/env";
import { logisticaHandlers, resetLogisticaDemo } from "@/mocks/handlers/logistica";
import {
  fecha,
  fechaHoraArgentina,
  hoy,
  instanteArgentinaUtc,
  periodoInicial,
  sumarDias,
} from "../format";
import { camposHistorial } from "../lib/historial";
import { diferenciaPeso, kgErp, kgOperativos } from "../lib/seguimiento";
import type {
  Cupo,
  CupoErp,
  DatoOperativoBody,
  Detalle,
  Evento,
  EstadoSeguimientoBody,
  OtorgarResultado,
  Pagina,
  Pedido,
  Recepcion,
  Seguimiento,
} from "../types";
import { CargasPage } from "./cargas-page";

const sesion = vi.hoisted(() => ({ roles: ["logistica-cargas"] as RolNombre[] }));
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
  resetLogisticaDemo();
  sesion.roles = ["logistica-cargas"];
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
async function post<T>(ruta: string, body: object, clave = crypto.randomUUID()) {
  const r = await enviar(ruta, body, "POST", clave);
  expect(r.ok).toBe(true);
  return (await r.json()) as T;
}
async function get<T>(ruta: string) {
  const r = await fetch(`${API}/${ruta}`);
  expect(r.ok).toBe(true);
  return (await r.json()) as T;
}
async function recibir(n = 1, mismoDia = true) {
  return post<Recepcion>("cupos/recepciones", {
    contratoVenta: "V-DEMO/1",
    solicitudId: null,
    referencia: "Recepción ficticia C6",
    recibidoAl: `${hoy()}T12:00:00Z`,
    filas: Array.from({ length: n }, (_, i) => ({
      ordinal: i + 1,
      fechaCarga: mismoDia ? hoy() : sumarDias(hoy(), i),
      destinoCodigo: i ? 102 : 101,
      codigoTerminal: i ? null : "DEMO-01",
      circuito: i ? "propia" : "directa",
      lugarTipo: "planta",
      lugarReferencia: "Planta ficticia",
    })),
  });
}
async function actual(id: string) {
  return (await get<Detalle<Seguimiento>>(`seguimientos/${id}`)).dato;
}
function dato(revision = 1, extra: Partial<DatoOperativoBody> = {}): DatoOperativoBody {
  return {
    revision,
    tipo: "kg_carga",
    kilogramos: "32123.4567",
    fuente: "balanza",
    observadoAl: "2026-10-03T00:33:09Z",
    referencia: "Ticket ficticio 1",
    ...extra,
  };
}
function estado(revision = 1, extra: Partial<EstadoSeguimientoBody> = {}): EstadoSeguimientoBody {
  return {
    revision,
    estadoObservado: "cargando",
    observadoAl: "2026-10-03T00:33:09Z",
    fuente: "operador",
    referencia: "Llamado ficticio",
    ...extra,
  };
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
  const modal = await screen.findByRole("dialog", { name: "Detalle de seguimiento" });
  await waitFor(() =>
    expect(screen.queryByText("Consultando seguimiento actualizado…")).not.toBeInTheDocument(),
  );
  return modal;
}
async function abrirPeso() {
  await detalle();
  fireEvent.click(await screen.findByRole("button", { name: "Registrar peso de carga" }));
  return screen.getByRole("dialog", { name: "Registrar peso de carga" });
}
function completarPeso() {
  fireEvent.change(screen.getByLabelText("Peso de carga"), { target: { value: "32123,4567" } });
  fireEvent.change(screen.getByLabelText("Fuente de la observación"), {
    target: { value: "balanza" },
  });
  fireEvent.change(screen.getByLabelText("Momento observado (hora argentina)"), {
    target: { value: "2026-10-02T21:33" },
  });
  fireEvent.change(screen.getByLabelText("Referencia de la observación"), {
    target: { value: "Ticket ficticio 1" },
  });
}

describe("Seguimiento MSW C6", () => {
  it("recepción crea seguimiento sin pesos y los comandos incrementan ambas revisiones conservando otorgamiento y pedido", async () => {
    const r = await recibir();
    const id = r.cupos[0].id;
    const inicial = await actual(id);
    expect(inicial.revision).toBe(1);
    expect(inicial.datosVigentes).toEqual([]);
    expect(inicial.referenciaRecepcion).toBe(r.referencia);
    expect(inicial.estadoObservadoAl).toBeNull();
    const pedido = await post<Pedido>("pedidos", {
      clienteNumero: 9000000001,
      producto: 10,
      campania: "2025-2026",
      fechaSolicitada: hoy(),
      cantidadCupos: 1,
      preventa: null,
      observacion: null,
    });
    const grant = await post<OtorgarResultado>("otorgamientos", {
      destinatarioTipo: "cliente",
      clienteNumero: pedido.clienteNumero,
      pedidoId: pedido.id,
      pedidoRevision: 1,
      cupos: [{ id, revision: 1 }],
    });
    const body = dato();
    const key = crypto.randomUUID();
    const original = await post<Seguimiento>(`seguimientos/${id}/datos-operativos`, body, key);
    expect(original.revision).toBe(2);
    expect(original.cupo.revision).toBe(3);
    expect(original.cupo.productoNombre).toBeNull();
    expect(original.cupo.destinoNombre).toBeNull();
    expect(original.cupo.otorgamientoVigente?.clienteNombre).toBeNull();
    const head = original.datosVigentes[0];
    const corregido = await post<Seguimiento>(
      `seguimientos/${id}/datos-operativos`,
      dato(2, {
        kilogramos: "31200",
        reemplazaId: head.id,
        motivoCorreccion: "Ticket rectificado",
        observadoAl: "2026-10-01T00:00:00Z",
      }),
    );
    expect(corregido.datosVigentes).toHaveLength(1);
    expect(corregido.datosVigentes[0].reemplazaId).toBe(head.id);
    const replay = await enviar(`seguimientos/${id}/datos-operativos`, body, "POST", key);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(original);
    const anulacion = await enviar(`seguimientos/${id}/anular`, {
      revision: 3,
      motivo: "Carga informada por duplicado",
    });
    expect(anulacion.status).toBe(200);
    const anulado = await actual(id);
    expect(anulado.datosVigentes).toEqual(corregido.datosVigentes);
    expect(anulado.cupo.otorgamientoVigente?.id).toBe(grant.otorgamientos[0].id);
    expect(anulado.cupo.revision).toBe(5);
    expect(anulado.revision).toBe(4);
    const pedidos = await get<Pagina<Pedido>>(`pedidos?${new URLSearchParams(periodoInicial())}`);
    expect(pedidos.filas[0].revision).toBe(2);
    expect(pedidos.filas[0].otorgados).toBe(1);
    expect(anulado.cupo.disponibleParaOtorgar).toBe(false);
    const replayAnulado = await enviar(`seguimientos/${id}/datos-operativos`, body, "POST", key);
    expect(replayAnulado.status).toBe(200);
    expect(await replayAnulado.json()).toEqual(original);
    expect((await enviar(`seguimientos/${id}/datos-operativos`, dato(4))).status).toBe(409);
    const historial = await get<Pagina<Evento>>(`seguimientos/${id}/historial`);
    expect(historial.filas).toHaveLength(3);
    const evento = JSON.parse(historial.filas[1].datos);
    expect(evento.anterior.kilogramos).toBe("32123.4567");
    expect(evento.nuevo.kilogramos).toBe("31200");
    expect(evento.nuevo.motivoCorreccion).toBe("Ticket rectificado");
  });
  it.each([
    { fuente: "erp" },
    { kilogramos: "0" },
    { kilogramos: "-1" },
    { kilogramos: "1.12345" },
    { kilogramos: "1e12" },
    { referencia: "" },
    { observadoAl: "fecha inválida" },
    { observadoAl: "2026-10-02T12:00:00" },
    { texto: "AB 123 CD" },
    { revision: 0 },
    { motivoCorreccion: "" },
    { reemplazaId: "00000000-0000-0000-0000-000000000000" },
  ])("rechaza valores inválidos sin registrar datos: %j", async (extra) => {
    const r = await recibir();
    const id = r.cupos[0].id;
    expect(
      (await enviar(`seguimientos/${id}/datos-operativos`, { ...dato(), ...extra })).status,
    ).toBe(400);
    expect((await actual(id)).revision).toBe(1);
    expect((await actual(id)).datosVigentes).toEqual([]);
  });
  it.each(["0.0001", "1.0001", "32123.4567", "999999999999.9997", "999999999999.9999"])(
    "acepta el decimal válido %s sin redondeo binario en la validación",
    async (kilogramos) => {
      const r = await recibir();
      const id = r.cupos[0].id;
      const s = await post<Seguimiento>(
        `seguimientos/${id}/datos-operativos`,
        dato(1, { kilogramos }),
      );
      expect(s.datosVigentes[0].kilogramos).toBe(kilogramos);
    },
  );
  it("patente acepta espacios internos, elimina extremos y exige valor exclusivo del tipo", async () => {
    const r = await recibir();
    const id = r.cupos[0].id;
    const s = await post<Seguimiento>(
      `seguimientos/${id}/datos-operativos`,
      dato(1, { tipo: "patente", kilogramos: undefined, texto: "  AB 123 CD  " }),
    );
    expect(s.datosVigentes[0].texto).toBe("AB 123 CD");
    expect(s.datosVigentes[0].kilogramos).toBeNull();
    for (const texto of ["", "   ", "AB\n123", "A".repeat(21)])
      expect(
        (
          await enviar(
            `seguimientos/${id}/datos-operativos`,
            dato(2, { tipo: "patente", kilogramos: undefined, texto }),
          )
        ).status,
      ).toBe(400);
  });
  it("representaciones equivalentes del peso comparten replay original sin sumar datos", async () => {
    const r = await recibir();
    const id = r.cupos[0].id;
    const clave = crypto.randomUUID();
    const original = await post<Seguimiento>(
      `seguimientos/${id}/datos-operativos`,
      dato(1, { kilogramos: "1.0000" }),
      clave,
    );
    expect(original.datosVigentes[0].kilogramos).toBe("1");
    const replay = await enviar(
      `seguimientos/${id}/datos-operativos`,
      { ...dato(), kilogramos: 1 },
      "POST",
      clave,
    );
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(original);
    expect((await actual(id)).revision).toBe(2);
    expect((await get<Pagina<Evento>>(`seguimientos/${id}/historial`)).filas).toHaveLength(1);
  });
  it("corrección requiere cabeza exacta y motivo; el primer dato omite ambos", async () => {
    const r = await recibir(2);
    const id = r.cupos[0].id;
    expect(
      (
        await enviar(
          `seguimientos/${id}/datos-operativos`,
          dato(1, { motivoCorreccion: "No corresponde" }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await enviar(
          `seguimientos/${id}/datos-operativos`,
          dato(1, { reemplazaId: crypto.randomUUID() }),
        )
      ).status,
    ).toBe(409);
    const s = await post<Seguimiento>(`seguimientos/${id}/datos-operativos`, dato());
    const head = s.datosVigentes[0].id;
    expect((await enviar(`seguimientos/${id}/datos-operativos`, dato(2))).status).toBe(409);
    expect(
      (await enviar(`seguimientos/${id}/datos-operativos`, dato(2, { reemplazaId: head }))).status,
    ).toBe(400);
    expect(
      (
        await enviar(
          `seguimientos/${r.cupos[1].id}/datos-operativos`,
          dato(1, { reemplazaId: head, motivoCorreccion: "Otra carga" }),
        )
      ).status,
    ).toBe(409);
    expect((await actual(id)).revision).toBe(2);
  });
  it("estado admite primera observación y cambio retrospectivo con motivo sin deducirlo de pesos", async () => {
    const r = await recibir();
    const id = r.cupos[0].id;
    const first = await enviar(
      `seguimientos/${id}/estado`,
      estado(1, { estadoObservado: "descargado" }),
      "PUT",
    );
    expect(first.status).toBe(200);
    expect((await enviar(`seguimientos/${id}/estado`, estado(2), "PUT")).status).toBe(400);
    expect(
      (
        await enviar(
          `seguimientos/${id}/estado`,
          { ...estado(2, { motivoCorreccion: "Corrección" }), fuente: "erp" },
          "PUT",
        )
      ).status,
    ).toBe(400);
    const correccion = await enviar(
      `seguimientos/${id}/estado`,
      estado(2, {
        estadoObservado: "por_iniciar",
        observadoAl: "2026-10-01T12:00:00Z",
        motivoCorreccion: "Se informó otro cupo",
      }),
      "PUT",
    );
    expect(correccion.status).toBe(200);
    expect((await actual(id)).cupo.disponibleParaOtorgar).toBe(true);
    await post(`seguimientos/${id}/datos-operativos`, dato(3));
    expect((await actual(id)).estadoObservado).toBe("por_iniciar");
  });
  it("mismo UUID de operación usado en otro cupo da conflicto y el replay no depende del orden de propiedades", async () => {
    const r = await recibir(2);
    const key = crypto.randomUUID();
    const body = dato();
    const original = await post<Seguimiento>(
      `seguimientos/${r.cupos[0].id}/datos-operativos`,
      body,
      key,
    );
    expect(
      (await enviar(`seguimientos/${r.cupos[1].id}/datos-operativos`, body, "POST", key)).status,
    ).toBe(409);
    const invertido = Object.fromEntries(Object.entries(body).reverse());
    const replay = await enviar(
      `seguimientos/${r.cupos[0].id}/datos-operativos`,
      invertido,
      "POST",
      key,
    );
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(original);
    expect(
      (
        await enviar(
          `seguimientos/${r.cupos[0].id}/datos-operativos`,
          { ...body, kilogramos: "3" },
          "POST",
          key,
        )
      ).status,
    ).toBe(409);
  });
  it("el demo autoriza lectura y exige cargas para escribir", async () => {
    const r = await recibir();
    const id = r.cupos[0].id;
    const lectura = await fetch(`${API}/seguimientos/${id}`, {
      headers: { Authorization: "Bearer mock-access-8" },
    });
    expect(lectura.status).toBe(200);
    expect(
      (
        await enviar(
          `seguimientos/${id}/estado`,
          estado(),
          "PUT",
          crypto.randomUUID(),
          "mock-access-8",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await enviar(
          `seguimientos/${id}/estado`,
          estado(),
          "PUT",
          crypto.randomUUID(),
          "mock-access-2",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await enviar(
          `seguimientos/${id}/estado`,
          estado(),
          "PUT",
          crypto.randomUUID(),
          "mock-access-7",
        )
      ).status,
    ).toBe(200);
    const history = await get<Pagina<Evento>>(`seguimientos/${id}/historial`);
    expect(history.filas[0].registradoPorId).toBe(7);
  });
  it("filtra fecha prevista, asignación, cereal, destino, circuito y anulados antes de paginar por día y cupo", async () => {
    const r = await recibir(51);
    const id = r.cupos[50].id;
    const filtros = new URLSearchParams({
      desde: hoy(),
      hastaExclusivo: sumarDias(hoy(), 1),
      destinoCodigo: "102",
      circuito: "propia",
      producto: "10",
      campania: "2025-2026",
      contrato: "V-DEMO/1",
      tamano: "1",
    });
    const p = await get<Pagina<Seguimiento>>(`seguimientos?${filtros}`);
    expect(p.filas).toHaveLength(1);
    expect(p.hayMas).toBe(true);
    expect(p.filas[0].cupo.destinoCodigo).toBe(102);
    filtros.set("despuesFecha", p.filas[0].cupo.fechaCarga);
    filtros.set("despuesId", p.filas[0].cupoId);
    const segunda = await get<Pagina<Seguimiento>>(`seguimientos?${filtros}`);
    expect(segunda.filas[0].cupoId).not.toBe(p.filas[0].cupoId);
    await post(`otorgamientos`, {
      destinatarioTipo: "cliente",
      clienteNumero: 1,
      cupos: [{ id, revision: 1 }],
    });
    const cliente = await get<Pagina<Seguimiento>>(
      `seguimientos?${new URLSearchParams({ ...periodoInicial(), clienteNumero: "1" })}`,
    );
    expect(cliente.filas.map((s) => s.cupoId)).toEqual([id]);
    await enviar(`seguimientos/${id}/anular`, { revision: 1, motivo: "Anulación ficticia" });
    const activos = await get<Pagina<Seguimiento>>(
      `seguimientos?${new URLSearchParams(periodoInicial())}`,
    );
    expect(activos.filas.some((s) => s.cupoId === id)).toBe(false);
    const anulados = await get<Pagina<Seguimiento>>(
      `seguimientos?${new URLSearchParams({ ...periodoInicial(), anulados: "true" })}`,
    );
    expect(anulados.filas.map((s) => s.cupoId)).toEqual([id]);
    const cupos = await get<Pagina<Cupo>>(
      `cupos?${new URLSearchParams({ ...periodoInicial(), clienteNumero: "1" })}`,
    );
    expect(cupos.filas[0].seguimientoAnulado).toBe(true);
    expect(cupos.filas[0].disponibleParaOtorgar).toBe(false);
  });
});

describe("Cargas React D4", () => {
  it("bloquea navegación, Atrás y cierre desde el primer envío mientras está pendiente", async () => {
    const r = await recibir();
    const snapshot = await actual(r.cupos[0].id);
    let liberar: () => void = () => {};
    const espera = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    server.use(
      http.post(`${API}/seguimientos/:id/datos-operativos`, async () => {
        await espera;
        return HttpResponse.json(snapshot, { status: 201 });
      }),
    );
    const { router } = mostrar();
    await abrirPeso();
    completarPeso();
    fireEvent.click(screen.getByRole("button", { name: "Guardar observación" }));
    await screen.findByRole("button", { name: "Guardando…" });
    expect(screen.getByLabelText("Peso de carga")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false);
    await act(async () => {
      await router.navigate(-1);
    });
    expect(router.state.location.pathname).toBe("/logistica/cargas");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => liberar());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("peso cero no envía comando y una corrección usa la cabeza abierta con motivo", async () => {
    const r = await recibir();
    const id = r.cupos[0].id;
    const bodies: object[] = [];
    server.use(
      http.post(`${API}/seguimientos/:id/datos-operativos`, async ({ request }) => {
        bodies.push((await request.clone().json()) as object);
      }),
    );
    mostrar();
    await abrirPeso();
    completarPeso();
    fireEvent.change(screen.getByLabelText("Peso de carga"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar observación" }));
    await screen.findByText("Completá los campos obligatorios con valores válidos.");
    expect(bodies).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Peso de carga"), { target: { value: "31000" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar observación" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const s = await actual(id);
    await detalle();
    fireEvent.click(await screen.findByRole("button", { name: "Corregir peso de carga" }));
    expect(screen.getByLabelText("Peso de carga")).toHaveValue("31000");
    completarPeso();
    fireEvent.change(screen.getByLabelText("Motivo de corrección"), {
      target: { value: "Ticket rectificado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar observación" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(bodies[1]).toMatchObject({
      revision: s.revision,
      reemplazaId: s.datosVigentes[0].id,
      motivoCorreccion: "Ticket rectificado",
    });
    expect((await actual(id)).datosVigentes).toHaveLength(1);
  });
  it("formulario de estado permite corregir a un estado anterior con motivo y hora argentina", async () => {
    const r = await recibir();
    const id = r.cupos[0].id;
    await enviar(`seguimientos/${id}/estado`, estado(1, { estadoObservado: "descargado" }), "PUT");
    mostrar();
    await detalle();
    fireEvent.click(await screen.findByRole("button", { name: "Corregir estado" }));
    fireEvent.change(
      within(screen.getByRole("dialog")).getByLabelText("Estado observado", { selector: "select" }),
      { target: { value: "por_iniciar" } },
    );
    fireEvent.change(screen.getByLabelText("Fuente de la observación"), {
      target: { value: "cliente" },
    });
    fireEvent.change(screen.getByLabelText("Referencia de la observación"), {
      target: { value: "Consulta al productor" },
    });
    fireEvent.change(screen.getByLabelText("Momento observado (hora argentina)"), {
      target: { value: "2026-10-01T08:00" },
    });
    fireEvent.change(screen.getByLabelText("Motivo de corrección"), {
      target: { value: "Estado del camión equivocado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar observación" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const s = await actual(id);
    expect(s.estadoObservado).toBe("por_iniciar");
    expect(s.estadoObservadoAl).toBe("2026-10-01T11:00:00.000Z");
  });
  it("entrada extrema mantiene texto exacto al enviar, releer, corregir y mostrar su historia", async () => {
    const r = await recibir();
    const id = r.cupos[0].id;
    const bodies: DatoOperativoBody[] = [];
    server.use(
      http.post(`${API}/seguimientos/:id/datos-operativos`, async ({ request }) => {
        bodies.push((await request.clone().json()) as DatoOperativoBody);
      }),
    );
    mostrar();
    await abrirPeso();
    completarPeso();
    fireEvent.change(screen.getByLabelText("Peso de carga"), {
      target: { value: "999999999999,9997" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar observación" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(bodies[0].kilogramos).toBe("999999999999.9997");
    expect((await actual(id)).datosVigentes[0].kilogramos).toBe("999999999999.9997");
    await detalle();
    expect(screen.getAllByText("999.999.999.999,9997 kg").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Corregir peso de carga" }));
    expect(screen.getByLabelText("Peso de carga")).toHaveValue("999999999999.9997");
    completarPeso();
    fireEvent.change(screen.getByLabelText("Peso de carga"), {
      target: { value: "999999999999,9996" },
    });
    fireEvent.change(screen.getByLabelText("Motivo de corrección"), {
      target: { value: "Ticket extremo rectificado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar observación" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(bodies[1].kilogramos).toBe("999999999999.9996");
    const detalleActual = await detalle();
    fireEvent.click(within(detalleActual).getByRole("button", { name: "Historial" }));
    const historia = await screen.findByRole("dialog", { name: "Historial de la operación" });
    expect(
      (await within(historia).findAllByText("999.999.999.999,9997 kg")).length,
    ).toBeGreaterThan(0);
    expect(
      (await within(historia).findAllByText("999.999.999.999,9996 kg")).length,
    ).toBeGreaterThan(0);
    expect(within(historia).getAllByText("Ticket extremo rectificado").length).toBeGreaterThan(0);
  });
  it("formulario anula con motivo y conserva la asignación y los pesos", async () => {
    const r = await recibir();
    const id = r.cupos[0].id;
    await post("otorgamientos", { destinatarioTipo: "propio", cupos: [{ id, revision: 1 }] });
    await post(`seguimientos/${id}/datos-operativos`, dato());
    const previo = await actual(id);
    mostrar();
    await detalle();
    fireEvent.click(await screen.findByRole("button", { name: "Anular seguimiento" }));
    expect(screen.getByText(/La anulación conserva la asignación/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Motivo de anulación"), {
      target: { value: "Seguimiento duplicado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anular seguimiento" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const s = await actual(id);
    expect(s.anuladoAl).not.toBeNull();
    expect(s.datosVigentes).toEqual(previo.datosVigentes);
    expect(s.cupo.otorgamientoVigente).toEqual(previo.cupo.otorgamientoVigente);
    expect(s.motivoAnulacion).toBe("Seguimiento duplicado");
  });
  it.each([
    { peso: "32100", erp: 0, oficial: "0 kg", delta: "+32.100 kg" },
    {
      peso: "999999999999.9997",
      erp: "999999999999.9996",
      oficial: "999.999.999.999,9996 kg",
      delta: "+0,0001 kg",
    },
    { peso: "30000.1234", erp: "30000.12345", oficial: "30.000,12345 kg", delta: "-0,00005 kg" },
  ])(
    "consulta el vínculo exacto y compara el mismo peso $peso contra ERP $erp",
    async ({ peso, erp, oficial: pesoOficial, delta }) => {
      const r = await recibir();
      const id = r.cupos[0].id;
      await post(`seguimientos/${id}/datos-operativos`, dato(1, { kilogramos: peso }));
      const propio = await actual(id);
      const s: Seguimiento = {
        ...propio,
        vinculoErpVigente: {
          id: crypto.randomUUID(),
          contrato: "OTRO/ERP",
          grupo: 3,
          cupo: 77,
          vigenteDesde: "2026-10-02T22:00:00Z",
          evidencia: "Clave verificada",
          registradoPorId: 7,
        },
      };
      const urls: URL[] = [];
      const oficial: CupoErp = {
        contrato: "OTRO/ERP",
        grupo: 3,
        cupo: 77,
        codigoTerminal: "REPETIDO",
        fechaCarga: hoy(),
        fechaAltaErp: null,
        plantaTrabajo: null,
        plantaDetalle: null,
        productorPlan: null,
        cargadorPlan: null,
        codigoCp: null,
        sucursalCp: null,
        numeroCp: null,
        ordenCp: null,
        tieneCabecera: true,
        patenteAcoplado: null,
        fechaDescarga: null,
        destinoNombre: null,
        destinoCodigo: null,
        tieneCartaPorte: true,
        tieneDescarga: false,
        ctg: "CTG-DEMO",
        patenteChasis: "AB 123 CD",
        kgCargaErp: erp,
        kgDescargaErp: null,
      };
      server.use(
        http.get(`${API}/seguimientos/:id`, () =>
          HttpResponse.json({ dato: s, datosAl: "2026-10-03T00:33:09Z" }),
        ),
        http.get(`${API}/cupos/macrogest/detalle`, ({ request }) => {
          urls.push(new URL(request.url));
          return HttpResponse.json({ dato: oficial, datosAl: "2026-10-03T00:33:09Z" });
        }),
      );
      mostrar();
      await screen.findByText(kgOperativos(peso));
      expect(urls).toHaveLength(0);
      await detalle();
      await screen.findByText("CTG-DEMO");
      expect(urls).toHaveLength(1);
      expect(Object.fromEntries(urls[0].searchParams)).toEqual({
        contrato: "OTRO/ERP",
        grupo: "3",
        cupo: "77",
      });
      const tabla = screen.getByRole("table", { name: "Comparación por fuente" });
      const carga = within(tabla).getByText("Peso de carga").closest("tr")!;
      expect(within(carga).getByText(pesoOficial)).toBeInTheDocument();
      expect(within(carga).getByText(delta)).toBeInTheDocument();
      const descarga = within(tabla).getByText("Peso de descarga").closest("tr")!;
      expect(within(descarga).getByText("Sin comparación")).toBeInTheDocument();
      expect(within(descarga).queryByText("0 kg")).not.toBeInTheDocument();
      const docs = screen.getByRole("table", { name: "Documentación MacroGest" });
      expect(within(docs).getByText("Presente")).toBeInTheDocument();
      expect(within(docs).getByText("Pendiente")).toBeInTheDocument();
      expect(screen.getByText(/consultado al 02\/10\/2026, 21:33:09/)).toBeInTheDocument();
      expect(within(tabla).getByText("02/10/2026, 21:33:09")).toBeInTheDocument();
    },
  );
  it.each([503, 404])(
    "ERP %s conserva observaciones y vínculo, oculta el origen fallido y permite reintentar",
    async (status) => {
      const r = await recibir();
      const id = r.cupos[0].id;
      await post(`seguimientos/${id}/datos-operativos`, dato());
      const propio = await actual(id);
      const s: Seguimiento = {
        ...propio,
        vinculoErpVigente: {
          id: crypto.randomUUID(),
          contrato: "V-EXACTA",
          grupo: 2,
          cupo: 4,
          vigenteDesde: "2026-10-02T12:00:00Z",
          evidencia: "Referencia comprobada",
          registradoPorId: 7,
        },
      };
      const oficial: CupoErp = {
        contrato: "V-EXACTA",
        grupo: 2,
        cupo: 4,
        codigoTerminal: null,
        fechaCarga: hoy(),
        fechaAltaErp: null,
        plantaTrabajo: null,
        plantaDetalle: null,
        productorPlan: null,
        cargadorPlan: null,
        codigoCp: null,
        sucursalCp: null,
        numeroCp: null,
        ordenCp: null,
        tieneCabecera: true,
        patenteAcoplado: null,
        fechaDescarga: null,
        destinoNombre: null,
        destinoCodigo: null,
        tieneCartaPorte: true,
        tieneDescarga: false,
        ctg: "CTG-ACTUAL",
        patenteChasis: null,
        kgCargaErp: 33000,
        kgDescargaErp: null,
      };
      let calls = 0;
      server.use(
        http.get(`${API}/seguimientos/:id`, () =>
          HttpResponse.json({ dato: s, datosAl: "2026-10-03T00:00:00Z" }),
        ),
        http.get(`${API}/cupos/macrogest/detalle`, () => {
          calls++;
          return calls === 1
            ? HttpResponse.json({ detail: "Origen fallido" }, { status })
            : HttpResponse.json({ dato: oficial, datosAl: "2026-10-03T00:00:00Z" });
        }),
      );
      mostrar();
      await detalle();
      await screen.findByText(
        status === 404 ? /El vínculo exacto no se encontró/ : /MacroGest no está disponible/,
      );
      expect(screen.getByText(/Referencia comprobada/)).toBeInTheDocument();
      expect(screen.getAllByText("32.123,4567 kg").length).toBeGreaterThan(0);
      expect(screen.queryByText(/consultado al/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Reintentar MacroGest" }));
      await screen.findByText("CTG-ACTUAL");
      expect(screen.getByText("-876,5433 kg")).toBeInTheDocument();
      expect((await actual(id)).datosVigentes).toEqual(propio.datosVigentes);
    },
  );
  it("filtros por catálogo aceptan cliente inactivo, aplican explícitamente y reinician A → B → A, tab y rango", async () => {
    const r = await recibir(2);
    const initial = await Promise.all(r.cupos.map((c) => actual(c.id)));
    const urls: URL[] = [];
    server.use(
      http.get(`${API}/catalogos/clientes`, () =>
        HttpResponse.json({
          filas: [{ codigo: 1, nombre: "Productor inactivo ficticio", estado: "I" }],
          hayMas: false,
          datosAl: new Date().toISOString(),
        }),
      ),
      http.get(`${API}/seguimientos`, ({ request }) => {
        const u = new URL(request.url);
        urls.push(u);
        const siguiente = u.searchParams.has("despuesId"),
          vacio = u.searchParams.get("producto") === "1";
        return HttpResponse.json({
          filas: vacio ? [] : [initial[siguiente ? 1 : 0]],
          hayMas: !siguiente && !vacio,
          datosAl: new Date().toISOString(),
        });
      }),
    );
    mostrar();
    await screen.findByRole("option", { name: "Productor inactivo ficticio (1)" });
    expect(screen.getByRole("option", { name: "Productor inactivo ficticio (1)" })).toBeEnabled();
    const count = urls.length;
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar cereal" }), {
      target: { value: "Soja" },
    });
    await screen.findByRole("option", { name: "Soja (10)" });
    expect(urls).toHaveLength(count);
    const cargar = async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Cargar más filas" }));
      await screen.findByText("Recepción ficticia C6 · fila 2");
    };
    const soloPrimera = async () => {
      await screen.findByText("Recepción ficticia C6 · fila 1");
      await waitFor(() =>
        expect(screen.queryByText("Recepción ficticia C6 · fila 2")).not.toBeInTheDocument(),
      );
      expect(urls.at(-1)!.searchParams.has("despuesId")).toBe(false);
    };
    await cargar();
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar cereal" }), {
      target: { value: "Maíz" },
    });
    await screen.findByRole("option", { name: "Maíz (1)" });
    fireEvent.change(screen.getByLabelText("Cereal", { selector: "select" }), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await screen.findByText(/No hay cargas para estas fechas/);
    fireEvent.change(screen.getByLabelText("Cereal", { selector: "select" }), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Productor", { selector: "select" }), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await soloPrimera();
    expect(urls.at(-1)!.searchParams.get("clienteNumero")).toBe("1");
    await cargar();
    fireEvent.click(screen.getByRole("tab", { name: "Período" }));
    await soloPrimera();
    await cargar();
    fireEvent.change(screen.getByLabelText("Fecha prevista de carga: desde"), {
      target: { value: hoy() },
    });
    fireEvent.change(screen.getByLabelText("Hasta inclusive"), { target: { value: hoy() } });
    fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
    await soloPrimera();
    expect(urls.at(-1)!.searchParams.get("desde")).toBe(hoy());
    expect(urls.at(-1)!.searchParams.get("hastaExclusivo")).toBe(sumarDias(hoy(), 1));
  });
  it("catálogo caído permite consultar lo propio por código conocido", async () => {
    await recibir();
    const urls: URL[] = [];
    server.use(
      http.get(`${API}/catalogos/clientes`, () =>
        HttpResponse.json({ detail: "Catálogo no disponible" }, { status: 503 }),
      ),
      http.get(`${API}/seguimientos`, ({ request }) => {
        urls.push(new URL(request.url));
      }),
    );
    mostrar();
    await screen.findByText("Catálogo no disponible");
    fireEvent.change(screen.getByLabelText("Código de productor (opcional)"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get("clienteNumero")).toBe("1"));
  });
  it("listado diferencia pendientes, no muestra estimación como peso y nunca consulta ERP por fila", async () => {
    const r = await recibir();
    await post("otorgamientos", {
      destinatarioTipo: "propio",
      cupos: [{ id: r.cupos[0].id, revision: 1 }],
    });
    const calls = vi.fn();
    server.use(http.get(`${API}/cupos/macrogest/detalle`, calls));
    mostrar();
    const tabla = await screen.findByRole("table", { name: "Cargas a puerto" });
    await within(tabla).findByText("Propio");
    expect(within(tabla).getAllByText("Pendiente")).toHaveLength(3);
    expect(within(tabla).queryByText(/30.000/)).not.toBeInTheDocument();
    expect(within(tabla).queryByText("0 kg")).not.toBeInTheDocument();
    await detalle();
    await screen.findByText("Vínculo con MacroGest pendiente. Los datos operativos se conservan.");
    expect(calls).not.toHaveBeenCalled();
    expect(screen.getByText("Recepción ficticia C6 · fila 1")).toBeInTheDocument();
  });
  it.each(["logistica-lectura", "logistica-cupos"] as const)(
    "%s consulta detalle e historia sin comandos de seguimiento",
    async (rol) => {
      await recibir();
      sesion.roles = [rol];
      mostrar();
      await detalle();
      await screen.findByText(
        "Vínculo con MacroGest pendiente. Los datos operativos se conservan.",
      );
      expect(screen.queryByRole("button", { name: "Registrar estado" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Anular seguimiento" })).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Registrar peso de carga" }),
      ).not.toBeInTheDocument();
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Historial" }),
      );
      expect(
        await screen.findByRole("dialog", { name: "Historial de la operación" }),
      ).toBeInTheDocument();
    },
  );
  it("edición permite cancelar antes del primer envío y navegar libremente", async () => {
    await recibir();
    const { router } = mostrar();
    await abrirPeso();
    expect(screen.getByLabelText("Peso de carga")).toHaveValue("");
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Ir a otra página" }));
    await screen.findByText("Página de salida");
    expect(router.state.location.pathname).toBe("/salida");
  });
  it.each(["red", "503"])(
    "resultado incierto %s bloquea salida y reintenta el mismo cuerpo, revisión y UUID",
    async (fallo) => {
      const r = await recibir();
      const id = r.cupos[0].id;
      const bodies: object[] = [],
        keys: string[] = [];
      server.use(
        http.post(`${API}/seguimientos/:id/datos-operativos`, async ({ request }) => {
          bodies.push((await request.clone().json()) as object);
          keys.push(request.headers.get("Idempotency-Key")!);
          if (bodies.length === 1)
            return fallo === "red"
              ? HttpResponse.error()
              : HttpResponse.json({ detail: "Resultado no disponible" }, { status: 503 });
        }),
      );
      const { router, client } = mostrar();
      await abrirPeso();
      completarPeso();
      fireEvent.change(screen.getByLabelText("Peso de carga"), {
        target: { value: "999999999999,9997" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Guardar observación" }));
      await screen.findByRole("button", { name: "Reintentar operación" });
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
      expect(screen.getByLabelText("Peso de carga")).toBeDisabled();
      expect(screen.getByRole("tab", { name: "Período" })).toBeDisabled();
      expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false);
      fireEvent.keyDown(document, { key: "Escape" });
      fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
      expect(screen.getByRole("dialog", { name: "Registrar peso de carga" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("dialog").parentElement!.firstElementChild!);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("link", { name: "Ir a otra página" }));
      await screen.findByText(/Confirmá el resultado antes de salir/);
      expect(router.state.location.pathname).toBe("/logistica/cargas");
      await act(async () => {
        await router.navigate(-1);
      });
      expect(router.state.location.pathname).toBe("/logistica/cargas");
      const snapshot = await actual(id);
      server.use(
        http.get(`${API}/seguimientos`, () =>
          HttpResponse.json({
            filas: [{ ...snapshot, revision: 99 }],
            hayMas: false,
            datosAl: new Date().toISOString(),
          }),
        ),
      );
      await act(async () => {
        await client.invalidateQueries({ queryKey: ["logistica", "seguimientos"] });
      });
      fireEvent.click(screen.getByRole("button", { name: "Reintentar operación" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(bodies).toHaveLength(2);
      expect(bodies[0]).toEqual(bodies[1]);
      expect(keys[0]).toBe(keys[1]);
      expect(bodies[0]).toMatchObject({
        revision: 1,
        kilogramos: "999999999999.9997",
        observadoAl: "2026-10-03T00:33:00.000Z",
      });
      expect((await actual(id)).datosVigentes).toHaveLength(1);
      expect((await actual(id)).datosVigentes[0].kilogramos).toBe("999999999999.9997");
      expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true);
    },
  );
  it.each(["red", "503"])(
    "comando confirmado con respuesta %s y reintento 403 conserva protección hasta replay exitoso",
    async (fallo) => {
      const r = await recibir();
      const id = r.cupos[0].id;
      const bodies: DatoOperativoBody[] = [],
        keys: string[] = [],
        respuestasReales: number[] = [];
      let original: Seguimiento | undefined, replay: Seguimiento | undefined;
      server.use(
        http.post(`${API}/seguimientos/:id/datos-operativos`, async ({ request }) => {
          bodies.push((await request.clone().json()) as DatoOperativoBody);
          keys.push(request.headers.get("Idempotency-Key")!);
          if (bodies.length === 2)
            return HttpResponse.json(
              { detail: "Permiso rechazado antes del replay" },
              { status: 403 },
            );
          // Ejecutar los handlers públicos confirma la operación real y conserva su replay.
          const real = await getResponse(logisticaHandlers, request.clone());
          expect(real).toBeDefined();
          respuestasReales.push(real!.status);
          const dto = (await real!.json()) as Seguimiento;
          if (bodies.length === 1) {
            original = dto;
            return fallo === "red"
              ? HttpResponse.error()
              : HttpResponse.json(
                  { detail: "Respuesta perdida después de confirmar" },
                  { status: 503 },
                );
          }
          replay = dto;
          return HttpResponse.json(dto, { status: real!.status });
        }),
      );
      const { router, client } = mostrar();
      await abrirPeso();
      completarPeso();
      fireEvent.change(screen.getByLabelText("Peso de carga"), {
        target: { value: "999999999999,9997" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Guardar observación" }));
      await screen.findByRole("button", { name: "Reintentar operación" });
      expect(original?.revision).toBe(2);
      expect((await actual(id)).datosVigentes[0].kilogramos).toBe("999999999999.9997");
      await enviar(`seguimientos/${id}/estado`, estado(2), "PUT");
      await act(async () => {
        await client.invalidateQueries({ queryKey: ["logistica", "seguimientos"] });
      });
      fireEvent.click(screen.getByRole("button", { name: "Reintentar operación" }));
      await screen.findByText(/Permiso rechazado antes del replay/);
      expect(screen.getByRole("button", { name: "Reintentar operación" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
      expect(screen.getByLabelText("Peso de carga")).toBeDisabled();
      expect(screen.getByLabelText("Peso de carga")).toHaveValue("999999999999,9997");
      expect(screen.getByRole("tab", { name: "Período" })).toBeDisabled();
      expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false);
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
      fireEvent.keyDown(document, { key: "Escape" });
      fireEvent.click(screen.getByRole("dialog").parentElement!.firstElementChild!);
      expect(screen.getByRole("dialog", { name: "Registrar peso de carga" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("link", { name: "Ir a otra página" }));
      await screen.findByText(/Confirmá el resultado antes de salir/);
      expect(router.state.location.pathname).toBe("/logistica/cargas");
      await act(async () => {
        await router.navigate(-1);
      });
      expect(router.state.location.pathname).toBe("/logistica/cargas");
      expect(bodies).toHaveLength(2);
      fireEvent.click(screen.getByRole("button", { name: "Reintentar operación" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(bodies).toHaveLength(3);
      expect(bodies[0]).toEqual(bodies[1]);
      expect(bodies[0]).toEqual(bodies[2]);
      expect(bodies[0].revision).toBe(1);
      expect(new Set(keys).size).toBe(1);
      expect(respuestasReales).toEqual([201, 200]);
      expect(replay).toEqual(original);
      expect((await actual(id)).revision).toBe(3);
      expect((await actual(id)).datosVigentes).toHaveLength(1);
      expect((await get<Pagina<Evento>>(`seguimientos/${id}/historial`)).filas).toHaveLength(2);
      expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true);
      fireEvent.click(screen.getByRole("link", { name: "Ir a otra página" }));
      await screen.findByText("Página de salida");
    },
  );
  it("409 después de un resultado incierto resuelve el intento, libera navegación y exige reapertura", async () => {
    const r = await recibir();
    const id = r.cupos[0].id;
    const bodies: DatoOperativoBody[] = [],
      keys: string[] = [];
    server.use(
      http.post(`${API}/seguimientos/:id/datos-operativos`, async ({ request }) => {
        bodies.push((await request.clone().json()) as DatoOperativoBody);
        keys.push(request.headers.get("Idempotency-Key")!);
        if (bodies.length === 1)
          return HttpResponse.json({ detail: "Resultado incierto" }, { status: 503 });
      }),
    );
    const { router } = mostrar();
    await abrirPeso();
    completarPeso();
    fireEvent.click(screen.getByRole("button", { name: "Guardar observación" }));
    await screen.findByRole("button", { name: "Reintentar operación" });
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false);
    await enviar(`seguimientos/${id}/estado`, estado(), "PUT");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar operación" }));
    await screen.findByText(/El seguimiento cambió. Abrí el detalle actualizado/);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toEqual(bodies[1]);
    expect(keys[0]).toBe(keys[1]);
    expect((await actual(id)).datosVigentes).toHaveLength(0);
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true);
    await abrirPeso();
    expect(screen.getByLabelText("Peso de carga")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("link", { name: "Ir a otra página" }));
    await screen.findByText("Página de salida");
    expect(router.state.location.pathname).toBe("/salida");
  });
  it.each(["demorada", "fallida"])(
    "409 exige lectura nueva %s antes de habilitar otra edición",
    async (lectura) => {
      const r = await recibir();
      const id = r.cupos[0].id;
      const bodies: DatoOperativoBody[] = [];
      server.use(
        http.post(`${API}/seguimientos/:id/datos-operativos`, async ({ request }) => {
          bodies.push((await request.clone().json()) as DatoOperativoBody);
          if (bodies.length === 1)
            return HttpResponse.json({ detail: "Cambió la revisión" }, { status: 409 });
        }),
      );
      mostrar();
      await abrirPeso();
      completarPeso();
      await enviar(`seguimientos/${id}/estado`, estado(), "PUT");
      fireEvent.click(screen.getByRole("button", { name: "Guardar observación" }));
      await screen.findByText(/El seguimiento cambió. Abrí el detalle actualizado/);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(bodies).toHaveLength(1);
      const nuevo = await actual(id);
      let liberar: () => void = () => {};
      const pendiente = new Promise<void>((resolve) => {
        liberar = resolve;
      });
      server.use(
        http.get(
          `${API}/seguimientos/:id`,
          async () => {
            await pendiente;
            return lectura === "fallida"
              ? HttpResponse.json({ detail: "Lectura propia no disponible" }, { status: 503 })
              : HttpResponse.json({ dato: nuevo, datosAl: "2026-10-03T00:00:00Z" });
          },
          { once: true },
        ),
      );
      fireEvent.click(await screen.findByRole("button", { name: "Detalle" }));
      await screen.findByText("Consultando seguimiento actualizado…");
      const modal = screen.getByRole("dialog", { name: "Detalle de seguimiento" });
      for (const nombre of [
        "Registrar peso de carga",
        "Registrar peso de descarga",
        "Registrar patente",
        "Registrar estado",
        "Anular seguimiento",
      ])
        expect(within(modal).getByRole("button", { name: nombre })).toBeDisabled();
      fireEvent.click(within(modal).getByRole("button", { name: "Registrar peso de carga" }));
      expect(
        screen.queryByRole("dialog", { name: "Registrar peso de carga" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/Datos de una consulta anterior/)).toBeInTheDocument();
      expect(bodies).toHaveLength(1);
      await act(async () => liberar());
      if (lectura === "fallida") {
        await screen.findByText(/Lectura propia no disponible/);
        expect(screen.getByRole("button", { name: "Registrar peso de carga" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Anular seguimiento" })).toBeDisabled();
        expect(screen.getByText(/Datos de una consulta anterior/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Reintentar detalle" }));
      }
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Registrar peso de carga" })).toBeEnabled(),
      );
      expect(screen.queryByText(/Datos de una consulta anterior/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Registrar peso de carga" }));
      completarPeso();
      fireEvent.click(screen.getByRole("button", { name: "Guardar observación" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect((await actual(id)).revision).toBe(3);
      expect((await actual(id)).datosVigentes).toHaveLength(1);
      expect(bodies).toHaveLength(2);
      expect(bodies[1].revision).toBe(2);
    },
  );
  it.each([400, 403])(
    "error definitivo %s permite salir y reabrir para otro intento",
    async (status) => {
      await recibir();
      server.use(
        http.post(`${API}/seguimientos/:id/datos-operativos`, () =>
          HttpResponse.json({ detail: "Operación rechazada" }, { status }),
        ),
      );
      mostrar();
      await abrirPeso();
      completarPeso();
      fireEvent.click(screen.getByRole("button", { name: "Guardar observación" }));
      await screen.findByText("Operación rechazada");
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
      expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );
  it("anulado mantiene los datos y asignación en detalle de sólo lectura", async () => {
    const r = await recibir();
    const id = r.cupos[0].id;
    await post("otorgamientos", { destinatarioTipo: "propio", cupos: [{ id, revision: 1 }] });
    await post(`seguimientos/${id}/datos-operativos`, dato());
    await enviar(`seguimientos/${id}/anular`, { revision: 2, motivo: "Registro duplicado" });
    mostrar();
    fireEvent.click(screen.getByRole("tab", { name: "Anuladas" }));
    await detalle();
    expect(await screen.findByText(/Registro duplicado/)).toBeInTheDocument();
    expect(screen.getAllByText("Propio").length).toBeGreaterThan(0);
    expect(screen.getAllByText("32.123,4567 kg").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "Corregir peso de carga" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anular seguimiento" })).not.toBeInTheDocument();
  });
});

describe("Historia y fechas de seguimiento", () => {
  it("formatea decimales exactos propios y administrativos sin tratar presencia como ausencia", () => {
    expect(kgOperativos("999999999999.9997")).toBe("999.999.999.999,9997 kg");
    expect(kgErp("30000.12345")).toBe("30.000,12345 kg");
    expect(kgErp("0.0000000000000000000000000001")).toBe("0,0000000000000000000000000001 kg");
    expect(kgErp("0")).toBe("0 kg");
    expect(kgErp(null)).toBe("Sin dato");
    expect(diferenciaPeso("30000.1234", "30000.12345")).toBe("-0,00005 kg");
    expect(diferenciaPeso("999999999999.9997", "999999999999.9996")).toBe("+0,0001 kg");
    expect(diferenciaPeso(null, "0")).toBe("Sin comparación");
  });
  it("allowlist muestra valor anterior, nuevo, fuente y motivo sin UUIDs ni JSON", () => {
    const id = crypto.randomUUID();
    const campos = camposHistorial(
      JSON.stringify({
        anterior: {
          id,
          tipo: "kg_carga",
          kilogramos: "30000",
          fuente: "cliente",
          observadoAl: "2026-10-03T00:33:09Z",
        },
        nuevo: {
          id,
          reemplazaId: id,
          tipo: "kg_carga",
          kilogramos: "32100.12",
          fuente: "balanza",
          observadoAl: "2026-10-02T12:00:00Z",
          registradoAl: "2026-10-03T00:33:09Z",
          registradoPorId: 7,
          referencia: "Ticket revisado",
          motivoCorreccion: "Error de transcripción",
          desconocido: "secreto",
        },
      }),
      "seguimientos",
    );
    expect(campos).toContainEqual({
      campo: "Kilogramos operativos",
      anterior: "30.000 kg",
      nuevo: "32.100,12 kg",
    });
    expect(campos).toContainEqual({ campo: "Fuente", anterior: "Cliente", nuevo: "Balanza" });
    expect(campos).toContainEqual({
      campo: "Motivo de corrección",
      anterior: "Sin dato",
      nuevo: "Error de transcripción",
    });
    expect(campos).toContainEqual({
      campo: "Momento observado (Argentina)",
      anterior: "02/10/2026, 21:33:09",
      nuevo: "02/10/2026, 09:00:00",
    });
    expect(JSON.stringify(campos)).not.toContain(id);
    expect(JSON.stringify(campos)).not.toContain("secreto");
    expect(camposHistorial(JSON.stringify({ observadoAl: "2026-10-03T00:33:09Z" }))[0].campo).toBe(
      "Momento de respuesta",
    );
    expect(camposHistorial(JSON.stringify({ seguimientoRevision: 4 }))).toContainEqual({
      campo: "Revisión del seguimiento",
      anterior: "Sin dato",
      nuevo: "4",
    });
  });
  it("muestra fechas absolutas argentinas y conserva el día previsto DateOnly", () => {
    expect(fechaHoraArgentina("2026-10-03T00:33:09Z")).toBe("02/10/2026, 21:33:09");
    expect(fecha("2026-10-03")).toBe("03/10/2026");
    expect(instanteArgentinaUtc("2026-10-02T21:33")).toBe("2026-10-03T00:33:00.000Z");
    expect(instanteArgentinaUtc("2026-02-31T12:00")).toBeNull();
  });
  it("historial presenta datos funcionales sin tabla vacía ni identificadores técnicos", async () => {
    const r = await recibir();
    const id = r.cupos[0].id;
    await post(`seguimientos/${id}/datos-operativos`, dato());
    const s = await actual(id);
    await post(
      `seguimientos/${id}/datos-operativos`,
      dato(2, {
        kilogramos: "31200",
        reemplazaId: s.datosVigentes[0].id,
        motivoCorreccion: "Ticket corregido",
      }),
    );
    mostrar();
    fireEvent.click(await screen.findByRole("button", { name: "Historial" }));
    await screen.findAllByText("Ticket corregido");
    screen.getAllByText("Ver datos registrados").forEach((e) => fireEvent.click(e));
    expect(within(screen.getByRole("dialog")).getByText("31.200 kg")).toBeInTheDocument();
    expect(screen.getAllByText("32.123,4567 kg").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Momento observado (Argentina)")).toHaveLength(2);
    expect(screen.queryByText(s.datosVigentes[0].id)).not.toBeInTheDocument();
    expect(screen.getAllByRole("table", { name: "Campos registrados" })).toHaveLength(2);
  });
});
