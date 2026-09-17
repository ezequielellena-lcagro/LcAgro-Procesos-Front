import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { env } from "@/lib/env";
import { semilleroHandlers } from "@/mocks/handlers/semillero";
import { semilleroKeys } from "../queries/keys";
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

function renderPagina() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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
    let liberarStock = () => {};
    const stockDemorado = new Promise<void>((resolver) => (liberarStock = resolver));
    server.use(
      http.get(`${env.apiUrl}/semillero/stock`, async ({ request }) => {
        if (new URL(request.url).search === "") await stockDemorado;
        // Sin respuesta propia: sigue al handler de la fixture.
      }),
    );

    fireEvent.click(screen.getByRole("tab", { name: /Órdenes de carga/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Editar orden N° 1" }));

    await waitFor(() =>
      expect(queryClient.getQueryState(semilleroKeys.stock({}))?.fetchStatus).toBe("fetching"),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    liberarStock();
    const dialogo = await screen.findByRole("dialog", { name: "Editar orden N° 1" });
    expect(within(dialogo).getByText(/^Lote 26S-C01 · PLANTA/)).toBeInTheDocument();
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
});
