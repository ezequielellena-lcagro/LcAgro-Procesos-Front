import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RolNombre } from "@/features/auth/types";
import { env } from "@/lib/env";
import {
  cargarDemo,
  descargarDemo,
  logisticaHandlers,
  pasarPlanDemo,
  resetLogisticaDemo,
} from "@/mocks/handlers/logistica";
import { logisticaFlotaHandlers, resetFlotaDemo } from "@/mocks/handlers/logistica-flota";
import { downloadBlob } from "@/shared/export/download-blob";
import { hoy } from "../format";
import type { GuardarCargaBody } from "../types";
import { CargasPage } from "./cargas-page";

const sesion = vi.hoisted(() => ({ roles: ["logistica-cargas"] as RolNombre[] }));
vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: 8, nombre: "Operador ficticio", roles: sesion.roles } }),
}));
vi.mock("@/shared/export/download-blob", async (original) => ({
  ...(await original<typeof import("@/shared/export/download-blob")>()),
  downloadBlob: vi.fn(),
}));
const API = `${env.apiUrl}/logistica`;
const server = setupServer(...logisticaFlotaHandlers, ...logisticaHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  server.events.removeAllListeners();
  resetLogisticaDemo();
  resetFlotaDemo();
  sesion.roles = ["logistica-cargas"];
});
afterAll(() => server.close());

