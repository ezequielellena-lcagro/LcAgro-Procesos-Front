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
import type {
  ClaveCupo,
  FichaFlotaDto,
  GuardarCargaBody,
  OtorgarResultado,
  Pedido,
} from "../types";
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
/** Todo otorgamiento sale de un pedido: se crea uno por cupo y se le otorga. */
async function otorgar(cupo: ClaveCupo = clave) {
  const pedido = await post<Pedido>("pedidos", {
    clienteNumero: 9000000001,
    producto: 10,
    campania: "2025-2026",
    fechaSolicitada: hoy(),
    cantidadCupos: 1,
    preventa: null,
    observacion: null,
  });
  return post<OtorgarResultado>("otorgamientos", {
    pedidoId: pedido.id,
    pedidoRevision: pedido.revision,
    cupos: [cupo],
  });
}
const pasarAlProductor = (plan = 1) => pasarPlanDemo("V-DEMO/1", plan, 10, 9000000001);
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

describe("Cargas a puerto leyendo MacroGest", () => {
  it.each([
    ["sin pasar en MacroGest", () => undefined, "Falta pasarlo en MacroGest"],
    ["plan pasado al productor", () => pasarAlProductor(), "Por cargar"],
    [
      "con carta de porte",
      () => {
        pasarAlProductor();
        cargarDemo(clave);
      },
      "En viaje",
    ],
    [
      "con descarga",
      () => {
        pasarAlProductor();
        cargarDemo(clave);
        descargarDemo(clave, 29500);
      },
      "Descargado",
    ],
  ])("el estado sale de MacroGest: %s", async (_caso, preparar, esperado) => {
    await otorgar();
    preparar();
    mostrar();
    expect(await within(await tabla()).findByText(esperado)).toBeInTheDocument();
  });

  it("muestra carta de porte, CTG, patente y kilos de MacroGest; nada de eso se carga a mano", async () => {
    await otorgar();
    pasarAlProductor();
    cargarDemo(clave);
    descargarDemo(clave, 29500);
    mostrar();
    const fila = (await within(await tabla()).findByText("COD-DEMO-1-1")).closest("tr")!;
    for (const texto of ["0101-35740001", "CTG-DEMO", "AA001ZZ", "30.000 kg", "29.500 kg"])
      expect(within(fila).getByText(texto)).toBeInTheDocument();
    fireEvent.click(within(fila).getByRole("button", { name: /Camión/ }));
    const dialogo = await screen.findByRole("dialog", { name: "Camión y observación" });
    expect(within(dialogo).queryByLabelText(/Kg|Patente operativa/)).not.toBeInTheDocument();
  });

  it("elige un camión del padrón de Flete y anota una observación", async () => {
    await otorgar();
    const ficha = await post<FichaFlotaDto>("flota", {
      patenteChasis: "AB 123 CD",
      patenteAcoplado: null,
      conductor: "Conductor ficticio",
      cuitConductor: null,
      transportista: null,
      cuitTransportista: null,
      importeReferencia: null,
      moneda: null,
      vigenteDesde: null,
    });
    const cuerpos: GuardarCargaBody[] = [];
    server.use(
      http.put(`${API}/cargas/:id`, async ({ request }) => {
        cuerpos.push((await request.clone().json()) as GuardarCargaBody);
      }),
    );
    mostrar();
    const fila = (await within(await tabla()).findByText("COD-DEMO-1-1")).closest("tr")!;
    fireEvent.click(within(fila).getByRole("button", { name: /Camión/ }));
    const dialogo = await screen.findByRole("dialog", { name: "Camión y observación" });
    fireEvent.click(await within(dialogo).findByRole("radio", { name: "Elegir camión AB 123 CD" }));
    fireEvent.change(within(dialogo).getByLabelText("Observación (opcional)"), {
      target: { value: "Sale temprano" },
    });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Guardar carga" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Camión y observación" }),
      ).not.toBeInTheDocument(),
    );
    expect(cuerpos[0]).toEqual({
      revision: null,
      fichaId: ficha.id,
      versionId: ficha.versionId,
      observacion: "Sale temprano",
    });
    const actualizada = await tabla();
    expect(await within(actualizada).findByText("AB 123 CD")).toBeInTheDocument();
    expect(within(actualizada).getByText("Sale temprano")).toBeInTheDocument();
  });

  it("lectura ve las cargas sin poder elegir camión y exporta el XLSX", async () => {
    sesion.roles = ["logistica-lectura"];
    await otorgar();
    mostrar();
    await within(await tabla()).findByText("COD-DEMO-1-1");
    expect(screen.queryByRole("button", { name: /Camión/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exportar XLSX" }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledOnce());
    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe("cargas-a-puerto.xlsx");
  });

  it("arranca en la campaña vigente y filtra por la campaña del pedido", async () => {
    await otorgar();
    mostrar();
    const lista = await tabla();
    expect(await within(lista).findByText("COD-DEMO-1-1")).toBeInTheDocument();
    expect(screen.getByLabelText("Campaña")).toHaveValue("2025-2026");
    fireEvent.change(screen.getByLabelText("Campaña"), { target: { value: "2026-2027" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(within(lista).queryByText("COD-DEMO-1-1")).not.toBeInTheDocument());
  });

  it("filtra por estado sobre lo leído de MacroGest", async () => {
    await otorgar();
    await otorgar({ contrato: "V-DEMO/1", plan: 2, cupo: 1 });
    pasarAlProductor();
    mostrar();
    const lista = await tabla();
    await within(lista).findByText("Por cargar");
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "falta_pasar" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(within(lista).queryByText("Por cargar")).not.toBeInTheDocument());
    expect(within(lista).getByText("Falta pasarlo en MacroGest")).toBeInTheDocument();
  });
});
