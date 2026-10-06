import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { RolNombre } from "@/features/auth/types";
import { env } from "@/lib/env";
import { logisticaHandlers, resetLogisticaDemo } from "@/mocks/handlers/logistica";
import { hoy, sumarDias } from "../format";
import { PedidoDialog } from "../components/pedido-dialog";
import { PedidosPage } from "./pedidos-page";
import { CuposPage } from "./cupos-page";
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
    fireEvent.click(await screen.findByRole("radio", { name: "Elegir preventa PF-DEMO/1" }));
    const seleccion = await screen.findByRole("table", { name: "Preventa seleccionada" });
    expect(within(seleccion).getByText("Productor ficticio")).toBeInTheDocument();
    expect(within(seleccion).getByText("300.000 kg")).toBeInTheDocument();
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
      within(dialogo).getByRole("table", { name: "Preventa seleccionada" }),
    ).toBeInTheDocument();
    // Los datos del pedido van ENTRE los filtros y la grilla: cargarlos no exige cruzar las filas.
    const cupos = within(dialogo).getByLabelText("Cupos que pide");
    const grilla = await within(dialogo).findByRole("table", { name: "Elegir preventa" });
    expect(cupos.compareDocumentPosition(grilla) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("registra cero sin crear cupos y luego recibe filas con seguimiento", async () => {
    sesion.roles = ["logistica-cupos"];
    mostrar(<CuposPage />);
    fireEvent.click(screen.getByRole("button", { name: "Solicitar cupos" }));
    fireEvent.click(await screen.findByRole("button", { name: "Elegir V-DEMO/1" }));
    fireEvent.change(screen.getByLabelText("Cantidad de cupos"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar solicitud" }));
    fireEvent.click(await screen.findByRole("button", { name: "Respuesta" }));
    fireEvent.change(screen.getByLabelText("Referencia del mensaje"), {
      target: { value: "Mensaje ficticio" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar respuesta" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const tabla = screen.getByRole("table", { name: "Solicitudes a terminal" });
    expect(within(tabla).queryByText("Sin respuesta")).not.toBeInTheDocument();
    expect(within(tabla).getAllByText("0")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Recibir" }));
    fireEvent.change(screen.getByLabelText("Referencia de recepción"), {
      target: { value: "Recepción ficticia" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar fila" }));
    fireEvent.change(screen.getByLabelText("Fecha de carga fila 2"), {
      target: { value: sumarDias(hoy(), 1) },
    });
    fireEvent.change(screen.getByLabelText("Circuito fila 2"), { target: { value: "propia" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar recepción completa" }));
    expect(
      await screen.findByText("Se recibieron 2 cupos y se creó su seguimiento."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Hay filas con fecha o destino distintos a lo solicitado."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver cupos recibidos" }));
    await waitFor(() => expect(screen.getAllByText("por iniciar")).toHaveLength(2));
    expect(screen.getAllByText("Pendiente de informar")).toHaveLength(2);
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
