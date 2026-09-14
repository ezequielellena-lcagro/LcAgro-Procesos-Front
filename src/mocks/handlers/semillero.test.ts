import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { apiClient } from "@/lib/api-client";
import type {
  AjusteInput,
  AnularOrdenInput,
  CatalogosSemilleroDto,
  ClientesCopiaDto,
  DestinoAltaInput,
  DestinoDto,
  EstadoCopiaClientesDto,
  OrdenCargaDto,
  OrdenCargaInput,
  StockSemilleroDto,
} from "@/features/semillero/types";
import { semilleroHandlers } from "./semillero";

const server = setupServer(...semilleroHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers(...semilleroHandlers));
afterAll(() => server.close());

// Números de cliente FICTICIOS de esta fixture, para referenciarlos por nombre en los tests.
const CLIENTE_A = 900001; // dueño del lote de cliente sembrado
const CLIENTE_B = 900002;

describe("mocks de demo: semillero", () => {
  it("la copia de clientes sólo trae ficticios activos, nunca datos reales de La Clementina", async () => {
    const { data } = await apiClient.get<ClientesCopiaDto>("/semillero/clientes");
    expect(data.clientes.length).toBeGreaterThan(0);
    for (const c of data.clientes) {
      expect(c.denominacion).toContain("DEMO");
    }
    // el cliente inactivo de la fixture nunca aparece (decisión #3 — nunca sale del selector)
    expect(data.clientes.some((c) => c.denominacion.includes("BAJA"))).toBe(false);
  });

  it("la copia arranca desactualizada, para mostrar el aviso apenas se abre la demo (R2.3)", async () => {
    const { data } = await apiClient.get<ClientesCopiaDto>("/semillero/clientes");
    expect(data.copia.desactualizada).toBe(true);
    expect(data.copia.sinCopia).toBe(false);
  });

  it("sincronizar alterna 503 (MacroGest caído) y éxito, para demostrar R2.3/R2.4", async () => {
    const primero = await apiClient
      .post<EstadoCopiaClientesDto>("/semillero/clientes/sincronizar")
      .catch((e) => e.response);
    expect(primero.status).toBe(503);

    const segundo = await apiClient.post<EstadoCopiaClientesDto>("/semillero/clientes/sincronizar");
    expect(segundo.status).toBe(200);
    expect(segundo.data.desactualizada).toBe(false);
    expect(segundo.data.cantidad).toBeGreaterThan(0);
  });

  it("los destinos de un cliente nunca se filtran a otro (R1.3)", async () => {
    const deA = await apiClient.get<DestinoDto[]>(`/semillero/clientes/${CLIENTE_A}/destinos`);
    const deB = await apiClient.get<DestinoDto[]>(`/semillero/clientes/${CLIENTE_B}/destinos`);
    expect(deA.data.length).toBeGreaterThan(0);
    expect(deA.data.every((d) => d.clienteNumero === CLIENTE_A)).toBe(true);
    expect(deB.data.every((d) => d.clienteNumero === CLIENTE_B)).toBe(true);
  });

  it("el alta rápida de destino es idempotente: mismo nombre normalizado vuelve con el mismo id", async () => {
    const input: DestinoAltaInput = { nombre: "Campo Nuevo Demo" };
    const primero = await apiClient.post<DestinoDto>(
      `/semillero/clientes/${CLIENTE_A}/destinos`,
      input,
    );
    expect(primero.status).toBe(201);

    const segundo = await apiClient.post<DestinoDto>(`/semillero/clientes/${CLIENTE_A}/destinos`, {
      nombre: "  campo nuevo demo  ",
    } satisfies DestinoAltaInput);
    expect(segundo.status).toBe(200);
    expect(segundo.data.id).toBe(primero.data.id);
  });

  it("el stock separa los totales propios de los del cliente, nunca se suman (ADR-13)", async () => {
    const { data } = await apiClient.get<StockSemilleroDto>("/semillero/stock");
    expect(data.filas.some((f) => f.duenio === "Propio")).toBe(true);
    expect(data.filas.some((f) => f.duenio === "Cliente")).toBe(true);
    expect(data.totales.propio.kgDisponibles).toBeGreaterThan(0);
    expect(data.totales.clientes.kgDisponibles).toBeGreaterThan(0);
  });

  it("catalogos trae la campaña sugerida en formato AAAA-AAAA, dentro de las opciones", async () => {
    const { data } = await apiClient.get<CatalogosSemilleroDto>("/semillero/catalogos");
    expect(data.campaniaSugerida).toMatch(/^\d{4}-\d{4}$/);
    expect(data.campanias).toContain(data.campaniaSugerida);
    expect(data.variedades.length).toBeGreaterThan(0);
    expect(data.ubicaciones.length).toBeGreaterThan(0);
  });

  it("regla de dueño: un lote de un cliente no se puede cargar en la orden de otro cliente (R4.4)", async () => {
    // Averigua, del stock, un lote de CLIENTE_A para pedirlo en una orden de CLIENTE_B.
    const stock = await apiClient.get<StockSemilleroDto>("/semillero/stock");
    const loteDeA = stock.data.filas.find(
      (f) => f.duenio === "Cliente" && f.clienteNumero === CLIENTE_A,
    )!;
    expect(loteDeA).toBeDefined();

    const destinosB = await apiClient.get<DestinoDto[]>(
      `/semillero/clientes/${CLIENTE_B}/destinos`,
    );
    const input: OrdenCargaInput = {
      clienteNumero: CLIENTE_B,
      destinoId: destinosB.data[0].id,
      numeroPedidoVenta: null,
      observaciones: null,
      items: [{ loteId: loteDeA.loteId, ubicacionId: loteDeA.ubicacionId, cantidad: 1 }],
    };

    const error = await apiClient
      .post<OrdenCargaDto>("/semillero/ordenes", input)
      .catch((e) => e.response);
    expect(error.status).toBe(409);
    expect(error.data.detail).toContain(loteDeA.loteCodigo);
  });

  it("una orden mixta (propio + del mismo cliente) se crea y reserva stock", async () => {
    const stock = await apiClient.get<StockSemilleroDto>("/semillero/stock");
    const propio = stock.data.filas.find((f) => f.duenio === "Propio" && f.disponible > 0)!;
    const deA = stock.data.filas.find(
      (f) => f.duenio === "Cliente" && f.clienteNumero === CLIENTE_A,
    )!;
    const destinosA = await apiClient.get<DestinoDto[]>(
      `/semillero/clientes/${CLIENTE_A}/destinos`,
    );

    const input: OrdenCargaInput = {
      clienteNumero: CLIENTE_A,
      destinoId: destinosA.data[0].id,
      numeroPedidoVenta: "06-00099",
      observaciones: null,
      items: [
        { loteId: propio.loteId, ubicacionId: propio.ubicacionId, cantidad: 1 },
        { loteId: deA.loteId, ubicacionId: deA.ubicacionId, cantidad: 1 },
      ],
    };

    const { data, status } = await apiClient.post<OrdenCargaDto>("/semillero/ordenes", input);
    expect(status).toBe(201);
    expect(data.estado).toBe("Pendiente");
    expect(data.totalKgPropio).toBeGreaterThan(0);
    expect(data.totalKgCliente).toBeGreaterThan(0);
  });

  it('el motivo "Otro" exige detalle al ajustar stock', async () => {
    const stock = await apiClient.get<StockSemilleroDto>("/semillero/stock");
    const fila = stock.data.filas[0];
    const input: AjusteInput = {
      loteId: fila.loteId,
      ubicacionId: fila.ubicacionId,
      cantidad: 1,
      motivo: "Otro",
      observacion: null,
    };
    const error = await apiClient
      .post("/semillero/movimientos/ajuste", input)
      .catch((e) => e.response);
    expect(error.status).toBe(400);
  });

  it('el motivo "Otro" exige detalle al anular una orden, y una vez anulada libera la reserva', async () => {
    const stock = await apiClient.get<StockSemilleroDto>("/semillero/stock");
    const deA = stock.data.filas.find(
      (f) => f.duenio === "Cliente" && f.clienteNumero === CLIENTE_A,
    )!;
    const destinosA = await apiClient.get<DestinoDto[]>(
      `/semillero/clientes/${CLIENTE_A}/destinos`,
    );
    const orden = await apiClient.post<OrdenCargaDto>("/semillero/ordenes", {
      clienteNumero: CLIENTE_A,
      destinoId: destinosA.data[0].id,
      numeroPedidoVenta: null,
      observaciones: null,
      items: [{ loteId: deA.loteId, ubicacionId: deA.ubicacionId, cantidad: 1 }],
    } satisfies OrdenCargaInput);

    const sinDetalle: AnularOrdenInput = { motivo: "Otro", detalle: null };
    const error = await apiClient
      .post(`/semillero/ordenes/${orden.data.id}/anular`, sinDetalle)
      .catch((e) => e.response);
    expect(error.status).toBe(400);

    const conDetalle: AnularOrdenInput = { motivo: "Otro", detalle: "Se armó de más por error." };
    const anulada = await apiClient.post<OrdenCargaDto>(
      `/semillero/ordenes/${orden.data.id}/anular`,
      conDetalle,
    );
    expect(anulada.data.estado).toBe("Anulada");

    const stockLuego = await apiClient.get<StockSemilleroDto>("/semillero/stock");
    const filaLuego = stockLuego.data.filas.find(
      (f) => f.loteId === deA.loteId && f.ubicacionId === deA.ubicacionId,
    )!;
    expect(filaLuego.disponible).toBe(deA.disponible); // la reserva se liberó al anular
  });
});
