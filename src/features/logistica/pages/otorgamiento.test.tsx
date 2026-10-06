import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RolNombre } from "@/features/auth/types";
import { env } from "@/lib/env";
import { logisticaHandlers, resetLogisticaDemo } from "@/mocks/handlers/logistica";
import { fecha, fechaInstanteArgentina, hoy, periodoInicial, sumarDias } from "../format";
import { camposHistorial } from "../lib/historial";
import type {
  Cupo,
  Evento,
  OtorgarBody,
  OtorgarResultado,
  Pagina,
  Pedido,
  Recepcion,
} from "../types";
import { CuposPage } from "./cupos-page";

const sesion = vi.hoisted(() => ({ roles: ["logistica-cupos"] as RolNombre[] }));
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
  sesion.roles = ["logistica-cupos"];
});
afterAll(() => server.close());

async function post<T>(ruta: string, body: object, clave = crypto.randomUUID()) {
  const response = await fetch(`${API}/${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": clave },
    body: JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
  return (await response.json()) as T;
}
async function get<T>(ruta: string) {
  return (await (await fetch(`${API}/${ruta}`)).json()) as T;
}
async function put(ruta: string, body: object, clave = crypto.randomUUID()) {
  return fetch(`${API}/${ruta}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Idempotency-Key": clave },
    body: JSON.stringify(body),
  });
}
function cuerpoCorreccion(pedido: Pedido, cantidadCupos = pedido.cantidadCupos) {
  return {
    revision: pedido.revision,
    clienteNumero: pedido.clienteNumero,
    producto: pedido.producto,
    campania: pedido.campania,
    fechaSolicitada: pedido.fechaSolicitada,
    cantidadCupos,
    preventa: pedido.preventa,
    observacion: pedido.observacion,
  };
}
async function recibir(cantidad = 2, fechaCarga = hoy()) {
  return post<Recepcion>("cupos/recepciones", {
    contratoVenta: "V-DEMO/1",
    solicitudId: null,
    referencia: "Recepción ficticia",
    recibidoAl: `${hoy()}T12:00:00`,
    filas: Array.from({ length: cantidad }, (_, i) => ({
      ordinal: i + 1,
      fechaCarga: i ? sumarDias(fechaCarga, 1) : fechaCarga,
      destinoCodigo: i ? 102 : 101,
      codigoTerminal: null,
      circuito: i ? "propia" : "directa",
      lugarTipo: "planta",
      lugarReferencia: "Planta ficticia",
    })),
  });
}
async function pedir(cantidad = 3) {
  return post<Pedido>("pedidos", {
    clienteNumero: 9000000001,
    producto: 10,
    campania: "2025-2026",
    fechaSolicitada: hoy(),
    cantidadCupos: cantidad,
    preventa: null,
    observacion: null,
  });
}
function mostrar() {
  return mostrarConRutas().client;
}
function mostrarConRutas() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: "/anterior", element: <p>Página anterior</p> },
      {
        path: "/logistica/cupos",
        element: (
          <>
            <Link to="/salida">Ir a otra página</Link>
            <CuposPage />
          </>
        ),
      },
      { path: "/salida", element: <p>Página de salida</p> },
    ],
    { initialEntries: ["/anterior", "/logistica/cupos"], initialIndex: 1 },
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
  fireEvent.click(screen.getByRole("tab", { name: "Otorgar" }));
  await screen.findByRole("table", { name: "Cupos disponibles para otorgar" });
}
async function elegirCupo(fila = 1) {
  fireEvent.click(
    await screen.findByRole("checkbox", { name: `Elegir cupo V-DEMO/1 fila ${fila}` }),
  );
}
function capturaPost(cuerpos: OtorgarBody[], claves?: string[]) {
  server.use(
    http.post(`${API}/otorgamientos`, async ({ request }) => {
      cuerpos.push((await request.clone().json()) as OtorgarBody);
      claves?.push(request.headers.get("Idempotency-Key") ?? "");
    }),
  );
}
async function confirmar() {
  fireEvent.click(screen.getByRole("button", { name: "Revisar otorgamiento" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar otorgamiento" }));
  await screen.findByText(/Se otorgaron \d cupos/);
}

/**
 * Elige una opción del combo de catálogo (Productor / Cereal / Destino). Es un campo único: se
 * tipea y se elige de la lista que se abre, en vez del viejo buscador + `<select>`.
 */
async function elegirCatalogo(etiqueta: string, buscado: string, opcion: string) {
  const campo = screen.getByLabelText(etiqueta);
  fireEvent.focus(campo);
  if (buscado) fireEvent.change(campo, { target: { value: buscado } });
  const lista = await screen.findByRole("listbox");
  fireEvent.mouseDown(await within(lista).findByRole("button", { name: opcion }));
}

describe("Primera asignación de Logística", () => {
  it.each([0, 1])(
    "avisa antes de confirmar sólo si la fecha del cupo difiere del pedido (diferencia=%s días)",
    async (diferencia) => {
      const recepcion = await recibir(1, sumarDias(hoy(), diferencia));
      const pedido = await pedir(1);
      const cuerpos: OtorgarBody[] = [];
      capturaPost(cuerpos);
      mostrar();
      await abrir();
      fireEvent.click(
        await screen.findByRole("radio", { name: "Elegir pedido de Productor ficticio" }),
      );
      await elegirCupo();
      fireEvent.click(screen.getByRole("button", { name: "Revisar otorgamiento" }));
      const dialog = screen.getByRole("dialog", { name: "Revisar otorgamiento" });
      const aviso = within(dialog).queryByText(
        "Hay cupos con fecha de carga distinta a la fecha solicitada del pedido.",
      );
      if (diferencia) expect(aviso).toBeInTheDocument();
      else expect(aviso).not.toBeInTheDocument();
      const confirmacion = within(dialog).getByRole("button", { name: "Confirmar otorgamiento" });
      expect(confirmacion).toBeEnabled();
      fireEvent.click(confirmacion);
      await screen.findByText(/Se otorgaron 1 cupos/);
      expect(cuerpos[0].pedidoRevision).toBe(pedido.revision);
      const actual = await get<Pagina<Cupo>>(`cupos?${new URLSearchParams(periodoInicial())}`);
      expect(actual.filas[0].fechaCarga).toBe(recepcion.cupos[0].fechaCarga);
      const demanda = await get<Pagina<Pedido>>(`pedidos?${new URLSearchParams(periodoInicial())}`);
      expect(demanda.filas[0].fechaSolicitada).toBe(pedido.fechaSolicitada);
    },
  );
  it("corregir la demanda de un pedido atendido recalcula pendientes y estado; el replay conserva su resultado", async () => {
    const recepcion = await recibir(1);
    const pedido = await pedir(1);
    const asignacion = await post<OtorgarResultado>("otorgamientos", {
      destinatarioTipo: "cliente",
      clienteNumero: pedido.clienteNumero,
      pedidoId: pedido.id,
      pedidoRevision: pedido.revision,
      cupos: [{ id: recepcion.cupos[0].id, revision: 1 }],
    });
    expect(asignacion.pedido?.estado).toBe("atendido");
    const body = cuerpoCorreccion(asignacion.pedido!, 2);
    const clave = crypto.randomUUID();
    const respuesta = await put(`pedidos/${pedido.id}`, body, clave);
    expect(respuesta.status).toBe(200);
    const corregido = (await respuesta.json()) as Pedido;
    expect(corregido).toMatchObject({
      revision: asignacion.pedido!.revision + 1,
      otorgados: 1,
      pendientes: 1,
      cantidadCupos: 2,
      estado: "parcial",
      clienteNombre: null,
    });
    const pendientes = await get<Pagina<Pedido>>(
      `pedidos?${new URLSearchParams({ ...periodoInicial(), soloPendientes: "true" })}`,
    );
    expect(pendientes.filas[0]).toMatchObject({ id: pedido.id, estado: "parcial", pendientes: 1 });
    expect((await put(`pedidos/${pedido.id}`, cuerpoCorreccion(corregido, 3))).status).toBe(200);
    const historiaAntes = await get<Pagina<Evento>>(`pedidos/${pedido.id}/historial`);
    const replay = await put(`pedidos/${pedido.id}`, body, clave);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(corregido);
    expect((await get<Pagina<Evento>>(`pedidos/${pedido.id}/historial`)).filas).toEqual(
      historiaAntes.filas,
    );
    const actual = await get<Pagina<Pedido>>(`pedidos?${new URLSearchParams(periodoInicial())}`);
    expect(actual.filas[0]).toMatchObject({
      revision: corregido.revision + 1,
      cantidadCupos: 3,
      otorgados: 1,
      pendientes: 2,
      estado: "parcial",
    });
  });
  it.each([
    { caso: "cantidad insuficiente", cambios: { cantidadCupos: 1 } },
    { caso: "cliente", cambios: { clienteNumero: 1 } },
    { caso: "producto", cambios: { producto: 1 } },
    { caso: "campaña", cambios: { campania: "2026-2027" } },
    { caso: "preventa", cambios: { preventa: { operacion: "PF", numero: "PF-DEMO/1" } } },
  ])(
    "rechaza corrección de $caso con asignaciones vigentes sin efectos parciales",
    async ({ cambios }) => {
      const recepcion = await recibir(2);
      const pedido = await pedir(2);
      const asignacion = await post<OtorgarResultado>("otorgamientos", {
        destinatarioTipo: "cliente",
        clienteNumero: pedido.clienteNumero,
        pedidoId: pedido.id,
        pedidoRevision: pedido.revision,
        cupos: recepcion.cupos.map((c) => ({ id: c.id, revision: c.revision })),
      });
      const rutas = [
        `pedidos?${new URLSearchParams(periodoInicial())}`,
        `pedidos/${pedido.id}/historial`,
        `cupos?${new URLSearchParams(periodoInicial())}`,
        ...recepcion.cupos.map((c) => `cupos/${c.id}/historial`),
      ];
      const antes = await Promise.all(rutas.map((ruta) => get<Pagina<unknown>>(ruta)));
      const respuesta = await put(`pedidos/${pedido.id}`, {
        ...cuerpoCorreccion(asignacion.pedido!),
        ...cambios,
      });
      expect(respuesta.status).toBe(409);
      expect(await respuesta.json()).toMatchObject({
        detail: expect.stringContaining("otorgamientos vigentes"),
      });
      const despues = await Promise.all(rutas.map((ruta) => get<Pagina<unknown>>(ruta)));
      expect(despues.map((pagina) => pagina.filas)).toEqual(antes.map((pagina) => pagina.filas));
      const valida = await put(`pedidos/${pedido.id}`, cuerpoCorreccion(asignacion.pedido!, 3));
      expect(valida.status).toBe(200);
      expect(await valida.json()).toMatchObject({
        revision: asignacion.pedido!.revision + 1,
        otorgados: 2,
        pendientes: 1,
        estado: "parcial",
      });
    },
  );
  it("otorga a un pedido sin preventa con revisiones reales y actualiza cantidades, asignación e historia", async () => {
    const recepcion = await recibir();
    const pedido = await pedir();
    const cuerpos: OtorgarBody[] = [];
    capturaPost(cuerpos);
    mostrar();
    await abrir();
    const demanda = screen.getByRole("table", { name: "Pedidos pendientes de otorgamiento" });
    expect(await within(demanda).findByText("Sin preventa")).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("radio", { name: "Elegir pedido de Productor ficticio" }),
    );
    await elegirCupo();
    fireEvent.click(screen.getByRole("button", { name: "Revisar otorgamiento" }));
    const revisar = screen.getByRole("dialog", { name: "Revisar otorgamiento" });
    expect(within(revisar).getByRole("table", { name: "Cupos a otorgar" })).toBeInTheDocument();
    expect(within(revisar).getAllByText("30.000 kg")).toHaveLength(1);
    fireEvent.click(within(revisar).getByRole("button", { name: "Confirmar otorgamiento" }));
    await screen.findByText(
      "Se otorgaron 1 cupos. La asignación y los pendientes están actualizados.",
    );
    expect(cuerpos[0]).toEqual({
      destinatarioTipo: "cliente",
      clienteNumero: pedido.clienteNumero,
      pedidoId: pedido.id,
      pedidoRevision: pedido.revision,
      cupos: [{ id: recepcion.cupos[0].id, revision: 1 }],
    });
    await waitFor(() => expect(within(demanda).getByText("2")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "Cupos recibidos" }));
    const recibidos = screen.getByRole("table", { name: "Cupos recibidos" });
    expect(await within(recibidos).findByText("Productor ficticio")).toBeInTheDocument();
    expect(within(recibidos).getAllByText("por iniciar")).toHaveLength(2);
    expect(within(recibidos).getAllByRole("button", { name: "Otorgar a" })).toHaveLength(1);
    const asignado = within(recibidos).getByText("Productor ficticio").closest("tr")!;
    fireEvent.click(within(asignado).getByRole("button", { name: "Historial" }));
    await screen.findByText("cupo otorgado");
    fireEvent.click(screen.getAllByText("Ver datos registrados")[1]);
    expect(screen.getByText("Tipo de destinatario")).toBeInTheDocument();
    expect(screen.getByText("Fecha de asignación")).toBeInTheDocument();
    expect(screen.getByText("30.000 kg")).toBeInTheDocument();
    expect(screen.queryByText(recepcion.cupos[0].id)).not.toBeInTheDocument();
  });
  it("otorga un lote propio con días, destinos y código pendiente como avisos", async () => {
    const recepcion = await recibir(2, sumarDias(hoy(), -1));
    const cuerpos: OtorgarBody[] = [];
    capturaPost(cuerpos);
    mostrar();
    await abrir();
    fireEvent.click(screen.getByRole("radio", { name: "Propio" }));
    await elegirCupo();
    await elegirCupo(2);
    expect(screen.getByText("2 cupos seleccionados")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revisar otorgamiento" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("60.000 kg")).toBeInTheDocument();
    expect(within(dialog).getByText("Hay cupos con fecha de carga pasada.")).toBeInTheDocument();
    expect(within(dialog).getByText("Las fechas de carga son distintas.")).toBeInTheDocument();
    expect(within(dialog).getByText("Los destinos son distintos.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar otorgamiento" }));
    await screen.findByText(/Se otorgaron 2 cupos/);
    expect(cuerpos[0]).toEqual({
      destinatarioTipo: "propio",
      cupos: recepcion.cupos.map((c) => ({ id: c.id, revision: 1 })),
    });
    const actual = await get<Pagina<Cupo>>(`cupos?${new URLSearchParams(periodoInicial())}`);
    expect(
      actual.filas.every(
        (c) =>
          c.revision === 2 &&
          !c.disponibleParaOtorgar &&
          c.estadoObservado === "por_iniciar" &&
          c.otorgamientoVigente?.destinatarioTipo === "propio",
      ),
    ).toBe(true);
  });
  it.each([false, true])(
    "permite cliente sin pedido, con preventa opcional=%s filtrada antes de paginar",
    async (conPreventa) => {
      await recibir(1);
      const cuerpos: OtorgarBody[] = [];
      const consultas: URL[] = [];
      capturaPost(cuerpos);
      server.use(
        http.get(`${API}/preventas`, ({ request }) => {
          consultas.push(new URL(request.url));
        }),
      );
      mostrar();
      await abrir();
      fireEvent.click(screen.getByRole("radio", { name: "Cliente sin pedido" }));
      await elegirCupo();
      await elegirCatalogo("Productor destinatario", "9000000001", "Productor ficticio (9000000001)");
      if (conPreventa) {
        fireEvent.click(screen.getByRole("checkbox", { name: "Asociar una preventa (opcional)" }));
        fireEvent.click(await screen.findByRole("radio", { name: "Elegir preventa PF-DEMO/1" }));
        expect(consultas[0].searchParams.get("clienteNumero")).toBe("9000000001");
        expect(consultas[0].searchParams.get("producto")).toBe("10");
        expect(consultas[0].searchParams.get("campania")).toBe("20252026");
      }
      await confirmar();
      expect(cuerpos[0]).toMatchObject({ destinatarioTipo: "cliente", clienteNumero: 9000000001 });
      expect(cuerpos[0].pedidoId).toBeUndefined();
      expect(cuerpos[0].preventa).toEqual(
        conPreventa ? { operacion: "PF", numero: "PF-DEMO/1" } : undefined,
      );
    },
  );
  it("impide mezclar cereal/campaña, cupos no elegibles y superar pendientes; conserva selección ante refetch", async () => {
    const recepcion = await recibir(2);
    await pedir(1);
    const filas = [
      recepcion.cupos[0],
      { ...recepcion.cupos[1], id: crypto.randomUUID(), contratoVenta: "OTRO", producto: 1 },
      {
        ...recepcion.cupos[1],
        id: crypto.randomUUID(),
        contratoVenta: "ANULADO",
        seguimientoAnulado: true,
        disponibleParaOtorgar: false,
      },
      {
        ...recepcion.cupos[1],
        id: crypto.randomUUID(),
        contratoVenta: "ERP",
        tieneVinculoErpVigente: true,
        disponibleParaOtorgar: false,
      },
      {
        ...recepcion.cupos[1],
        id: crypto.randomUUID(),
        contratoVenta: "OTRA-CAMPANIA",
        campania: "2026-2027",
      },
      recepcion.cupos[1],
    ];
    server.use(
      http.get(`${API}/cupos`, () =>
        HttpResponse.json({ filas, hayMas: false, datosAl: new Date().toISOString() }),
      ),
    );
    const client = mostrar();
    await abrir();
    await elegirCupo();
    expect(screen.getByRole("checkbox", { name: "Elegir cupo OTRO fila 2" })).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: "Elegir cupo OTRA-CAMPANIA fila 2" }),
    ).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Elegir cupo ANULADO fila 2" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Elegir cupo ERP fila 2" })).toBeDisabled();
    await client.invalidateQueries({ queryKey: ["logistica", "cupos"] });
    expect(screen.getByRole("checkbox", { name: "Elegir cupo V-DEMO/1 fila 1" })).toBeChecked();
    fireEvent.click(
      await screen.findByRole("radio", { name: "Elegir pedido de Productor ficticio" }),
    );
    expect(
      await screen.findByRole("checkbox", { name: "Elegir cupo V-DEMO/1 fila 2" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Revisar otorgamiento" })).toBeEnabled();
  });
  it("un 409 de otro operador refresca y limpia selección y revisión, sin elegir otra fila", async () => {
    const recepcion = await recibir();
    const pedido = await pedir();
    let cambió = false;
    const consultas: string[] = [];
    server.use(
      http.post(`${API}/otorgamientos`, () => {
        cambió = true;
        return HttpResponse.json({ status: 409, detail: "Un cupo cambió." }, { status: 409 });
      }),
      http.get(`${API}/cupos`, ({ request }) => {
        consultas.push(request.url);
        return HttpResponse.json({
          filas: cambió ? [recepcion.cupos[1]] : recepcion.cupos,
          hayMas: false,
          datosAl: new Date().toISOString(),
        });
      }),
      http.get(`${API}/pedidos`, () =>
        HttpResponse.json({
          filas: [
            {
              ...pedido,
              clienteNombre: "Productor ficticio",
              revision: cambió ? 2 : 1,
              otorgados: cambió ? 1 : 0,
              pendientes: cambió ? 2 : 3,
            },
          ],
          hayMas: false,
          datosAl: new Date().toISOString(),
        }),
      ),
    );
    mostrar();
    await abrir();
    fireEvent.click(
      await screen.findByRole("radio", { name: "Elegir pedido de Productor ficticio" }),
    );
    await elegirCupo();
    fireEvent.click(screen.getByRole("button", { name: "Revisar otorgamiento" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar otorgamiento" }));
    await screen.findByText(/Otro operador cambió los datos/);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("0 cupos seleccionados")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("checkbox", { name: "Elegir cupo V-DEMO/1 fila 1" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("checkbox", { name: "Elegir cupo V-DEMO/1 fila 2" })).not.toBeChecked();
    expect(consultas.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: "Revisar otorgamiento" })).toBeDisabled();
  });
  it.each(["red", "503"])(
    "una respuesta incierta (%s) bloquea Escape/overlay/navegación y reintenta el mismo cuerpo y clave sin duplicar",
    async (fallo) => {
      const recepcion = await recibir(1);
      const cuerpos: OtorgarBody[] = [];
      const claves: string[] = [];
      let resultado: OtorgarResultado | null = null;
      let operaciones = 0;
      server.use(
        http.post(`${API}/otorgamientos`, async ({ request }) => {
          const body = (await request.json()) as OtorgarBody;
          cuerpos.push(body);
          claves.push(request.headers.get("Idempotency-Key") ?? "");
          if (!resultado) {
            operaciones++;
            resultado = {
              otorgamientos: [
                {
                  id: crypto.randomUUID(),
                  revision: 1,
                  cupoId: recepcion.cupos[0].id,
                  pedidoId: null,
                  destinatarioTipo: "propio",
                  clienteNumero: null,
                  clienteNombre: null,
                  preventa: null,
                  kgEstimados: 30000,
                  vigenteDesde: new Date().toISOString(),
                },
              ],
              cupos: [],
              pedido: null,
              advertencias: [],
            };
            return fallo === "red"
              ? HttpResponse.error()
              : HttpResponse.json(
                  { status: 503, detail: "Respuesta interrumpida" },
                  { status: 503 },
                );
          }
          return HttpResponse.json(resultado);
        }),
      );
      const { router } = mostrarConRutas();
      await abrir();
      fireEvent.click(screen.getByRole("radio", { name: "Propio" }));
      await elegirCupo();
      fireEvent.click(screen.getByRole("button", { name: "Revisar otorgamiento" }));
      fireEvent.click(screen.getByRole("button", { name: "Confirmar otorgamiento" }));
      await screen.findByRole("button", { name: "Reintentar operación" });
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
      expect(screen.getByRole("radio", { name: "Propio" })).toBeDisabled();
      fireEvent.keyDown(document, { key: "Escape" });
      fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
      const dialog = screen.getByRole("dialog");
      fireEvent.click(dialog.parentElement!.querySelector('[aria-hidden="true"]')!);
      fireEvent.click(screen.getByRole("tab", { name: "Cupos recibidos" }));
      expect(screen.getByRole("dialog", { name: "Revisar otorgamiento" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Otorgar" })).toHaveAttribute("aria-selected", "true");
      fireEvent.click(screen.getByRole("link", { name: "Ir a otra página" }));
      await screen.findByText(
        "Confirmá el resultado del otorgamiento antes de salir de esta página.",
      );
      expect(router.state.location.pathname).toBe("/logistica/cupos");
      await act(async () => {
        await router.navigate(-1);
      });
      expect(router.state.location.pathname).toBe("/logistica/cupos");
      expect(screen.queryByText("Página anterior")).not.toBeInTheDocument();
      const descarga = new Event("beforeunload", { cancelable: true });
      expect(window.dispatchEvent(descarga)).toBe(false);
      expect(descarga.defaultPrevented).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Reintentar operación" }));
      await screen.findByText(/Se otorgaron 1 cupos/);
      expect(cuerpos).toHaveLength(2);
      expect(cuerpos[0]).toEqual(cuerpos[1]);
      expect(claves[0]).toBe(claves[1]);
      expect(operaciones).toBe(1);
      expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true);
    },
  );
  it("lectura puede consultar las dos tablas y asignaciones sin acciones de otorgar", async () => {
    await recibir(1);
    await pedir();
    sesion.roles = ["logistica-lectura"];
    mostrar();
    await abrir();
    await screen.findByText("Productor ficticio");
    expect(
      screen.getByRole("table", { name: "Cupos disponibles para otorgar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Pedidos pendientes de otorgamiento" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revisar otorgamiento" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Cupos recibidos" }));
    await screen.findByText("Sin asignar");
    expect(screen.queryByRole("button", { name: "Otorgar a" })).not.toBeInTheDocument();
  });
  it("acceso directo incluye el día del cupo aunque fuera del rango inicial y conserva su revisión", async () => {
    const recepcion = await recibir(1, sumarDias(hoy(), -20));
    const cupo = { ...recepcion.cupos[0], revision: 7 };
    const cuerpos: OtorgarBody[] = [];
    const consultas: URL[] = [];
    server.use(
      http.get(`${API}/cupos`, ({ request }) => {
        consultas.push(new URL(request.url));
        return HttpResponse.json({
          filas: [cupo],
          hayMas: false,
          datosAl: new Date().toISOString(),
        });
      }),
      http.post(`${API}/otorgamientos`, async ({ request }) => {
        cuerpos.push((await request.json()) as OtorgarBody);
        return HttpResponse.json({
          otorgamientos: [{ id: "ficticio" }],
          cupos: [],
          pedido: null,
          advertencias: [],
        });
      }),
    );
    mostrar();
    fireEvent.click(screen.getByRole("tab", { name: "Cupos recibidos" }));
    fireEvent.click(await screen.findByRole("button", { name: "Otorgar a" }));
    expect(screen.getByText("1 cupos seleccionados")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Propio" }));
    await confirmar();
    expect(consultas[1].searchParams.get("desde")).toBe(cupo.fechaCarga);
    expect(cuerpos[0].cupos).toEqual([{ id: cupo.id, revision: 7 }]);
  });
  it("aplica filtros por recurso antes de paginar, resetea cursores y habilita cliente número 1", async () => {
    const recepcion = await recibir(2);
    await pedir();
    const consultas: URL[] = [];
    server.use(
      http.get(`${API}/cupos`, ({ request }) => {
        const url = new URL(request.url);
        consultas.push(url);
        const siguientes = url.searchParams.has("despuesId");
        return HttpResponse.json({
          filas: [recepcion.cupos[siguientes ? 1 : 0]],
          hayMas: !siguientes,
          datosAl: new Date().toISOString(),
        });
      }),
      http.get(`${API}/pedidos`, ({ request }) => {
        consultas.push(new URL(request.url));
      }),
    );
    mostrar();
    await abrir();
    const tabla = screen.getByRole("table", { name: "Cupos disponibles para otorgar" });
    fireEvent.click(
      await within(tabla.closest("section")!).findByRole("button", { name: "Cargar más filas" }),
    );
    await screen.findByRole("checkbox", { name: "Elegir cupo V-DEMO/1 fila 2" });
    expect(
      consultas.find((u) => u.searchParams.has("despuesId"))?.searchParams.get("despuesId"),
    ).toBe(recepcion.cupos[0].id);
    await elegirCupo();
    await elegirCatalogo("Cereal", "10", "Soja (10)");
    fireEvent.change(screen.getByLabelText("Campaña"), { target: { value: "2025-2026" } });
    await elegirCatalogo("Destino de los cupos", "101", "Terminal de ejemplo (101)");
    fireEvent.change(screen.getByLabelText("Circuito de los cupos"), {
      target: { value: "directa" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() =>
      expect(consultas.some((u) => u.searchParams.get("destinoCodigo") === "101")).toBe(true),
    );
    const cupos = consultas.find((u) => u.searchParams.get("destinoCodigo") === "101")!;
    const pedidos = consultas.find(
      (u) => u.pathname.endsWith("pedidos") && u.searchParams.get("producto") === "10",
    )!;
    expect(cupos.searchParams.get("campania")).toBe("2025-2026");
    expect(cupos.searchParams.get("circuito")).toBe("directa");
    expect(cupos.searchParams.has("despuesId")).toBe(false);
    expect(cupos.searchParams.get("soloDisponibles")).toBe("true");
    expect(pedidos.searchParams.get("soloPendientes")).toBe("true");
    expect(pedidos.searchParams.has("destinoCodigo")).toBe(false);
    expect(pedidos.searchParams.has("circuito")).toBe(false);
    expect(screen.getByText("0 cupos seleccionados")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Cliente sin pedido" }));
    await elegirCatalogo("Productor destinatario", "1", "Cliente de prueba uno (1)");
    await elegirCupo();
    await confirmar();
    expect(
      screen.queryByText("Escribí un código positivo o al menos dos letras."),
    ).not.toBeInTheDocument();
  });
  it("el demo devuelve el replay original con revisiones viejas y no duplica otorgamientos", async () => {
    const recepcion = await recibir(1);
    const pedido = await pedir(1);
    const clave = crypto.randomUUID();
    const body: OtorgarBody = {
      destinatarioTipo: "cliente",
      clienteNumero: pedido.clienteNumero,
      pedidoId: pedido.id,
      pedidoRevision: 1,
      cupos: [{ id: recepcion.cupos[0].id, revision: 1 }],
    };
    const original = await post<OtorgarResultado>("otorgamientos", body, clave);
    const replay = await post<OtorgarResultado>("otorgamientos", body, clave);
    expect(replay).toEqual(original);
    expect(original.pedido?.revision).toBe(2);
    expect(original.pedido?.estado).toBe("atendido");
    expect(pedido.clienteNombre).toBeNull();
    expect(pedido.productoNombre).toBeNull();
    expect(original.pedido?.clienteNombre).toBeNull();
    expect(original.pedido?.productoNombre).toBeNull();
    expect(replay.pedido?.clienteNombre).toBeNull();
    const pedidosActuales = await get<Pagina<Pedido>>(
      `pedidos?${new URLSearchParams(periodoInicial())}`,
    );
    expect(pedidosActuales.filas[0].clienteNombre).toBe("Productor ficticio");
    expect(pedidosActuales.filas[0].productoNombre).toBe("Soja");
    const actual = await get<Pagina<Cupo>>(`cupos?${new URLSearchParams(periodoInicial())}`);
    expect(actual.filas[0].revision).toBe(2);
    expect(actual.filas[0].otorgamientoVigente?.id).toBe(original.otorgamientos[0].id);
    expect(actual.filas[0].otorgamientoVigente?.clienteNombre).toBe("Productor ficticio");
    expect(original.otorgamientos[0].clienteNombre).toBeNull();
    const changed = await fetch(`${API}/otorgamientos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": clave },
      body: JSON.stringify({ ...body, destinatarioTipo: "propio" }),
    });
    expect(changed.status).toBe(409);
  });
  it("impide seleccionar más de 200 cupos por operación", async () => {
    const recepcion = await recibir(1);
    const filas = Array.from({ length: 201 }, (_, i) => ({
      ...recepcion.cupos[0],
      id: crypto.randomUUID(),
      ordinal: i + 1,
    }));
    server.use(
      http.get(`${API}/cupos`, () =>
        HttpResponse.json({ filas, hayMas: false, datosAl: new Date().toISOString() }),
      ),
    );
    mostrar();
    await abrir();
    fireEvent.click(screen.getByRole("radio", { name: "Propio" }));
    const opciones = await screen.findAllByRole("checkbox", { name: /Elegir cupo/ });
    opciones.slice(0, 200).forEach((opcion) => fireEvent.click(opcion));
    expect(opciones[200]).toBeDisabled();
    expect(screen.getByText("200 cupos seleccionados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revisar otorgamiento" })).toBeEnabled();
  }, 60000); // 200 interacciones de tabla en jsdom; timeout acotado sólo a este caso de volumen.
  // 60 s y no 30: con la suite entera en paralelo este caso tardó 39 s y se cortaba solo.
  it("el demo filtra destinos antes del límite de página y admite códigos numéricos", async () => {
    await post<Recepcion>("cupos/recepciones", {
      contratoVenta: "V-DEMO/1",
      solicitudId: null,
      referencia: "Lote ficticio",
      recibidoAl: `${hoy()}T12:00:00`,
      filas: Array.from({ length: 51 }, (_, i) => ({
        ordinal: i + 1,
        fechaCarga: hoy(),
        destinoCodigo: i === 50 ? 102 : 101,
        codigoTerminal: null,
        circuito: "directa",
        lugarTipo: "planta",
        lugarReferencia: null,
      })),
    });
    const pagina = await get<Pagina<Cupo>>(
      `cupos?${new URLSearchParams({ ...periodoInicial(), destinoCodigo: "102", soloDisponibles: "true", tamano: "1" })}`,
    );
    expect(pagina.filas).toHaveLength(1);
    expect(pagina.filas[0].ordinal).toBe(51);
    expect(pagina.hayMas).toBe(false);
    const clientes = await get<Pagina<{ codigo: number }>>("catalogos/clientes?buscar=1");
    expect(clientes.filas.map((c) => c.codigo)).toEqual([1]);
  });
  it("el historial de un lote etiqueta cantidades de asignación sin mostrar UUIDs", () => {
    const id = crypto.randomUUID();
    const campos = camposHistorial(
      JSON.stringify({
        pedidoId: id,
        cupos: [{ id, revision: 2 }],
        otorgamientos: [id],
        otorgados: 1,
        pendientes: 2,
      }),
    );
    expect(campos).toContainEqual({
      campo: "Cupos asignados",
      anterior: "Sin dato",
      nuevo: "1 cupos",
    });
    expect(JSON.stringify(campos)).not.toContain(id);
    expect(campos.some((c) => c.campo === "Cupos de la tanda")).toBe(false);
  });
  it("permite cancelar la revisión antes de enviar y libera la navegación de ruta", async () => {
    await recibir(1);
    const { router } = mostrarConRutas();
    await abrir();
    fireEvent.click(screen.getByRole("radio", { name: "Propio" }));
    await elegirCupo();
    fireEvent.click(screen.getByRole("button", { name: "Revisar otorgamiento" }));
    fireEvent.click(screen.getByRole("link", { name: "Ir a otra página" }));
    await screen.findByText("Cerrá la revisión para salir de esta página.");
    expect(router.state.location.pathname).toBe("/logistica/cupos");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Ir a otra página" }));
    await screen.findByText("Página de salida");
    expect(router.state.location.pathname).toBe("/salida");
  });
  it("volver a filtros previos y cambiar modo o destinatario reinicia ambas páginas sin descartar cupos compatibles", async () => {
    const recepcion = await recibir(2);
    const pedido = await pedir();
    const otroPedido = {
      ...pedido,
      id: crypto.randomUUID(),
      clienteNombre: "Otro productor ficticio",
      fechaSolicitada: sumarDias(hoy(), 1),
    };
    const consultas: URL[] = [];
    server.use(
      http.get(`${API}/cupos`, ({ request }) => {
        const url = new URL(request.url);
        consultas.push(url);
        const otraPagina = url.searchParams.has("despuesId");
        return HttpResponse.json({
          filas:
            url.searchParams.get("producto") === "1" ? [] : [recepcion.cupos[otraPagina ? 1 : 0]],
          hayMas: url.searchParams.get("producto") !== "1" && !otraPagina,
          datosAl: new Date().toISOString(),
        });
      }),
      http.get(`${API}/pedidos`, ({ request }) => {
        const url = new URL(request.url);
        consultas.push(url);
        const otraPagina = url.searchParams.has("despuesId");
        return HttpResponse.json({
          filas:
            url.searchParams.get("producto") === "1"
              ? []
              : [otraPagina ? otroPedido : { ...pedido, clienteNombre: "Productor ficticio" }],
          hayMas: url.searchParams.get("producto") !== "1" && !otraPagina,
          datosAl: new Date().toISOString(),
        });
      }),
    );
    mostrar();
    await abrir();
    const cargarSegundas = async () => {
      for (const titulo of [
        "Cupos disponibles para otorgar",
        "Pedidos pendientes de otorgamiento",
      ]) {
        const tabla = screen.getByRole("table", { name: titulo });
        fireEvent.click(
          await within(tabla.closest("section")!).findByRole("button", {
            name: "Cargar más filas",
          }),
        );
      }
      await screen.findByRole("checkbox", { name: "Elegir cupo V-DEMO/1 fila 2" });
      await screen.findByText("Otro productor ficticio");
    };
    const soloPrimeras = async () => {
      await screen.findByRole("checkbox", { name: "Elegir cupo V-DEMO/1 fila 1" });
      await waitFor(() => {
        expect(
          screen.queryByRole("checkbox", { name: "Elegir cupo V-DEMO/1 fila 2" }),
        ).not.toBeInTheDocument();
        expect(screen.queryByText("Otro productor ficticio")).not.toBeInTheDocument();
      });
      for (const ruta of ["cupos", "pedidos"])
        expect(
          consultas
            .filter((u) => u.pathname.endsWith(ruta))
            .at(-1)
            ?.searchParams.has("despuesId"),
        ).toBe(false);
    };
    await cargarSegundas();
    await elegirCatalogo("Cereal", "1", "Maíz (1)");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await screen.findByText("No hay cupos disponibles para estas fechas y filtros.");
    await elegirCatalogo("Cereal", "", "Todos");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await soloPrimeras();
    await cargarSegundas();
    await elegirCupo();
    fireEvent.click(screen.getByRole("radio", { name: "Propio" }));
    await soloPrimeras();
    expect(screen.getByText("1 cupos seleccionados")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Elegir cupo V-DEMO/1 fila 1" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Cliente sin pedido" }));
    await soloPrimeras();
    await cargarSegundas();
    await elegirCatalogo("Productor destinatario", "1", "Cliente de prueba uno (1)");
    await soloPrimeras();
    expect(screen.getByText("1 cupos seleccionados")).toBeInTheDocument();
    await cargarSegundas();
    fireEvent.click(screen.getByRole("radio", { name: "Pedido" }));
    await soloPrimeras();
    await cargarSegundas();
    fireEvent.click(screen.getByRole("radio", { name: "Elegir pedido de Productor ficticio" }));
    await soloPrimeras();
    expect(screen.getByRole("button", { name: "Revisar otorgamiento" })).toBeEnabled();
  });
  it("muestra la asignación del instante UTC en fecha argentina, manteniendo fechas de carga DateOnly", async () => {
    const recepcion = await recibir(1);
    const instante = "2026-10-03T00:33:09Z";
    const cupo: Cupo = {
      ...recepcion.cupos[0],
      fechaCarga: "2026-10-03",
      disponibleParaOtorgar: false,
      otorgamientoVigente: {
        id: crypto.randomUUID(),
        revision: 1,
        cupoId: recepcion.cupos[0].id,
        pedidoId: null,
        destinatarioTipo: "propio",
        clienteNumero: null,
        clienteNombre: null,
        preventa: null,
        kgEstimados: 30000,
        vigenteDesde: instante,
      },
    };
    server.use(
      http.get(`${API}/cupos`, () =>
        HttpResponse.json({ filas: [cupo], hayMas: false, datosAl: instante }),
      ),
      http.get(`${API}/cupos/:id/historial`, () =>
        HttpResponse.json({
          filas: [
            {
              id: crypto.randomUUID(),
              revision: 2,
              tipo: "cupo_otorgado",
              datos: JSON.stringify(cupo.otorgamientoVigente),
              registradoAl: instante,
              registradoPorId: 1,
              motivo: null,
            },
          ],
          hayMas: false,
          datosAl: instante,
        }),
      ),
    );
    expect(fechaInstanteArgentina(instante)).toBe("02/10/2026");
    expect(fecha("2026-10-03")).toBe("03/10/2026");
    mostrar();
    fireEvent.click(screen.getByRole("tab", { name: "Cupos recibidos" }));
    const recibidos = screen.getByRole("table", { name: "Cupos recibidos" });
    expect(
      await within(recibidos).findByText("02/10/2026 · 30.000 kg estimados"),
    ).toBeInTheDocument();
    expect(within(recibidos).getByText("03/10/2026")).toBeInTheDocument();
    fireEvent.click(within(recibidos).getByRole("button", { name: "Historial" }));
    await screen.findByText("cupo otorgado");
    fireEvent.click(screen.getByText("Ver datos registrados"));
    const fila = screen.getByText("Fecha de asignación").closest("tr")!;
    expect(within(fila).getByText("02/10/2026")).toBeInTheDocument();
    expect(within(fila).queryByText("03/10/2026")).not.toBeInTheDocument();
  });
});
