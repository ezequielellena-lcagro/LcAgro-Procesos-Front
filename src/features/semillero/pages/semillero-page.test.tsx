import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { env } from "@/lib/env";
import { semilleroHandlers } from "@/mocks/handlers/semillero";
import { semilleroKeys } from "../queries/keys";
import type { ClientesCopiaDto, StockFilaDto, StockSemilleroDto } from "../types";
import { SemilleroPage } from "./semillero-page";

/**
 * Integración de la página completa: cableado final de F13 (design §10). No repite lo que ya cubren
 * los `.test.tsx` de cada panel/diálogo (F5-F12) — sólo confirma que `semillero-page.tsx` conecta los
 * hooks reales (contra MSW, con los fixtures ficticios de `semillero.ts`) con los componentes
 * correctos: cambio de pestaña, apertura de diálogos y que TODA query vive bajo la key ["semillero"].
 */
const server = setupServer(...semilleroHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers(...semilleroHandlers));
afterAll(() => server.close());

/** `staleTime`: el de la app (`lib/query-client.ts`) cuando el test depende de si la caché está al día. */
function renderPagina({ staleTime = 0 }: { staleTime?: number } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <SemilleroPage />
    </QueryClientProvider>,
  );
  return { queryClient };
}

describe("SemilleroPage", () => {
  it("arranca en Stock: pide stock/órdenes/catálogos, pero todavía no la copia de clientes (lazy)", async () => {
    const { queryClient } = renderPagina();

    expect(await screen.findByText("BigBags propios")).toBeInTheDocument();
    expect(await screen.findByText("26S-001")).toBeInTheDocument(); // lote propio de la fixture

    // Sin ningún diálogo abierto y sin pisar la pestaña Órdenes/Catálogos, la copia de clientes
    // (R2.2/R2.3) no se pide: es cara (puede refrescar contra MacroGest) y esta pestaña no la usa.
    expect(queryClient.getQueryData(semilleroKeys.clientes())).toBeUndefined();

    // Toda query del módulo vive bajo la misma key raíz.
    for (const q of queryClient.getQueryCache().getAll()) {
      expect(q.queryKey[0]).toBe("semillero");
    }
  });

  it("la pestaña Movimientos es lazy: no se pide hasta que se abre esa pestaña", async () => {
    const { queryClient } = renderPagina();
    await screen.findByText("BigBags propios");

    expect(queryClient.getQueryData(semilleroKeys.movimientos({}))).toBeUndefined();

    fireEvent.click(screen.getByRole("tab", { name: /Movimientos/ }));

    await waitFor(() =>
      expect(queryClient.getQueryData(semilleroKeys.movimientos({}))).toBeDefined(),
    );
    expect(await screen.findByText("Ingreso de cosecha propia.")).toBeInTheDocument();
  });

  /**
   * Si el backend cae (5xx) mientras se piden los movimientos, la pestaña tiene que decirlo y
   * ofrecer reintentar — no mostrar "No hay movimientos", que se lee como historial vacío.
   */
  it("si el backend no responde al pedir los movimientos muestra el error y permite reintentar", async () => {
    renderPagina();
    await screen.findByText("BigBags propios");

    server.use(
      http.get(`${env.apiUrl}/semillero/movimientos`, () => HttpResponse.json(null, { status: 500 })),
    );

    fireEvent.click(screen.getByRole("tab", { name: /Movimientos/ }));

    expect(await screen.findByText(/error del servidor/i)).toBeInTheDocument();
    expect(screen.queryByText("Ingreso de cosecha propia.")).not.toBeInTheDocument();

    server.resetHandlers(...semilleroHandlers);
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));

    expect(await screen.findByText("Ingreso de cosecha propia.")).toBeInTheDocument();
  });

  it("la pestaña Órdenes de carga muestra las órdenes y pide la copia de clientes para su filtro", async () => {
    const { queryClient } = renderPagina();
    await screen.findByText("BigBags propios");

    fireEvent.click(screen.getByRole("tab", { name: /Órdenes de carga/ }));

    expect(await screen.findByText("VIVERO DEMO SANTA ROSA SA")).toBeInTheDocument();
    await waitFor(() => expect(queryClient.getQueryData(semilleroKeys.clientes())).toBeDefined());
  });

  /** Deja afuera de la pestaña Stock el lote 26S-C01, el de la orden Pendiente N° 1 de la fixture. */
  async function filtrarStockSoloPropio() {
    fireEvent.change(screen.getByLabelText("Dueño"), { target: { value: "Propio" } });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Editar lote 26S-C01" })).not.toBeInTheDocument(),
    );
  }

  /** Demora la respuesta del stock completo (sin filtros) hasta llamar a la función que devuelve. */
  function demorarStockCompleto() {
    let liberar = () => {};
    const demora = new Promise<void>((resolver) => (liberar = resolver));
    server.use(
      http.get(`${env.apiUrl}/semillero/stock`, async ({ request }) => {
        if (new URL(request.url).search === "") await demora;
        // Sin respuesta propia: sigue al handler de la fixture.
      }),
    );
    return liberar;
  }

  const estadoStockCompleto = (queryClient: QueryClient) =>
    queryClient.getQueryState(semilleroKeys.stock({}))?.fetchStatus;

  /**
   * Regresión (ajuste 1.1, R1.3): el diálogo de orden recibía el stock YA FILTRADO de la pestaña
   * Stock. Con un filtro que dejaba afuera el lote de una orden pendiente, al editarla el renglón
   * quedaba sin datos, con máximo 0 ("Supera lo disponible"), y la orden no se podía guardar.
   * Estos tests van antes del que despacha la orden N° 1: la fixture de MSW es compartida.
   */
  it("editar una orden cuyo lote quedó fuera del filtro de Stock muestra el renglón y se puede guardar (R1.3)", async () => {
    renderPagina();
    await screen.findByText("BigBags propios");
    await filtrarStockSoloPropio();

    fireEvent.click(screen.getByRole("tab", { name: /Órdenes de carga/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Editar orden N° 1" }));

    const dialogo = await screen.findByRole("dialog", { name: "Editar orden N° 1" });
    expect(
      within(dialogo).getByText("Lote 26S-C01 · PLANTA · Cliente · VIVERO DEMO SANTA ROSA SA"),
    ).toBeInTheDocument();
    expect(within(dialogo).queryByText("Supera lo disponible.")).not.toBeInTheDocument();

    fireEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // La pestaña Stock conserva su filtro: la orden no lo toca (R1.4).
    fireEvent.click(screen.getByRole("tab", { name: "Stock" }));
    expect(screen.getByLabelText("Dueño")).toHaveValue("Propio");
    expect(screen.queryByRole("button", { name: "Editar lote 26S-C01" })).not.toBeInTheDocument();
  });

  it("el diálogo de orden no se abre hasta tener el stock completo (R1.2)", async () => {
    const { queryClient } = renderPagina();
    await screen.findByText("BigBags propios");
    await filtrarStockSoloPropio();

    // Sin el stock completo en caché y con la respuesta demorada, el diálogo tiene que esperar.
    // `resetQueries` (no `removeQueries`): deja el query sin datos, sin que `keepPreviousData`
    // recupere los que el observer ya había visto.
    await queryClient.resetQueries({ queryKey: semilleroKeys.stock({}), exact: true });
    const liberarStock = demorarStockCompleto();

    fireEvent.click(screen.getByRole("tab", { name: /Órdenes de carga/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Editar orden N° 1" }));

    await waitFor(() => expect(estadoStockCompleto(queryClient)).toBe("fetching"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Preparando la orden…")).toBeInTheDocument();

    liberarStock();
    const dialogo = await screen.findByRole("dialog", { name: "Editar orden N° 1" });
    expect(within(dialogo).getByText(/^Lote 26S-C01 · PLANTA/)).toBeInTheDocument();
    expect(screen.queryByText("Preparando la orden…")).not.toBeInTheDocument();
  });

  /**
   * Hallazgo de la revisión (ronda 1): la caché del stock completo casi nunca está vacía (la pestaña
   * Stock arranca sin filtros y la llena), pero con el diálogo cerrado nadie la vuelve a pedir. Abrir
   * con esa copia mostraba el renglón de un lote nuevo vacío y con "Supera lo disponible".
   */
  it("aunque haya una copia del stock completo en caché, el diálogo espera la que pide al abrir (R1.2)", async () => {
    const { queryClient } = renderPagina({ staleTime: 60_000 });
    await screen.findByText("BigBags propios");
    await filtrarStockSoloPropio();

    // Copia de hace un segundo (todavía "fresca" para la caché) sin el lote de la orden N° 1: por
    // ejemplo, otro usuario cargó ese lote y la orden después.
    queryClient.setQueryData<StockSemilleroDto>(
      semilleroKeys.stock({}),
      (d) => d && { ...d, filas: d.filas.filter((f) => f.loteCodigo !== "26S-C01") },
      { updatedAt: Date.now() - 1000 },
    );
    const liberarStock = demorarStockCompleto();

    fireEvent.click(screen.getByRole("tab", { name: /Órdenes de carga/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Editar orden N° 1" }));

    await waitFor(() => expect(estadoStockCompleto(queryClient)).toBe("fetching"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    liberarStock();
    const dialogo = await screen.findByRole("dialog", { name: "Editar orden N° 1" });
    expect(within(dialogo).getByText(/^Lote 26S-C01 · PLANTA/)).toBeInTheDocument();
    expect(within(dialogo).queryByText("Supera lo disponible.")).not.toBeInTheDocument();
  });

  it("volver a pedir el stock completo con el diálogo abierto no lo cierra ni pierde lo cargado (R1.2)", async () => {
    const { queryClient } = renderPagina();
    await screen.findByText("BigBags propios");
    fireEvent.click(screen.getByRole("tab", { name: /Órdenes de carga/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Nueva orden" }));
    const dialogo = await screen.findByRole("dialog", { name: "Nueva orden de carga" });
    fireEvent.change(within(dialogo).getByLabelText("Observaciones"), {
      target: { value: "Llevar lona." },
    });

    // Lo mismo que hace cualquier escritura del módulo.
    const liberarStock = demorarStockCompleto();
    void queryClient.invalidateQueries({ queryKey: semilleroKeys.all });
    await waitFor(() => expect(estadoStockCompleto(queryClient)).toBe("fetching"));
    expect(screen.getByRole("dialog", { name: "Nueva orden de carga" })).toBeInTheDocument();

    liberarStock();
    await waitFor(() => expect(estadoStockCompleto(queryClient)).toBe("idle"));
    const sigueAbierto = screen.getByRole("dialog", { name: "Nueva orden de carga" });
    expect(within(sigueAbierto).getByLabelText("Observaciones")).toHaveValue("Llevar lona.");
  });

  it("si falla el stock completo al pedir la orden, avisa sin tapar la página y deja reintentar o cancelar (R1.2)", async () => {
    renderPagina();
    await screen.findByText("BigBags propios");
    await filtrarStockSoloPropio();
    server.use(
      http.get(`${env.apiUrl}/semillero/stock`, ({ request }) =>
        new URL(request.url).search === ""
          ? HttpResponse.json({ detail: "Stock no disponible." }, { status: 400 })
          : undefined,
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Orden con 26S-001 en G1-1" }));

    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("No se pudo traer el stock para armar la orden: Stock no disponible.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // La página sigue ahí: pestañas y tabla filtrada.
    expect(screen.getByRole("tab", { name: "Stock" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar lote 26S-001" })).toBeInTheDocument();

    fireEvent.click(within(aviso).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // Con el backend repuesto, "Reintentar" abre la orden que se había pedido.
    fireEvent.click(screen.getByRole("button", { name: "Orden con 26S-001 en G1-1" }));
    const otroAviso = await screen.findByRole("alert");
    server.resetHandlers(...semilleroHandlers);
    fireEvent.click(within(otroAviso).getByRole("button", { name: "Reintentar" }));

    const dialogo = await screen.findByRole("dialog", { name: "Nueva orden de carga" });
    expect(within(dialogo).getByLabelText("Agregar renglón")).toHaveValue("1:1");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  /**
   * La pestaña "Órdenes de carga (N)" tiene que contar sólo las Pendientes, el mismo dato que el KPI
   * "Órdenes pendientes" — nunca el total de órdenes (que se queda alto aunque no quede ninguna
   * accionable, hallazgo de la recorrida manual del 2026-09-16).
   */
  it('la pestaña "Órdenes de carga" cuenta sólo las pendientes, no el total (recorrida 2026-09-16)', async () => {
    renderPagina();
    await screen.findByText("BigBags propios");
    fireEvent.click(screen.getByRole("tab", { name: /Órdenes de carga/ }));
    await screen.findByText("VIVERO DEMO SANTA ROSA SA");

    expect(screen.getByRole("tab", { name: "Órdenes de carga (1)" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Despachar orden N° 1" }));
    fireEvent.change(await screen.findByLabelText("Remito"), { target: { value: "06-00099" } });
    fireEvent.click(screen.getByRole("button", { name: "Despachar" }));

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Órdenes de carga (0)" })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("tab", { name: "Órdenes de carga (1)" })).not.toBeInTheDocument();
  });

  it('"Imprimir" en una orden Despachada abre la vista imprimible con la orden completa (R7.1)', async () => {
    renderPagina();
    await screen.findByText("BigBags propios");
    fireEvent.click(screen.getByRole("tab", { name: /Órdenes de carga/ }));
    await screen.findByText("SEMILLERO DEMO EL CEIBO SRL");

    fireEvent.click(screen.getByRole("button", { name: "Imprimir orden N° 2" }));

    expect(await screen.findByText("Orden de carga — Semillero")).toBeInTheDocument();
    // La orden 2 despachó el lote propio 26S-001: no lleva la leyenda "Semilla del cliente".
    expect(screen.queryByText("Semilla del cliente")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByText("Orden de carga — Semillero")).not.toBeInTheDocument();
  });

  it("Catálogos muestra variedades/ubicaciones y pide la copia de clientes para Destinos por cliente", async () => {
    const { queryClient } = renderPagina();
    await screen.findByText("BigBags propios");

    fireEvent.click(screen.getByRole("tab", { name: "Catálogos" }));

    expect(await screen.findByText("DM 53i54")).toBeInTheDocument();
    await waitFor(() => expect(queryClient.getQueryData(semilleroKeys.clientes())).toBeDefined());
  });

  it('"Nuevo lote" abre el diálogo de alta y pide la copia de clientes (la necesita si el dueño es un Cliente)', async () => {
    const { queryClient } = renderPagina();
    await screen.findByText("BigBags propios");

    fireEvent.click(screen.getByRole("button", { name: "Nuevo lote" }));

    const dialogo = await screen.findByRole("dialog", { name: "Nuevo lote" });
    expect(within(dialogo).getByLabelText("Código de lote")).toBeInTheDocument();
    await waitFor(() => expect(queryClient.getQueryData(semilleroKeys.clientes())).toBeDefined());
  });

  it('"Editar" un lote resuelve el LoteDto completo (duenioEditable/envaseYPesoEditables) antes de abrir', async () => {
    renderPagina();
    await screen.findByText("BigBags propios");

    // El lote 26S-C01 (cliente) ya tuvo su ingreso inicial únicamente: sigue editable.
    fireEvent.click(screen.getByRole("button", { name: "Editar lote 26S-C01" }));

    const dialogo = await screen.findByRole("dialog", { name: "Editar lote 26S-C01" });
    expect(within(dialogo).getByLabelText("Código de lote")).toHaveValue("26S-C01");
  });

  it('"Orden" en una fila propia de Stock abre una orden nueva con ese lote y sus filtros (R4.2/R4.4)', async () => {
    renderPagina();
    await screen.findByText("BigBags propios");

    fireEvent.click(screen.getByRole("button", { name: "Orden con 26S-001 en G1-1" }));

    const dialogo = await screen.findByRole("dialog", { name: "Nueva orden de carga" });
    expect(within(dialogo).getByLabelText("Agregar renglón")).toHaveValue("1:1");
    expect(within(dialogo).getByLabelText("Variedad")).toHaveValue("1");
    expect(within(dialogo).getByLabelText("Tratamiento")).toHaveValue("true");
    expect(within(dialogo).getByLabelText("Envase")).toHaveValue("BigBag");
    expect(within(dialogo).getByLabelText("Cliente")).toHaveValue("");

    // "Nueva orden" desde la pestaña Órdenes sigue arrancando sin filtros ni lote elegido.
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("tab", { name: /Órdenes de carga/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Nueva orden" }));

    const nueva = await screen.findByRole("dialog", { name: "Nueva orden de carga" });
    expect(within(nueva).getByLabelText("Agregar renglón")).toHaveValue("");
    expect(within(nueva).getByLabelText("Variedad")).toHaveValue("");
    expect(within(nueva).getByLabelText("Tratamiento")).toHaveValue("");
    expect(within(nueva).getByLabelText("Envase")).toHaveValue("");
  });

  it('"Orden" en una fila de un cliente activo espera la copia de clientes, lo preselecciona y pide sus destinos (R4.3)', async () => {
    renderPagina();
    await screen.findByText("BigBags propios");

    // La pestaña Stock no pide la copia de clientes: el diálogo tiene que esperarla para saber si
    // el dueño del lote está activo.
    fireEvent.click(screen.getByRole("button", { name: "Orden con 26S-C01 en PLANTA" }));

    const dialogo = await screen.findByRole("dialog", { name: "Nueva orden de carga" });
    expect(within(dialogo).getByLabelText("Cliente")).toHaveValue("900001 · VIVERO DEMO SANTA ROSA SA");
    expect(within(dialogo).getByLabelText("Agregar renglón")).toHaveValue("3:3");
    expect(within(dialogo).queryByText(/no está activo en la copia de MacroGest/)).not.toBeInTheDocument();
    expect(await within(dialogo).findByRole("option", { name: "Campo Norte" })).toBeInTheDocument();
  });

  /**
   * Hallazgo de la revisión (ronda 1): la página recalculaba en vivo el cliente inicial y el
   * formulario lo fijaba al montarse. Si la copia se refrescaba sin ese cliente, la página pasaba al
   * "cliente 0" (destinos vacíos, alta rápida contra /clientes/0) mientras el formulario lo conservaba.
   */
  it("si la copia de clientes se refresca con la orden abierta y el cliente sale, página y formulario siguen de acuerdo (R4.3)", async () => {
    const { queryClient } = renderPagina();
    await screen.findByText("BigBags propios");
    fireEvent.click(screen.getByRole("button", { name: "Orden con 26S-C01 en PLANTA" }));
    const dialogo = await screen.findByRole("dialog", { name: "Nueva orden de carga" });
    expect(await within(dialogo).findByRole("option", { name: "Campo Norte" })).toBeInTheDocument();

    // El 900001 se dio de baja en MacroGest y la copia se refresca con el diálogo abierto.
    server.use(
      http.get(`${env.apiUrl}/semillero/clientes`, () =>
        HttpResponse.json({
          clientes: [],
          copia: {
            ultimaSincronizacion: new Date().toISOString(),
            ultimoIntentoFallido: null,
            ultimoError: null,
            desactualizada: false,
            sinCopia: false,
            cantidad: 0,
          },
        } satisfies ClientesCopiaDto),
      ),
    );
    let clienteDelAltaDeDestino: string | undefined;
    server.use(
      http.post(`${env.apiUrl}/semillero/clientes/:numero/destinos`, ({ params }) => {
        clienteDelAltaDeDestino = String(params.numero);
        return HttpResponse.json({ id: 999, clienteNumero: 900001, nombre: "Campo X", activo: true, enUso: 0 });
      }),
    );
    await queryClient.invalidateQueries({ queryKey: semilleroKeys.clientes() });

    expect(await within(dialogo).findByText(/no está activo en la copia de MacroGest/)).toBeInTheDocument();
    // Los destinos siguen siendo los del cliente que tiene el formulario, y el alta rápida también.
    expect(within(dialogo).getByRole("option", { name: "Campo Norte" })).toBeInTheDocument();
    fireEvent.change(within(dialogo).getByLabelText("Nuevo destino"), { target: { value: "Campo X" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Agregar destino" }));
    await waitFor(() => expect(clienteDelAltaDeDestino).toBe("900001"));
  });

  it('"Orden" en una fila de cliente sin copia de clientes no culpa al cliente (R4.3)', async () => {
    server.use(
      http.get(`${env.apiUrl}/semillero/clientes`, () => HttpResponse.json(null, { status: 503 })),
    );
    renderPagina();
    await screen.findByText("BigBags propios");

    fireEvent.click(screen.getByRole("button", { name: "Orden con 26S-C01 en PLANTA" }));

    const dialogo = await screen.findByRole("dialog", { name: "Nueva orden de carga" });
    expect(within(dialogo).queryByText(/no está activo en la copia de MacroGest/)).not.toBeInTheDocument();
    expect(within(dialogo).getByText(/^Sin la copia de clientes de MacroGest/)).toBeInTheDocument();
    expect(within(dialogo).getByLabelText("Cliente")).toHaveValue("");
  });

  it('"Orden" en una fila de un cliente dado de baja avisa y no pide sus destinos (R4.3)', async () => {
    // El 900004 de la fixture está inactivo: nunca viene en la copia de clientes.
    const deClienteDeBaja: StockFilaDto = {
      loteId: 90,
      loteCodigo: "26S-B01",
      campania: "2026-2027",
      especie: "Soja",
      variedadId: 1,
      variedad: "DM 53i54",
      envase: "BigBag",
      pesoUnitarioKg: 800,
      tratada: false,
      pg: null,
      pmil: null,
      observaciones: null,
      duenio: "Cliente",
      clienteNumero: 900004,
      clienteDenominacion: "ESTANCIA DEMO LA BAJADA (BAJA)",
      ubicacionId: 2,
      ubicacion: "G1-2",
      fisico: 5,
      comprometido: 0,
      disponible: 5,
      kgDisponibles: 4000,
    };
    const sinTotales = { bigBagsDisponibles: 0, bolsasDisponibles: 0, kgDisponibles: 0 };
    server.use(
      http.get(`${env.apiUrl}/semillero/stock`, () =>
        HttpResponse.json({
          filas: [deClienteDeBaja],
          totales: { propio: sinTotales, clientes: sinTotales, kgComprometidos: 0, ordenesPendientes: 0 },
        } satisfies StockSemilleroDto),
      ),
    );
    const { queryClient } = renderPagina();
    await screen.findByText("BigBags propios");

    fireEvent.click(screen.getByRole("button", { name: "Orden con 26S-B01 en G1-2" }));

    const dialogo = await screen.findByRole("dialog", { name: "Nueva orden de carga" });
    expect(within(dialogo).getByText(/no está activo en la copia de MacroGest/)).toBeInTheDocument();
    expect(within(dialogo).getByLabelText("Cliente")).toHaveValue("");
    expect(queryClient.getQueryState(semilleroKeys.destinos(900004, false))).toBeUndefined();
  });
});