async function post<T>(ruta: string, body: object) {
  const r = await fetch(`${API}/${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  return (await r.json()) as T;
}
const clave = { contrato: "V-DEMO/1", plan: 1, cupo: 1 };
/** Lo que hace el operador en MacroGest: el plan 1 al productor (directo) y el 2 a la planta. */
function otorgarEnMacroGest() {
  pasarPlanDemo("V-DEMO/1", 1, 10, 9000000001);
  pasarPlanDemo("V-DEMO/1", 2, 15, null);
}
function mostrar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CargasPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const tabla = () => screen.findByRole("table", { name: "Cargas a puerto" });
async function fila(codigo: string) {
  const celda = await within(await tabla()).findByText(new RegExp(codigo));
  return celda.closest("tr")!;
}
const selectEstado = (plan = 1, cupo = 1) =>
  screen.getByRole("combobox", { name: `Estado del cupo V-DEMO/1 plan ${plan} cupo ${cupo}` });
const abrirDatos = async () => {
  fireEvent.click(
    within(await fila("COD-DEMO-1-1")).getByRole("button", {
      name: "Camión, humedad y observaciones",
    }),
  );
  return screen.findByRole("dialog", { name: "Datos de la carga" });
};

describe("Cargas a puerto como la planilla", () => {
  it("cada cupo de MacroGest en planta 10 o 15 es una fila, con lo de MacroGest completado solo", async () => {
    otorgarEnMacroGest();
    cargarDemo(clave);
    descargarDemo(clave, 29500);
    mostrar();
    const directo = await fila("COD-DEMO-1-1");
    for (const texto of [
      "Productor ficticio",
      "DIRECTO",
      "0101-35740001",
      "AA001ZZ",
      "30.000 kg",
      "29.500 kg",
      "-500",
    ])
      expect(within(directo).getByText(texto)).toBeInTheDocument();
    const planta = await fila("COD-DEMO-2-1");
    expect(within(planta).getByText("SE CARGÓ EN PLANTA")).toBeInTheDocument();
    expect(within(planta).getByText("PLANTA")).toBeInTheDocument();
    // Lo que sigue en planta 0 no es una carga.
    expect(screen.queryByText(/COD-DEMO-3-1/)).not.toBeInTheDocument();
    // Si nadie eligió estado, se ve el que sugiere MacroGest, sin aclarar de dónde sale.
    expect(selectEstado()).toHaveDisplayValue("DESCARGADO");
    expect(selectEstado(2)).toHaveDisplayValue("DISPONIBLE");
    expect(screen.queryByText(/\(MacroGest\)/)).not.toBeInTheDocument();
  });

  it("ordena de la fecha de carga más nueva a la más vieja", async () => {
    otorgarEnMacroGest();
    mostrar();
    await fila("COD-DEMO-1-1");
    const codigos = within(await tabla())
      .getAllByRole("row")
      .map((tr) => tr.textContent?.match(/COD-DEMO-\d-\d/)?.[0])
      .filter(Boolean);
    expect(codigos).toEqual([
      "COD-DEMO-2-1",
      "COD-DEMO-2-2",
      "COD-DEMO-1-1",
      "COD-DEMO-1-2",
      "COD-DEMO-4-1",
    ]);
  });

  it("el estado se elige del desplegable en la misma fila y MacroGest lo adelanta", async () => {
    otorgarEnMacroGest();
    const cuerpos: GuardarCargaBody[] = [];
    server.events.on("request:start", async ({ request }) => {
      if (request.method === "PUT" && request.url.endsWith("/logistica/cargas"))
        cuerpos.push((await request.clone().json()) as GuardarCargaBody);
    });
    mostrar();
    await fila("COD-DEMO-1-1");
    fireEvent.change(selectEstado(), { target: { value: "CARGANDO" } });
    await waitFor(() => expect(cuerpos).toHaveLength(1));
    expect(cuerpos[0]).toMatchObject({ ...clave, revision: null, estado: "CARGANDO" });
    await waitFor(() => expect(selectEstado()).toHaveValue("CARGANDO"));
    // Elegir el que sugiere MacroGest es volver a seguirlo: no queda guardado a mano.
    fireEvent.change(selectEstado(), { target: { value: "DISPONIBLE" } });
    await waitFor(() => expect(cuerpos).toHaveLength(2));
    expect(cuerpos[1]).toMatchObject({ ...clave, revision: 1, estado: null });
    await waitFor(() => expect(selectEstado()).toHaveValue("DISPONIBLE"));
    fireEvent.change(selectEstado(), { target: { value: "CARGANDO" } });
    await waitFor(() => expect(selectEstado()).toHaveValue("CARGANDO"));
    // Cuando MacroGest tiene la carta de porte, el estado avanza solo.
    cargarDemo(clave);
    cleanup();
    mostrar();
    await fila("COD-DEMO-1-1");
    expect(selectEstado()).toHaveValue("EN VIAJE");
  });

  it("una excepción elegida a mano no la pisa MacroGest", async () => {
    otorgarEnMacroGest();
    mostrar();
    await fila("COD-DEMO-1-1");
    fireEvent.change(selectEstado(), { target: { value: "RECHAZADO" } });
    await waitFor(() => expect(selectEstado()).toHaveValue("RECHAZADO"));
    cargarDemo(clave);
    cleanup();
    mostrar();
    await fila("COD-DEMO-1-1");
    expect(selectEstado()).toHaveValue("RECHAZADO");
  });

  it("camión del padrón de Flete, humedad y observación de calidad", async () => {
    otorgarEnMacroGest();
    await post("flota", {
      patenteChasis: "AB 123 CD",
      patenteAcoplado: null,
      conductor: "Conductor ficticio",
      cuitConductor: null,
      transportista: null,
      cuitTransportista: null,
      importeReferencia: "31800",
      moneda: "ARS",
      vigenteDesde: hoy(),
    });
    mostrar();
    const dialogo = await abrirDatos();
    fireEvent.click(await within(dialogo).findByRole("radio", { name: "Elegir camión AB 123 CD" }));
    fireEvent.change(within(dialogo).getByLabelText("Humedad (%)"), { target: { value: "12,5" } });
    fireEvent.change(within(dialogo).getByLabelText("Obs. calidad"), {
      target: { value: "Grano partido" },
    });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Guardar carga" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Datos de la carga" })).not.toBeInTheDocument(),
    );
    const actualizada = await fila("COD-DEMO-1-1");
    expect(await within(actualizada).findByText("Conductor ficticio")).toBeInTheDocument();
    expect(within(actualizada).getByText("12.5")).toBeInTheDocument();
    expect(within(actualizada).getByText("Grano partido")).toBeInTheDocument();
    expect(within(actualizada).getByText("31.800")).toBeInTheDocument();
  });

  it("la humedad fuera de rango no se guarda", async () => {
    otorgarEnMacroGest();
    let puts = 0;
    server.use(
      http.put(`${API}/cargas`, () => {
        puts++;
        return undefined;
      }),
    );
    mostrar();
    const dialogo = await abrirDatos();
    fireEvent.change(within(dialogo).getByLabelText("Humedad (%)"), { target: { value: "140" } });
    expect(within(dialogo).getByRole("alert")).toHaveTextContent("La humedad va de 0 a 100.");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Guardar carga" }));
    expect(puts).toBe(0);
  });

  it("lectura ve la planilla sin editar y exporta el XLSX", async () => {
    sesion.roles = ["logistica-lectura"];
    otorgarEnMacroGest();
    mostrar();
    const directo = await fila("COD-DEMO-1-1");
    expect(within(directo).getByText("DISPONIBLE")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Estado del cupo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Camión, humedad/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exportar XLSX" }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledOnce());
    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe("cargas-a-puerto.xlsx");
  });

  it("filtra por carga en (planta o directo) y por estado", async () => {
    otorgarEnMacroGest();
    cargarDemo(clave);
    mostrar();
    await fila("COD-DEMO-2-1");
    fireEvent.change(screen.getByLabelText("Carga en"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(screen.queryByText(/COD-DEMO-2-1/)).not.toBeInTheDocument());
    expect(await screen.findByText(/COD-DEMO-1-1/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "EN VIAJE" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(screen.queryByText(/COD-DEMO-1-2/)).not.toBeInTheDocument());
    expect(await screen.findByText(/COD-DEMO-1-1/)).toBeInTheDocument();
  });
});
