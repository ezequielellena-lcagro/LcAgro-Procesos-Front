import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { getResponse, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { setTokenBridge } from "@/lib/api-client";
import { env } from "@/lib/env";
import { logisticaHandlers, resetLogisticaDemo } from "@/mocks/handlers/logistica";
import { fechaHoraArgentina, hoy, sumarDias } from "../format";
import { useOperacion } from "../queries/use-logistica";
import type { Recepcion, ResumenLogistica, Seguimiento, Solicitud, Detalle } from "../types";
import { CuposPage } from "./cupos-page";
const sesion = vi.hoisted(() => ({ roles: ["logistica-cupos"] }));
vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: 7, roles: sesion.roles } }),
}));
const API = `${env.apiUrl}/logistica`;
const server = setupServer(...logisticaHandlers);
const routers: ReturnType<typeof createMemoryRouter>[] = [];
const clients: QueryClient[] = [];
const consultas: URL[] = [];
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/logistica/resumen")) consultas.push(url);
  });
});
beforeEach(() =>
  setTokenBridge({
    getAccessToken: () => "mock-access-7",
    refresh: async () => null,
    onAuthFailure: () => {},
  }),
);
afterEach(() => {
  cleanup();
  routers.splice(0).forEach((r) => r.dispose());
  clients.splice(0).forEach((c) => c.clear());
  server.resetHandlers();
  resetLogisticaDemo();
  consultas.length = 0;
  vi.restoreAllMocks();
  setTokenBridge({
    getAccessToken: () => null,
    refresh: async () => null,
    onAuthFailure: () => {},
  });
});
afterAll(() => {
  server.close();
  server.events.removeAllListeners();
});
async function enviar<T>(ruta: string, body: object) {
  const r = await fetch(`${API}/${ruta}`, {
    method: "POST",
    headers: {
      Authorization: "Bearer mock-access-7",
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
  expect(r.ok).toBe(true);
  return (await r.json()) as T;
}
async function solicitar(cantidadCupos = 5, destinoCodigo = 101, fechaSolicitada = hoy()) {
  return enviar<Solicitud>("solicitudes-terminal", {
    contratoVenta: "V-DEMO/1",
    cantidadCupos,
    destinoCodigo,
    fechaSolicitada,
    canal: "terminal",
    observacion: null,
  });
}
async function responder(s: Solicitud, cantidadCupos: number) {
  return enviar<Solicitud>(`solicitudes-terminal/${s.id}/respuestas`, {
    revision: s.revision,
    cantidadCupos,
    observadoAl: `${hoy()}T12:00:00Z`,
    referencia: "Respuesta ficticia",
  });
}
async function recibir(solicitudId: string | null, n = 1, diferente = false) {
  return enviar<Recepcion>("cupos/recepciones", {
    contratoVenta: "V-DEMO/1",
    solicitudId,
    referencia: "Recepción ficticia",
    recibidoAl: new Date().toISOString(),
    filas: Array.from({ length: n }, (_, i) => ({
      ordinal: i + 1,
      fechaCarga: diferente ? sumarDias(hoy(), 40) : hoy(),
      destinoCodigo: diferente ? 102 : 101,
      codigoTerminal: null,
      circuito: "directa",
      lugarTipo: "planta",
      lugarReferencia: null,
    })),
  });
}
function mostrar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 }, mutations: { retry: false } },
  });
  clients.push(client);
  const router = createMemoryRouter([{ path: "/", element: <CuposPage /> }]);
  routers.push(router);
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return client;
}
async function abrirResumen() {
  fireEvent.click(screen.getByRole("tab", { name: "Resumen" }));
  await screen.findByRole("table", { name: "Totales del resumen" });
  await waitFor(() => expect(screen.queryByText("Consultando resumen…")).not.toBeInTheDocument());
}
function tabla() {
  return screen.getByRole("table", { name: "Totales del resumen" });
}
function celda(titulo: string, table = tabla()) {
  const encabezados = within(table).getAllByRole("columnheader");
  const index = encabezados.findIndex((h) => h.textContent === titulo);
  return within(table).getAllByRole("row")[1].children[index];
}
async function grupos(n = 51) {
  for (let i = 0; i < n; i++) await solicitar(i + 1, 101 + i);
}
async function siguiente() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await waitFor(() => expect(screen.queryByText("Consultando resumen…")).not.toBeInTheDocument());
}
describe("Resumen de Cupos", () => {
  it("aparece primero, conserva entrada por Solicitudes y consulta sólo al activar Resumen", async () => {
    mostrar();
    expect(screen.getAllByRole("tab")[0]).toHaveTextContent("Resumen");
    expect(screen.getByRole("tab", { name: "Solicitudes a terminal" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await screen.findByText(/Todavía no hay solicitudes/);
    expect(consultas).toHaveLength(0);
    await abrirResumen();
    expect(consultas).toHaveLength(1);
  });
  it("vacío muestra unidades, alcance, ausencia y filtros solicitados; permite abrir Recibidos", async () => {
    mostrar();
    await abrirResumen();
    expect(
      screen.getByLabelText("Fecha para la que se pidieron los cupos: desde"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Terminal solicitada")).toBeInTheDocument();
    expect(screen.queryByLabelText("Circuito")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Productor/)).not.toBeInTheDocument();
    expect(celda("Respuesta vigente")).toHaveTextContent("Sin respuesta");
    expect(celda("Por recibir")).toHaveTextContent("Sin respuesta");
    expect(screen.getByText("No hay solicitudes para estas fechas y filtros.")).toBeInTheDocument();
    expect(screen.getByText(/Cantidades de cupos/)).toBeInTheDocument();
    expect(screen.getByText(/Las recepciones sin solicitud/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Ver cupos recibidos" }));
    expect(screen.getByRole("tab", { name: "Cupos recibidos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
  it("distingue parcial conocido, cero, sin respuesta, cerradas y subsets recibidos con códigos de fallback", async () => {
    const a = await responder(await solicitar(5), 3);
    await responder(await solicitar(8), 0);
    await solicitar(9);
    await enviar(`solicitudes-terminal/${a.id}/cerrar`, {
      revision: a.revision,
      motivo: "Cierre ficticio",
    });
    const rec = await recibir(a.id, 2, true);
    const seg = (await (
      await fetch(`${API}/seguimientos/${rec.cupos[0].id}`, {
        headers: { Authorization: "Bearer mock-access-7" },
      })
    ).json()) as Detalle<Seguimiento>;
    await enviar(`seguimientos/${rec.cupos[0].id}/anular`, {
      revision: seg.dato.revision,
      motivo: "Anulación ficticia",
    });
    await solicitar(4, 999);
    mostrar();
    await abrirResumen();
    expect(celda("Solicitudes")).toHaveTextContent("1 cerradas");
    expect(celda("Solicitados")).toHaveTextContent("26");
    expect(celda("Respuesta vigente")).toHaveTextContent("3");
    expect(celda("Respuesta vigente")).toHaveTextContent("2 solicitudes sin respuesta");
    expect(celda("Respuesta vigente")).toHaveTextContent("1 solicitud con respuesta cero");
    expect(celda("Por recibir")).toHaveTextContent("1Parcial: 2 solicitudes sin respuesta");
    expect(celda("Por otorgar")).toHaveTextContent("1Disponibles");
    expect(celda("Otros sin otorgar")).toHaveTextContent("1No disponibles");
    expect(celda("Anulados")).toHaveTextContent("1");
    expect(celda("Carga con otra fecha")).toHaveTextContent("2");
    expect(celda("Recepción en otra terminal")).toHaveTextContent("2");
    expect(screen.getByText(/pueden coincidir entre sí/)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Grupos del resumen" });
    expect(within(table).getByText("999")).toBeInTheDocument();
    expect(within(table).getAllByText("Soja / 2025-2026")).toHaveLength(2);
  });
  it("respuesta cero se presenta como cero y no como ausencia", async () => {
    await responder(await solicitar(), 0);
    mostrar();
    await abrirResumen();
    expect(celda("Respuesta vigente")).toHaveTextContent("0");
    expect(celda("Respuesta vigente")).toHaveTextContent("1 solicitud con respuesta cero");
    expect(celda("Respuesta vigente")).not.toHaveTextContent("Sin respuesta");
    expect(celda("Por recibir")).toHaveTextContent("0");
  });
  it("mantiene filtros en borrador hasta aplicar y conserva criterios aplicados en navegación", async () => {
    await grupos();
    mostrar();
    await abrirResumen();
    const cantidad = consultas.length;
    fireEvent.change(screen.getByLabelText("Contrato"), { target: { value: "V-DEMO/1" } });
    fireEvent.change(screen.getByLabelText("Campaña"), { target: { value: "2025-2026" } });
    fireEvent.change(screen.getByLabelText("Cereal"), { target: { value: "10" } });
    expect(consultas).toHaveLength(cantidad);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(consultas).toHaveLength(cantidad + 1));
    await waitFor(() => expect(screen.queryByText("Consultando resumen…")).not.toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Contrato"), { target: { value: "BORRADOR" } });
    await siguiente();
    expect(consultas.at(-1)?.searchParams.get("contrato")).toBe("V-DEMO/1");
    expect(consultas.at(-1)?.searchParams.get("producto")).toBe("10");
    expect(consultas.at(-1)?.searchParams.get("campania")).toBe("2025-2026");
  });
  it("filtro de terminal es la solicitada y acepta código conocido sin catálogo", async () => {
    const s = await solicitar(7, 999);
    await recibir(s.id, 1, true);
    await solicitar(11);
    mostrar();
    await abrirResumen();
    fireEvent.change(screen.getByLabelText("Código de terminal solicitada (opcional)"), {
      target: { value: "999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(celda("Solicitados")).toHaveTextContent("7"));
    expect(celda("Recibidos")).toHaveTextContent("1");
    expect(consultas.at(-1)?.searchParams.get("destinoCodigo")).toBe("999");
  });
  it("Aplicar, Consultar y Limpiar reinician cursores y consultan incluso criterios idénticos; limpiar conserva período", async () => {
    await grupos();
    mostrar();
    await abrirResumen();
    const desde = sumarDias(hoy(), -1),
      hasta = sumarDias(hoy(), 2);
    fireEvent.change(screen.getByLabelText("Fecha para la que se pidieron los cupos: desde"), {
      target: { value: desde },
    });
    fireEvent.change(screen.getByLabelText("Hasta inclusive"), { target: { value: hasta } });
    fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
    await waitFor(() => expect(consultas.at(-1)?.searchParams.get("desde")).toBe(desde));
    await waitFor(() => expect(screen.queryByText("Consultando resumen…")).not.toBeInTheDocument());
    for (const accion of [
      "Aplicar filtros",
      "Aplicar filtros",
      "Consultar",
      "Limpiar filtros",
      "Limpiar filtros",
    ]) {
      await siguiente();
      expect(screen.getByText("Página 2")).toBeInTheDocument();
      const antes = consultas.length;
      fireEvent.click(screen.getByRole("button", { name: accion }));
      await waitFor(() => expect(consultas).toHaveLength(antes + 1));
      await waitFor(() =>
        expect(screen.queryByText("Consultando resumen…")).not.toBeInTheDocument(),
      );
      expect(screen.getByText("Página 1")).toBeInTheDocument();
      expect(consultas.at(-1)?.searchParams.has("despuesFecha")).toBe(false);
      expect(consultas.at(-1)?.searchParams.get("desde")).toBe(desde);
      expect(consultas.at(-1)?.searchParams.get("hastaExclusivo")).toBe(sumarDias(hasta, 1));
    }
  });
  it("muestra sólo una página y totales completos del servidor; Anterior vuelve con cursor completo y corte propio de la página", async () => {
    await grupos();
    const client = mostrar();
    await abrirResumen();
    expect(
      within(screen.getByRole("table", { name: "Grupos del resumen" })).getAllByRole("row"),
    ).toHaveLength(51);
    expect(celda("Solicitados")).toHaveTextContent("1.326");
    await solicitar(100, 999);
    await siguiente();
    expect(celda("Solicitados")).toHaveTextContent("1.426");
    expect(
      within(screen.getByRole("table", { name: "Grupos del resumen" })).getAllByRole("row"),
    ).toHaveLength(3);
    expect(consultas.at(-1)?.searchParams.get("despuesFecha")).toBe(hoy());
    expect(consultas.at(-1)?.searchParams.get("despuesDestinoCodigo")).toBe("150");
    expect(consultas.at(-1)?.searchParams.get("despuesContrato")).toBe("V-DEMO/1");
    expect(consultas.at(-1)?.searchParams.get("despuesProducto")).toBe("10");
    expect(consultas.at(-1)?.searchParams.get("despuesCampania")).toBe("2025-2026");
    const current = client
      .getQueryCache()
      .findAll({ queryKey: ["logistica", "resumen"] })
      .find((q) => q.queryKey[3] !== undefined)!.state.data as ResumenLogistica;
    expect(screen.getByText(/Fuente: Logística propia/)).toHaveTextContent(
      fechaHoraArgentina(current.propiosAl),
    );
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await waitFor(() => expect(screen.queryByText("Consultando resumen…")).not.toBeInTheDocument());
    expect(consultas.at(-1)?.searchParams.has("despuesFecha")).toBe(false);
    expect(
      within(screen.getByRole("table", { name: "Grupos del resumen" })).getAllByRole("row"),
    ).toHaveLength(51);
    expect(celda("Solicitados")).toHaveTextContent("1.426");
  });
  it("una página vacía tras cambios conserva totales, texto de página y permite Anterior", async () => {
    await grupos();
    mostrar();
    const client = clients.at(-1)!;
    await abrirResumen();
    await siguiente();
    resetLogisticaDemo();
    await solicitar(7);
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["logistica", "resumen"] });
    });
    expect(
      await screen.findByText("No hay más grupos en esta página. Volvé a la página anterior."),
    ).toBeInTheDocument();
    expect(celda("Solicitados")).toHaveTextContent("7");
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });
  it("carga inicial bloquea navegación y un fallo permite reintentar sin falso vacío", async () => {
    let fallo = true;
    server.use(
      http.get(`${API}/resumen`, async ({ request }) =>
        fallo
          ? HttpResponse.json({ status: 503, detail: "Resumen no disponible" }, { status: 503 })
          : await getResponse(logisticaHandlers, request),
      ),
    );
    mostrar();
    fireEvent.click(screen.getByRole("tab", { name: "Resumen" }));
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    await screen.findByText("Resumen no disponible");
    expect(
      screen.queryByText("No hay solicitudes para estas fechas y filtros."),
    ).not.toBeInTheDocument();
    fallo = false;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("table", { name: "Totales del resumen" });
  });
  it("recarga y fallo con caché muestran Datos anteriores, bloquean navegación y conservan corte/totales hasta éxito", async () => {
    await grupos();
    let fallo = false,
      liberar: (() => void) | undefined,
      esperar = false;
    server.use(
      http.get(`${API}/resumen`, async ({ request }) => {
        const respuesta = await getResponse(logisticaHandlers, request);
        if (esperar)
          await new Promise<void>((resolve) => {
            liberar = resolve;
          });
        return fallo
          ? HttpResponse.json({ status: 503, detail: "Resumen no disponible" }, { status: 503 })
          : respuesta;
      }),
    );
    const client = mostrar();
    await abrirResumen();
    const corte = screen.getByText(/Fuente: Logística propia/).textContent;
    esperar = true;
    fallo = true;
    act(() => {
      void client.invalidateQueries({ queryKey: ["logistica", "resumen"] });
    });
    await screen.findByText(/Datos anteriores/);
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    await waitFor(() => expect(liberar).toBeDefined());
    await act(async () => liberar!());
    await screen.findByText("Resumen no disponible");
    expect(celda("Solicitados")).toHaveTextContent("1.326");
    expect(screen.getByText(/Fuente: Logística propia/).textContent).toBe(corte);
    expect(screen.getByText(/Datos anteriores/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    fallo = false;
    esperar = false;
    fireEvent.click(screen.getAllByRole("button", { name: "Reintentar" })[0]);
    await waitFor(() => expect(screen.queryByText(/Datos anteriores/)).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled();
  });

  it("cambio de página mantiene placeholder anterior, bloquea ambos controles y conserva ese corte si falla; reintento recupera", async () => {
    await grupos();
    let esperar = false,
      fallo = false,
      liberar: (() => void) | undefined;
    server.use(
      http.get(`${API}/resumen`, async ({ request }) => {
        const real = await getResponse(logisticaHandlers, request);
        if (esperar)
          await new Promise<void>((resolve) => {
            liberar = resolve;
          });
        return fallo
          ? HttpResponse.json({ status: 503, detail: "Página no disponible" }, { status: 503 })
          : real;
      }),
    );
    mostrar();
    await abrirResumen();
    const corte = screen.getByText(/Fuente: Logística propia/).textContent;
    esperar = true;
    fallo = true;
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText(/Datos anteriores/);
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(
      within(screen.getByRole("table", { name: "Grupos del resumen" })).getAllByRole("row"),
    ).toHaveLength(51);
    await waitFor(() => expect(liberar).toBeDefined());
    await act(async () => liberar!());
    await screen.findByText("Página no disponible");
    expect(screen.getByText(/Datos anteriores/)).toBeInTheDocument();
    expect(screen.getByText(/Fuente: Logística propia/).textContent).toBe(corte);
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    esperar = false;
    fallo = false;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.queryByText(/Datos anteriores/)).not.toBeInTheDocument());
    expect(
      within(screen.getByRole("table", { name: "Grupos del resumen" })).getAllByRole("row"),
    ).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
    const n = consultas.length;
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await waitFor(() => expect(consultas.length).toBe(n + 1));
    await waitFor(() => expect(screen.queryByText(/Datos anteriores/)).not.toBeInTheDocument());
  });
  it("Consultar con los mismos criterios conserva caché marcada anterior si falla la lectura nueva", async () => {
    await solicitar(11);
    let fallo = false;
    server.use(
      http.get(`${API}/resumen`, async ({ request }) =>
        fallo
          ? HttpResponse.json({ status: 503, detail: "Recarga no disponible" }, { status: 503 })
          : await getResponse(logisticaHandlers, request),
      ),
    );
    mostrar();
    await abrirResumen();
    fallo = true;
    fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
    await screen.findByText("Recarga no disponible");
    expect(celda("Solicitados")).toHaveTextContent("11");
    expect(screen.getByText(/Datos anteriores/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    fallo = false;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.queryByText(/Datos anteriores/)).not.toBeInTheDocument());
  });

  it.each(["respuesta", "recepción", "otorgamiento", "anulación", "cierre"])(
    "la mutación %s existente invalida Resumen por raíz logistica",
    async (operacion) => {
      let s = await solicitar();
      const r = await recibir(s.id);
      s = { ...s, revision: s.revision + 1 };
      const client = mostrar();
      await abrirResumen();
      const n = consultas.length;
      let ruta: string, body: object;
      const c = r.cupos[0];
      if (operacion === "respuesta") {
        ruta = `solicitudes-terminal/${s.id}/respuestas`;
        body = {
          revision: s.revision,
          cantidadCupos: 3,
          observadoAl: new Date().toISOString(),
          referencia: "Ficticia",
        };
      } else if (operacion === "recepción") {
        ruta = "cupos/recepciones";
        body = {
          contratoVenta: "V-DEMO/1",
          solicitudId: s.id,
          referencia: "Ficticia",
          recibidoAl: new Date().toISOString(),
          filas: [
            {
              ordinal: 1,
              fechaCarga: hoy(),
              destinoCodigo: 101,
              codigoTerminal: null,
              circuito: "directa",
              lugarTipo: "planta",
              lugarReferencia: null,
            },
          ],
        };
      } else if (operacion === "otorgamiento") {
        ruta = "otorgamientos";
        body = { destinatarioTipo: "propio", cupos: [{ id: c.id, revision: c.revision }] };
      } else if (operacion === "anulación") {
        ruta = `seguimientos/${c.id}/anular`;
        body = { revision: 1, motivo: "Ficticia" };
      } else {
        ruta = `solicitudes-terminal/${s.id}/cerrar`;
        body = { revision: s.revision, motivo: "Ficticia" };
      }
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      const hook = renderHook(() => useOperacion(ruta), { wrapper });
      await act(async () => {
        await hook.result.current.mutateAsync(body);
      });
      await waitFor(() => expect(consultas.length).toBe(n + 1));
      await waitFor(() =>
        expect(screen.queryByText("Consultando resumen…")).not.toBeInTheDocument(),
      );
      const titulo =
        operacion === "respuesta"
          ? "Respuesta vigente"
          : operacion === "recepción"
            ? "Recibidos"
            : operacion === "otorgamiento"
              ? "Otorgados"
              : operacion === "anulación"
                ? "Anulados"
                : "Solicitudes";
      expect(celda(titulo)).toHaveTextContent(
        operacion === "respuesta"
          ? "3"
          : operacion === "recepción"
            ? "2"
            : operacion === "cierre"
              ? "1 cerradas"
              : "1",
      );
    },
  );
  it("intento incierto de Otorgar bloquea nueva tab Resumen y reintenta cuerpo/clave congelados con store real", async () => {
    const s = await solicitar();
    await recibir(s.id);
    let n = 0;
    const cuerpos: unknown[] = [],
      claves: string[] = [];
    server.use(
      http.post(`${API}/otorgamientos`, async ({ request }) => {
        cuerpos.push(await request.clone().json());
        claves.push(request.headers.get("Idempotency-Key")!);
        const real = await getResponse(logisticaHandlers, request);
        n++;
        return n === 1
          ? HttpResponse.json({ status: 503, detail: "Respuesta interrumpida" }, { status: 503 })
          : real;
      }),
    );
    mostrar();
    fireEvent.click(screen.getByRole("tab", { name: "Otorgar" }));
    fireEvent.click(await screen.findByRole("radio", { name: "Propio" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Elegir cupo V-DEMO/1 fila 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Revisar otorgamiento" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar otorgamiento" }));
    await screen.findByRole("button", { name: "Reintentar operación" });
    fireEvent.click(screen.getByRole("tab", { name: "Resumen" }));
    expect(screen.getByRole("tab", { name: "Otorgar" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Solicitar cupos" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(consultas).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar operación" }));
    await screen.findByText(/Se otorgaron 1 cupos/);
    expect(cuerpos[0]).toEqual(cuerpos[1]);
    expect(claves[0]).toBe(claves[1]);
    await abrirResumen();
    expect(celda("Otorgados")).toHaveTextContent("1");
  });
});
