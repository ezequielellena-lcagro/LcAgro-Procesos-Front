import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { RolNombre } from "@/features/auth/types";
import { env } from "@/lib/env";
import { logisticaHandlers, resetLogisticaDemo } from "@/mocks/handlers/logistica";
import { hoy, sumarDias } from "../format";
import { PedidoDialog } from "../components/pedido-dialog";
import { PedidosPage } from "./pedidos-page";
import { CuposPage } from "./cupos-page";
import { SolicitarCuposPage } from "./solicitar-cupos-page";
const sesion = vi.hoisted(() => ({ roles: ["logistica-lectura"] as RolNombre[] }));
vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: 8, nombre: "Operador ficticio", roles: sesion.roles } }),
}));
const server = setupServer(...logisticaHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetLogisticaDemo();
  sesion.roles = ["logistica-lectura"];
});
afterAll(() => server.close());
function mostrar(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>,
  );
}
function mostrarCupos() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/logistica/cupos"]}>
        <Routes>
          <Route path="/logistica/cupos" element={<CuposPage />} />
          <Route path="/logistica/cupos/solicitar" element={<SolicitarCuposPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("Logística operativa", () => {
  it("arranca en blanco y lectura general no ve acciones de escritura", async () => {
    mostrar(<PedidosPage />);
    expect(await screen.findByText(/Todavía no hay pedidos/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nuevo pedido" })).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Pedidos de Logística" })).toBeInTheDocument();
  });
  it("la preventa seleccionada se muestra en tabla y un reintento conserva clave y cuerpo", async () => {
    const claves: string[] = [],
      cuerpos: unknown[] = [];
    let intento = 0;
    server.use(
      http.post(`${env.apiUrl}/logistica/pedidos`, async ({ request }) => {
        claves.push(request.headers.get("Idempotency-Key") ?? "");
        cuerpos.push(await request.json());
        intento++;
        return intento === 1
          ? HttpResponse.json({ detail: "Respuesta interrumpida", status: 500 }, { status: 500 })
          : HttpResponse.json({ id: "demo", revision: 1 });
      }),
    );
    const cerrar = vi.fn();
    mostrar(<PedidoDialog onClose={cerrar} />);
    const elegir = await screen.findByRole("radio", { name: "Elegir preventa PF-DEMO/1" });
    fireEvent.click(elegir);
    // La elección se lee en la fila remarcada de la grilla; no se repite en otra tabla ni en texto.
    expect(elegir).toBeChecked();
    expect(screen.queryByRole("table", { name: "Preventa seleccionada" })).not.toBeInTheDocument();
    expect(elegir.closest("tr")).toHaveClass("bg-clementina/20");
    fireEvent.click(screen.getByRole("button", { name: "Guardar pedido" }));
    expect(await screen.findByRole("button", { name: "Reintentar operación" })).toBeInTheDocument();
    expect(screen.getByLabelText("Cupos que pide")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar operación" }));
    await waitFor(() => expect(cerrar).toHaveBeenCalledOnce());
    expect(claves).toHaveLength(2);
    expect(claves[0]).toBe(claves[1]);
    expect(cuerpos[0]).toEqual(cuerpos[1]);
  });
  it("elegida la preventa, el alta de arriba es la suya y el diálogo abre filtrado y con los datos sobre la grilla", async () => {
    sesion.roles = ["logistica-pedidos"];
    mostrar(<PedidosPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Preventas MacroGest" }));
    fireEvent.click(await screen.findByRole("radio", { name: "Elegir preventa PF-DEMO/1" }));
    expect(screen.queryByRole("button", { name: "Nuevo pedido" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Crear pedido con PF PF-DEMO/1" }));
    const dialogo = await screen.findByRole("dialog", { name: "Nuevo pedido" });
    expect(within(dialogo).getByLabelText("Buscar preventa")).toHaveValue("PF-DEMO/1");
    expect(
      within(dialogo).queryByRole("table", { name: "Preventa seleccionada" }),
    ).not.toBeInTheDocument();
    // Los datos del pedido van ENTRE los filtros y la grilla: cargarlos no exige cruzar las filas.
    const cupos = within(dialogo).getByLabelText("Cupos que pide");
    const grilla = await within(dialogo).findByRole("table", { name: "Elegir preventa" });
    expect(cupos.compareDocumentPosition(grilla) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("solicita desde el historial sin destino y los conseguidos se cuentan solos", async () => {
    sesion.roles = ["logistica-cupos"];
    mostrarCupos();
    // Solicitar vive dentro de la última solapa, no en la cabecera de Cupos.
    expect(screen.queryByRole("button", { name: "Solicitar cupos" })).not.toBeInTheDocument();
    const solapas = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(solapas).toEqual(["Resumen", "Historial de pedidos de cupo"]);
    fireEvent.click(screen.getByRole("tab", { name: "Historial de pedidos de cupo" }));
    fireEvent.click(await screen.findByRole("button", { name: "Solicitar cupos" }));
    // Pantalla propia, no modal: la grilla paginada arriba y los datos de la solicitud abajo.
    await screen.findByRole("heading", { name: "Solicitar cupos a terminal" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const elegirContrato = await screen.findByRole("radio", { name: "Elegir contrato V-DEMO/1" });
    fireEvent.click(elegirContrato);
    // El contrato elegido ya no se repite en un panel de cabecera: queda remarcado en la grilla y
    // el formulario, que va DEBAJO de ella, lo nombra en su primera línea.
    expect(screen.queryByRole("region", { name: "Contrato elegido" })).not.toBeInTheDocument();
    const grilla = screen.getByRole("table", { name: "Elegir contrato de venta" });
    const linea = screen.getByText(/^Contrato V-DEMO\/1 ·/);
    expect(grilla.compareDocumentPosition(linea) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Segundo clic sobre el mismo radio: suelta el contrato y el formulario vuelve a bloquearse.
    fireEvent.click(elegirContrato);
    expect(elegirContrato).not.toBeChecked();
    expect(screen.getByLabelText("Cantidad de cupos")).toBeDisabled();
    fireEvent.click(elegirContrato);
    // Quedan fecha, cantidad y canal; sin destino y con WhatsApp de arranque.
    expect(screen.queryByLabelText("Destino solicitado")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Canal")).toHaveValue("WhatsApp");
    // El MacroGest de la demo tiene tres cupos del contrato para mañana (uno ya en planta 10):
    // cuentan todos, en cualquier planta.
    fireEvent.change(screen.getByLabelText("Fecha solicitada"), {
      target: { value: sumarDias(hoy(), 1) },
    });
    fireEvent.change(screen.getByLabelText("Cantidad de cupos"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar solicitud" }));
    // Guardar vuelve al historial con el pedido ya en la grilla y lo conseguido contado.
    const tabla = await screen.findByRole("table", { name: "Historial de pedidos de cupo" });
    const fila = (await within(tabla).findByText("WhatsApp")).closest("tr")!;
    expect(
      within(fila)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(expect.arrayContaining(["4", "3", "1"]));
    expect(screen.queryByRole("button", { name: "Respuesta" })).not.toBeInTheDocument();
    fireEvent.click(within(fila).getByRole("button", { name: "Cerrar demanda" }));
    const dialogo = await screen.findByRole("dialog", { name: "Cerrar pedido de cupo" });
    fireEvent.change(within(dialogo).getByLabelText("Motivo de cierre"), {
      target: { value: "La terminal no da más" },
    });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cerrar pedido de cupo" }));
    expect(await within(tabla).findByText("Cerrada")).toBeInTheDocument();
    // Los cupos ya no se reciben a mano: son los de MacroGest.
    expect(screen.queryByRole("button", { name: "Recibir" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recibir cupos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Cupos recibidos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Cupos MacroGest" })).not.toBeInTheDocument();
  });
  it("soltar la preventa elegida devuelve el alta sin preventa", async () => {
    sesion.roles = ["logistica-pedidos"];
    mostrar(<PedidosPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Preventas MacroGest" }));
    const elegir = await screen.findByRole("radio", { name: "Elegir preventa PF-DEMO/1" });
    fireEvent.click(elegir);
    expect(screen.getByRole("button", { name: /Crear pedido con/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nuevo pedido" })).not.toBeInTheDocument();
    // Segundo clic sobre el mismo radio: un radio no se destilda solo, y sin esto el alta libre
    // quedaba tapada hasta recargar la página.
    fireEvent.click(elegir);
    expect(elegir).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Nuevo pedido" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar selección" })).not.toBeInTheDocument();
  });
  it("una caída de lectura se muestra como error y permite reintentar", async () => {
    server.use(
      http.get(`${env.apiUrl}/logistica/pedidos`, () =>
        HttpResponse.json({ detail: "Origen no disponible", status: 503 }, { status: 503 }),
      ),
    );
    mostrar(<PedidosPage />);
    expect(await screen.findByText("Origen no disponible")).toBeInTheDocument();
    expect(screen.queryByText(/Todavía no hay pedidos/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
