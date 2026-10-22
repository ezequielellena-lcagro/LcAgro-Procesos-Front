import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { env } from "@/lib/env";
import { apiClient, setTokenBridge } from "@/lib/api-client";
import { logisticaHandlers, resetLogisticaDemo } from "@/mocks/handlers/logistica";
import { erpLogisticaDemo } from "@/mocks/handlers/logistica-conciliacion";
import { fecha, hoy, periodoInicial, sumarDias } from "../format";
import type { Pedido, Recepcion } from "../types";
import { CuposPage } from "./cupos-page";
import { CargasPage } from "./cargas-page";

const sesion = vi.hoisted(() => ({ roles: ["logistica-cupos", "logistica-cargas"] }));
const routers: ReturnType<typeof createMemoryRouter>[] = [];
const descarga = vi.hoisted(() => ({ downloadBlob: vi.fn() }));
vi.mock("@/shared/export/download-blob", async (original) => ({
  ...(await original<typeof import("@/shared/export/download-blob")>()),
  downloadBlob: descarga.downloadBlob,
}));
vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: 7, roles: sesion.roles } }),
}));
const API = `${env.apiUrl}/logistica`;
const server = setupServer(...logisticaHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  routers.splice(0).forEach((router) => router.dispose());
  sesion.roles = ["logistica-cupos", "logistica-cargas"];
  server.resetHandlers();
  resetLogisticaDemo();
  vi.restoreAllMocks();
  descarga.downloadBlob.mockReset();
  setTokenBridge({
    getAccessToken: () => null,
    refresh: async () => null,
    onAuthFailure: () => {},
  });
});
afterAll(() => server.close());
function mostrar(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter([{ path: "*", element: children }]);
  routers.push(router);
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
async function post<T>(ruta: string, body: object) {
  const r = await fetch(`${API}/${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  expect(r.ok).toBe(true);
  return (await r.json()) as T;
}
async function recibir(n = 2) {
  return post<Recepcion>("cupos/recepciones", {
    contratoVenta: "V-DEMO/1",
    solicitudId: null,
    referencia: "Recepción ficticia filtros",
    recibidoAl: new Date().toISOString(),
    filas: Array.from({ length: n }, (_, i) => ({
      ordinal: i + 1,
      fechaCarga: hoy(),
      destinoCodigo: i % 2 ? 102 : 101,
      codigoTerminal: `F-${i}`,
      circuito: i % 2 ? "propia" : "directa",
      lugarTipo: "planta",
      lugarReferencia: null,
    })),
  });
}
async function pedir(clienteNumero = 9000000001) {
  return post<Pedido>("pedidos", {
    clienteNumero,
    producto: 10,
    campania: "2025-2026",
    fechaSolicitada: hoy(),
    cantidadCupos: 2,
    preventa: null,
    observacion: null,
  });
}
const periodoParams = () => new URLSearchParams(periodoInicial());
/**
 * Elige una fecha desde el calendario del campo. Sirve también para REELEGIR la vigente, que es
 * como se fuerza una consulta nueva sin cambiar criterios: escribir el mismo texto no dispara
 * nada (React descarta el evento si el valor no cambió), un clic en el día sí.
 */
function elegirFecha(etiqueta: string, iso: string) {
  const [anio, mes, dia] = iso.split("-").map(Number);
  const campo = screen.getByLabelText(etiqueta);
  fireEvent.click(within(campo.closest("label")!).getByRole("button", { name: /calendario/i }));
  fireEvent.change(screen.getByLabelText("Año"), { target: { value: String(anio) } });
  fireEvent.change(screen.getByLabelText("Mes"), { target: { value: String(mes - 1) } });
  fireEvent.click(screen.getByRole("button", { name: String(dia) }));
}

/**
 * Escribe una fecha en un campo del filtro de período. El `DateField` muestra y acepta
 * dd/mm/aaaa, y avisa recién cuando la fecha está completa: por eso se escribe entera de una.
 */
const ponerFecha = (etiqueta: string, iso: string) =>
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: fecha(iso) } });

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

describe("Filtros aplicados de Cupos", () => {
  it("recibidos envía filtros al servidor al aplicar y limpia páginas al volver al mismo filtro", async () => {
    const recepcion = await recibir(52);
    const ordenados = [...recepcion.cupos].sort((a, b) => a.id.localeCompare(b.id));
    const primero = ordenados[0].codigoTerminal!,
      ultimo = ordenados[51].codigoTerminal!;
    const pedidos: URL[] = [];
    server.use(
      http.get(`${API}/cupos`, ({ request }) => {
        pedidos.push(new URL(request.url));
      }),
    );
    mostrar(<CuposPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Cupos recibidos" }));
    await screen.findByText(primero);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText(ultimo);
    expect(screen.queryByText(primero)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Contrato"), { target: { value: "NO-EXISTE" } });
    expect(pedidos.at(-1)?.searchParams.get("contrato")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(pedidos.at(-1)?.searchParams.get("contrato")).toBe("NO-EXISTE"));
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await screen.findByText(primero);
    expect(screen.queryByText(ultimo)).not.toBeInTheDocument();
    expect(pedidos.at(-1)?.searchParams.has("despuesId")).toBe(false);
    fireEvent.change(screen.getByLabelText("Circuito"), { target: { value: "propia" } });
    fireEvent.change(screen.getByLabelText("Campaña"), { target: { value: "2025-2026" } });
    await elegirCatalogo("Cereal", "10", "Soja (10)");
    await elegirCatalogo("Destino", "102", "Otra terminal de ejemplo (102)");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(pedidos.at(-1)?.searchParams.get("destinoCodigo")).toBe("102"));
    expect(pedidos.at(-1)?.searchParams.get("producto")).toBe("10");
    expect(pedidos.at(-1)?.searchParams.get("campania")).toBe("2025-2026");
    expect(pedidos.at(-1)?.searchParams.get("circuito")).toBe("propia");
    expect(screen.queryByText("F-0")).not.toBeInTheDocument();
    // Son 52 cupos y dos tandas de catálogo: con la máquina cargada roza los 5 s por defecto.
  }, 15000);
  it("MacroGest filtra producto/contrato/destino antes del límite y muestra números de cabecera separados", async () => {
    const fixtures = erpLogisticaDemo.filas();
    const spy = vi
      .spyOn(erpLogisticaDemo, "filas")
      .mockReturnValue([{ ...fixtures[0], destinoCodigo: 102 }, fixtures[1], fixtures[2]]);
    const p = periodoParams();
    p.set("producto", "10");
    p.set("destinoCodigo", "101");
    p.set("contrato", "V-DEMO/1");
    p.set("tamano", "1");
    const data = await (await fetch(`${API}/cupos/macrogest?${p}`)).json();
    expect(data.filas).toHaveLength(1);
    expect(data.filas[0].contrato).toBe("V-DEMO/1");
    expect(data.filas[0].grupo).toBe(701);
    const p2 = periodoParams();
    p2.set("producto", "1");
    expect((await (await fetch(`${API}/cupos/macrogest?${p2}`)).json()).filas).toEqual([]);
    const base = fixtures[1];
    spy.mockReturnValue([
      { ...base, productorPlan: 0, cargadorPlan: null },
      { ...base, grupo: 702, tieneCabecera: false, productorPlan: null, cargadorPlan: null },
    ]);
    mostrar(<CuposPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Cupos MacroGest" }));
    const table = await screen.findByRole("table", { name: "Cupos de MacroGest" });
    expect(
      within(table).getByRole("columnheader", { name: "Productor del plan" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Cargador del plan" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(within(table).getByText("0")).toBeInTheDocument());
    // Cabecera ausente o dato vacío se muestran igual: con un guion, no con una frase.
    expect(within(table).queryByText("Sin cabecera")).not.toBeInTheDocument();
    expect(within(table).queryByText("Sin dato")).not.toBeInTheDocument();
    expect(within(table).getAllByText("—").length).toBeGreaterThan(0);
  });
  it("productor filtra únicamente pedidos y descarta selección anterior al aplicar o limpiar", async () => {
    await recibir();
    await pedir();
    await pedir(1);
    const cupos: URL[] = [],
      pedidos: URL[] = [];
    server.use(
      http.get(`${API}/cupos`, ({ request }) => {
        cupos.push(new URL(request.url));
      }),
      http.get(`${API}/pedidos`, ({ request }) => {
        pedidos.push(new URL(request.url));
      }),
    );
    mostrar(<CuposPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Otorgar" }));
    const radio = await screen.findByRole("radio", { name: "Elegir pedido de Productor ficticio" });
    fireEvent.click(radio);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Elegir cupo V-DEMO/1 fila 1" }));
    await elegirCatalogo(
      "Productor de los pedidos",
      "Cliente de prueba",
      "Cliente de prueba uno (1)",
    );
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(pedidos.at(-1)?.searchParams.get("clienteNumero")).toBe("1"));
    expect(cupos.at(-1)?.searchParams.has("clienteNumero")).toBe(false);
    expect(screen.getByRole("button", { name: "Revisar otorgamiento" })).toBeDisabled();
    expect(
      screen.queryByRole("radio", { name: "Elegir pedido de Productor ficticio" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await screen.findByRole("radio", { name: "Elegir pedido de Productor ficticio" });
    expect(pedidos.at(-1)?.searchParams.has("clienteNumero")).toBe(false);
    expect(pedidos.at(-1)?.searchParams.has("despuesId")).toBe(false);
  });
  it("consultar el mismo período en Recibidos reinicia todas las páginas", async () => {
    const recepcion = await recibir(52);
    const filas = [...recepcion.cupos].sort((a, b) => a.id.localeCompare(b.id));
    const consultas: URL[] = [];
    server.use(
      http.get(`${API}/cupos`, ({ request }) => {
        consultas.push(new URL(request.url));
      }),
    );
    mostrar(<CuposPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Cupos recibidos" }));
    await screen.findByText(filas[0].codigoTerminal!);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText(filas[51].codigoTerminal!);
    // Volver a elegir la MISMA fecha reinicia el cursor: es lo que antes hacía "Consultar".
    elegirFecha("Hasta inclusive", sumarDias(periodoInicial().hastaExclusivo, -1));
    await waitFor(() =>
      expect(screen.queryByText(filas[51].codigoTerminal!)).not.toBeInTheDocument(),
    );
    expect(consultas.at(-1)?.searchParams.has("despuesId")).toBe(false);
    expect(consultas.at(-1)?.searchParams.get("desde")).toBe(periodoInicial().desde);
  });
  it("MacroGest mantiene borrador, aplica filtros y reinicia el cursor completo al limpiar o consultar", async () => {
    const [base] = erpLogisticaDemo.filas();
    const consultas: URL[] = [];
    server.use(
      http.get(`${API}/cupos/macrogest`, ({ request }) => {
        const u = new URL(request.url);
        consultas.push(u);
        const next = u.searchParams.has("despuesFecha");
        return HttpResponse.json({
          filas: [
            {
              ...base,
              grupo: next ? 702 : 701,
              codigoTerminal: next ? "ERP-SEGUNDA" : "ERP-PRIMERA",
            },
          ],
          hayMas: !next,
          datosAl: new Date().toISOString(),
        });
      }),
    );
    mostrar(<CuposPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Cupos MacroGest" }));
    await screen.findByText("ERP-PRIMERA");
    // La grilla más ancha de Cupos va de a 10: de a 50 los filtros quedaban fuera de pantalla.
    expect(consultas[0].searchParams.get("tamano")).toBe("10");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("ERP-SEGUNDA");
    expect(screen.queryByText("ERP-PRIMERA")).not.toBeInTheDocument();
    expect(consultas.at(-1)?.searchParams.get("despuesGrupo")).toBe("701");
    fireEvent.change(screen.getByLabelText("Contrato"), { target: { value: "V-DEMO/1" } });
    await elegirCatalogo("Cereal", "10", "Soja (10)");
    await elegirCatalogo("Destino", "101", "Terminal de ejemplo (101)");
    expect(consultas.at(-1)?.searchParams.has("contrato")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(consultas.at(-1)?.searchParams.get("destinoCodigo")).toBe("101"));
    expect(consultas.at(-1)?.searchParams.get("producto")).toBe("10");
    expect(consultas.at(-1)?.searchParams.get("contrato")).toBe("V-DEMO/1");
    expect(consultas.at(-1)?.searchParams.has("circuito")).toBe(false);
    expect(screen.queryByText("ERP-SEGUNDA")).not.toBeInTheDocument();
    await screen.findByText("ERP-PRIMERA");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("ERP-SEGUNDA");
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await waitFor(() => expect(consultas.at(-1)?.searchParams.has("producto")).toBe(false));
    expect(screen.getByLabelText("Contrato")).toHaveValue("");
    expect(screen.getByLabelText("Cereal")).toHaveValue("");
    expect(screen.getByLabelText("Destino")).toHaveValue("");
    expect(
      ["despuesFecha", "despuesContrato", "despuesGrupo", "despuesCupo"].some((k) =>
        consultas.at(-1)?.searchParams.has(k),
      ),
    ).toBe(false);
    await screen.findByText("ERP-PRIMERA");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("ERP-SEGUNDA");
    elegirFecha("Hasta inclusive", sumarDias(periodoInicial().hastaExclusivo, -1));
    await waitFor(() => expect(screen.queryByText("ERP-SEGUNDA")).not.toBeInTheDocument());
    // Un rango más largo que el máximo no se consulta: avisa y deja vigente el anterior.
    const consultadas = consultas.length;
    ponerFecha("Hasta inclusive", sumarDias(periodoInicial().desde, 31));
    expect(screen.getByText(/hasta 31 días/)).toBeInTheDocument();
    expect(consultas).toHaveLength(consultadas);
  });
  it("el productor de pedidos se congela durante revisión y resultado incierto", async () => {
    await recibir(1);
    await pedir();
    server.use(
      http.post(`${API}/otorgamientos`, () =>
        HttpResponse.json({ detail: "Confirmación pendiente" }, { status: 503 }),
      ),
    );
    mostrar(<CuposPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Otorgar" }));
    fireEvent.click(
      await screen.findByRole("radio", { name: "Elegir pedido de Productor ficticio" }),
    );
    fireEvent.click(await screen.findByRole("checkbox", { name: "Elegir cupo V-DEMO/1 fila 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Revisar otorgamiento" }));
    expect(screen.getByLabelText("Productor de los pedidos")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Limpiar filtros" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar otorgamiento" }));
    await screen.findByRole("button", { name: "Reintentar operación" });
    expect(screen.getByLabelText("Productor de los pedidos")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});
describe("Cursor real del handler MacroGest", () => {
  it.each(["fecha", "datetime"] as const)(
    "continúa con fechaCarga %s real devuelta por la primera página",
    async (tipo) => {
      const fixtures = erpLogisticaDemo.filas();
      const filas = fixtures.map((f, i) => ({
        ...f,
        fechaCarga:
          tipo === "datetime" ? `${hoy()}T12:30:${String(i).padStart(2, "0")}.1234567` : hoy(),
      }));
      vi.spyOn(erpLogisticaDemo, "filas").mockReturnValue(filas);
      const p = new URLSearchParams({ ...periodoInicial(), tamano: "1" });
      const primera = await fetch(`${API}/cupos/macrogest?${p}`);
      expect(primera.status).toBe(200);
      const pagina = await primera.json();
      const cursor = pagina.filas[0];
      expect(pagina.hayMas).toBe(true);
      p.set("despuesFecha", cursor.fechaCarga);
      p.set("despuesContrato", cursor.contrato);
      p.set("despuesGrupo", String(cursor.grupo));
      p.set("despuesCupo", String(cursor.cupo));
      const segunda = await fetch(`${API}/cupos/macrogest?${p}`);
      expect(segunda.status).toBe(200);
      const siguiente = await segunda.json();
      expect(siguiente.filas).toHaveLength(1);
      expect(siguiente.filas[0]).toMatchObject(
        tipo === "datetime"
          ? { fechaCarga: filas[1].fechaCarga, grupo: filas[1].grupo }
          : { fechaCarga: hoy(), grupo: 701 },
      );
    },
  );
  it("conserva hora y siete posiciones fraccionarias al comparar el cursor ERP", async () => {
    const base = erpLogisticaDemo.filas()[1];
    vi.spyOn(erpLogisticaDemo, "filas").mockReturnValue([
      { ...base, grupo: 999, fechaCarga: `${hoy()}T12:00:00.1234566` },
      { ...base, grupo: 701, fechaCarga: `${hoy()}T12:00:00.1234567` },
      { ...base, grupo: 0, fechaCarga: `${hoy()}T12:00:00.1234568` },
    ]);
    const p = new URLSearchParams({
      ...periodoInicial(),
      despuesFecha: `${hoy()}T12:00:00.1234567`,
      despuesContrato: "V-DEMO/1",
      despuesGrupo: "701",
      despuesCupo: "1",
      tamano: "1",
    });
    const r = await fetch(`${API}/cupos/macrogest?${p}`);
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.filas).toHaveLength(1);
    expect(data.filas[0].grupo).toBe(0);
    expect(data.filas[0].fechaCarga).toBe(`${hoy()}T12:00:00.1234568`);
  });
  it.each(["2026-02-31", "2026-02-31T12:00:00", "2026-10-03T25:00:00", "antes", "fin"])(
    "rechaza fecha de cursor inválida o fuera del período: %s",
    async (valor) => {
      const periodo = periodoInicial();
      const despuesFecha =
        valor === "antes"
          ? `${sumarDias(periodo.desde, -1)}T23:59:59`
          : valor === "fin"
            ? `${periodo.hastaExclusivo}T00:00:00`
            : valor;
      const p = new URLSearchParams({
        ...periodo,
        despuesFecha,
        despuesContrato: "V-DEMO/1",
        despuesGrupo: "701",
        despuesCupo: "1",
      });
      const r = await fetch(`${API}/cupos/macrogest?${p}`);
      expect(r.status).toBe(400);
      expect((await r.json()).detail).toBeTruthy();
    },
  );
});
describe("Filtros aplicados de Cargas", () => {
  it("no consulta con una campaña a medio escribir y avisa en castellano", async () => {
    const pedidos: URL[] = [];
    server.use(
      http.get(`${API}/seguimientos`, ({ request }) => {
        pedidos.push(new URL(request.url));
      }),
    );
    mostrar(<CargasPage />);
    await waitFor(() => expect(pedidos).not.toHaveLength(0));
    const aplicar = () => screen.getByRole("button", { name: "Aplicar filtros" });
    fireEvent.change(screen.getByLabelText("Campaña"), { target: { value: "2025" } });
    expect(aplicar()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Ingresá una campaña como 2025-2026.");
    // Años no consecutivos pasan el formato pero no son una campaña.
    fireEvent.change(screen.getByLabelText("Campaña"), { target: { value: "2025-2030" } });
    expect(aplicar()).toBeDisabled();
    fireEvent.click(aplicar());
    expect(pedidos.at(-1)?.searchParams.has("campania")).toBe(false);
    fireEvent.change(screen.getByLabelText("Campaña"), { target: { value: "2025-2026" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(aplicar());
    await waitFor(() => expect(pedidos.at(-1)?.searchParams.get("campania")).toBe("2025-2026"));
  });
});
describe("Exportación de Cargas", () => {
  it.each(["Día", "Período", "Anuladas", "Desfasajes"])(
    "exporta %s con snapshot aplicado sin cursor ni tamaño y timeout exclusivo",
    async (tab) => {
      const requests: URL[] = [],
        auth: string[] = [];
      server.use(
        http.get(`${API}/seguimientos/excel`, ({ request }) => {
          requests.push(new URL(request.url));
          auth.push(request.headers.get("Authorization") ?? "");
          return new HttpResponse(new Uint8Array([80, 75]), {
            headers: {
              "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "Content-Disposition": "attachment; filename=seguimientos-ficticio.xlsx",
            },
          });
        }),
      );
      setTokenBridge({
        getAccessToken: () => "mock-access-1",
        refresh: async () => null,
        onAuthFailure: () => {},
      });
      const spy = vi.spyOn(apiClient, "get");
      mostrar(<CargasPage />);
      fireEvent.click(screen.getByRole("tab", { name: tab }));
      fireEvent.change(screen.getByLabelText("Contrato"), { target: { value: "V-DEMO/1" } });
      fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
      fireEvent.change(screen.getByLabelText("Contrato"), { target: { value: "BORRADOR" } });
      fireEvent.click(screen.getByRole("button", { name: "Exportar Excel" }));
      await waitFor(() => expect(descarga.downloadBlob).toHaveBeenCalledTimes(1));
      expect(requests).toHaveLength(1);
      const p = requests[0].searchParams;
      expect(p.get("contrato")).toBe("V-DEMO/1");
      expect(p.get("anulados")).toBe(tab === "Anuladas" ? "true" : "false");
      expect(p.get("desde")).toBe(tab === "Día" ? hoy() : periodoInicial().desde);
      expect(p.get("hastaExclusivo")).toBe(
        tab === "Día" ? sumarDias(hoy(), 1) : periodoInicial().hastaExclusivo,
      );
      expect([...p.keys()].some((k) => k.startsWith("despues") || k === "tamano")).toBe(false);
      expect(auth).toEqual(["Bearer mock-access-1"]);
      expect(
        spy.mock.calls.find(([url]) => url === "/logistica/seguimientos/excel")?.[1],
      ).toMatchObject({ responseType: "blob", timeout: 90_000 });
      expect(apiClient.defaults.timeout).toBe(30_000);
      expect(descarga.downloadBlob.mock.calls[0][1]).toBe("seguimientos-ficticio.xlsx");
    },
  );
  it("deshabilita exportar y congela filtros durante una descarga evitando doble click", async () => {
    let resolver!: () => void;
    const espera = new Promise<void>((r) => {
      resolver = r;
    });
    let llamadas = 0;
    server.use(
      http.get(`${API}/seguimientos/excel`, async () => {
        llamadas++;
        await espera;
        return new HttpResponse(new Uint8Array([80, 75]));
      }),
    );
    mostrar(<CargasPage />);
    const button = screen.getByRole("button", { name: "Exportar Excel" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(await screen.findByRole("button", { name: "Exportando…" })).toBeDisabled();
    expect(screen.getByLabelText("Contrato")).toBeDisabled();
    await act(async () => {
      resolver();
    });
    await waitFor(() => expect(descarga.downloadBlob).toHaveBeenCalledTimes(1));
    expect(llamadas).toBe(1);
  });
  it.each([400, 403, 503])(
    "muestra ProblemDetails %s recibido como Blob y no descarga",
    async (status) => {
      server.use(
        http.get(`${API}/seguimientos/excel`, () =>
          HttpResponse.json({ status, detail: `Detalle útil ${status}` }, { status }),
        ),
      );
      mostrar(<CargasPage />);
      fireEvent.click(screen.getByRole("button", { name: "Exportar Excel" }));
      expect(await screen.findByText(`Detalle útil ${status}`)).toBeInTheDocument();
      expect(descarga.downloadBlob).not.toHaveBeenCalled();
    },
  );
  it("lectura general conserva acceso a exportar", async () => {
    sesion.roles = ["logistica-lectura"];
    server.use(
      http.get(`${API}/seguimientos/excel`, () => new HttpResponse(new Uint8Array([80, 75]))),
    );
    mostrar(<CargasPage />);
    fireEvent.click(screen.getByRole("button", { name: "Exportar Excel" }));
    await waitFor(() => expect(descarga.downloadBlob).toHaveBeenCalledTimes(1));
  });
  it("exportar permanece bloqueado durante edición y un intento incierto", async () => {
    await recibir(1);
    server.use(
      http.post(`${API}/seguimientos/:id/anular`, () =>
        HttpResponse.json({ detail: "Resultado incierto" }, { status: 503 }),
      ),
    );
    mostrar(<CargasPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Detalle" }));
    fireEvent.click(await screen.findByRole("button", { name: "Anular seguimiento" }));
    expect(screen.getByRole("button", { name: "Exportar Excel" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motivo de anulación"), {
      target: { value: "Anulación ficticia" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anular seguimiento" }));
    await screen.findByRole("button", { name: "Reintentar operación" });
    expect(screen.getByRole("button", { name: "Exportar Excel" })).toBeDisabled();
  });
  it("exportar permanece bloqueado durante el diálogo de vínculo ERP", async () => {
    const recepcion = await recibir(1);
    const c = recepcion.cupos[0];
    await post("otorgamientos", { destinatarioTipo: "propio", cupos: [{ id: c.id, revision: 1 }] });
    mostrar(<CargasPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Detalle" }));
    fireEvent.click(await screen.findByRole("button", { name: "Vincular con MacroGest" }));
    expect(screen.getByRole("button", { name: "Exportar Excel" })).toBeDisabled();
    expect(screen.getByLabelText("Contrato")).toBeDisabled();
  });
  it("errores no JSON conservan AppError y no descargan", async () => {
    server.use(
      http.get(`${API}/seguimientos/excel`, () =>
        HttpResponse.text("Respuesta inválida", { status: 500 }),
      ),
    );
    mostrar(<CargasPage />);
    fireEvent.click(screen.getByRole("button", { name: "Exportar Excel" }));
    expect(
      await screen.findByText("Error del servidor. Avisale al equipo si persiste."),
    ).toBeInTheDocument();
    expect(descarga.downloadBlob).not.toHaveBeenCalled();
  });
});
