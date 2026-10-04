import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { env } from "@/lib/env";
import { logisticaHandlers, resetLogisticaDemo } from "@/mocks/handlers/logistica";
import { erpLogisticaDemo } from "@/mocks/handlers/logistica-conciliacion";
import { crearResumenDemo } from "@/mocks/handlers/logistica-resumen";
import { hoy, periodoInicial, sumarDias } from "../format";
import { cursorResumen, claveResumen } from "../lib/resumen";
import type {
  Detalle,
  GrupoResumen,
  OtorgarResultado,
  Recepcion,
  ResumenLogistica,
  Seguimiento,
  Solicitud,
} from "../types";
const API = `${env.apiUrl}/logistica`;
const server = setupServer(...logisticaHandlers);
const auth = { Authorization: "Bearer mock-access-7" };
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
  resetLogisticaDemo();
});
afterAll(() => server.close());
async function enviar<T>(ruta: string, body: object, method = "POST") {
  const response = await fetch(`${API}/${ruta}`, {
    method,
    headers: {
      ...auth,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
  return (await response.json()) as T;
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
async function responder(s: Solicitud, cantidadCupos: number, observadoAl = `${hoy()}T12:00:00Z`) {
  return enviar<Solicitud>(`solicitudes-terminal/${s.id}/respuestas`, {
    revision: s.revision,
    cantidadCupos,
    observadoAl,
    referencia: "Respuesta ficticia",
  });
}
async function recibir(
  solicitudId: string | null,
  cantidad = 1,
  fechaCarga = hoy(),
  destinoCodigo = 101,
) {
  return enviar<Recepcion>("cupos/recepciones", {
    contratoVenta: "V-DEMO/1",
    solicitudId,
    referencia: "Recepción ficticia",
    recibidoAl: `${hoy()}T12:00:00Z`,
    filas: Array.from({ length: cantidad }, (_, i) => ({
      ordinal: i + 1,
      fechaCarga,
      destinoCodigo,
      codigoTerminal: "DEMO-01",
      circuito: "directa",
      lugarTipo: "planta",
      lugarReferencia: null,
    })),
  });
}
async function resumen(extra: object = {}) {
  const p = new URLSearchParams(
    Object.entries({ ...periodoInicial(), ...extra }).map(([k, v]) => [k, String(v)]),
  );
  const response = await fetch(`${API}/resumen?${p}`, { headers: auth });
  expect(response.status).toBe(200);
  return (await response.json()) as ResumenLogistica;
}
async function seguimiento(id: string) {
  const response = await fetch(`${API}/seguimientos/${id}`, { headers: auth });
  return ((await response.json()) as Detalle<Seguimiento>).dato;
}
describe("Resumen real del store canónico", () => {
  it("vacío conserva ausencia, origen y reset vacía también el resumen", async () => {
    expect(await resumen()).toMatchObject({
      filas: [],
      hayMas: false,
      fuente: "logistica",
      baseFecha: "fecha_solicitada",
      totales: { solicitudes: 0, respuestaVigente: null, porRecibir: null },
    });
    await solicitar();
    expect((await resumen()).totales.solicitudes).toBe(1);
    resetLogisticaDemo();
    expect((await resumen()).totales.solicitudes).toBe(0);
  });
  it("última revisión 2 luego 3 reemplaza aunque el observado sea anterior; mezcla null y cero", async () => {
    let s = await solicitar();
    s = await responder(s, 2);
    await responder(s, 3, `${sumarDias(hoy(), -20)}T12:00:00Z`);
    await responder(await solicitar(8), 0);
    await solicitar(9);
    const r = await resumen();
    expect(r.filas).toHaveLength(1);
    expect(r.totales).toMatchObject({
      solicitudes: 3,
      solicitados: 22,
      respuestaVigente: 3,
      sinRespuesta: 1,
      respuestaCero: 1,
      recibidos: 0,
      porRecibir: 3,
    });
    expect(r.filas[0].metricas).toEqual(r.totales);
    expect(r.filas[0]).toMatchObject({
      productoNombre: "Soja",
      destinoNombre: "Terminal de ejemplo",
    });
  });
  it("cohorte solicitada incluye cierre y todas las recepciones tardías con otra fecha y destino; excluye sin solicitud", async () => {
    let s = await responder(await solicitar(), 3);
    s = await enviar<Solicitud>(`solicitudes-terminal/${s.id}/cerrar`, {
      revision: s.revision,
      motivo: "Cierre ficticio",
    });
    await recibir(s.id, 3, sumarDias(hoy(), 50), 102);
    await recibir(null, 6);
    const r = await resumen({ desde: hoy(), hastaExclusivo: sumarDias(hoy(), 1) });
    expect(r.totales).toMatchObject({
      solicitudes: 1,
      cerradas: 1,
      solicitados: 5,
      respuestaVigente: 3,
      recibidos: 3,
      porRecibir: 0,
      porOtorgar: 3,
      fechaCargaDistinta: 3,
      destinoDistinto: 3,
    });
    expect(r.filas[0].destinoCodigo).toBe(101);
  });
  it("no infiere recepción sin vínculo aunque coincidan claves y mantiene todos los null", async () => {
    await solicitar();
    await recibir(null, 2);
    expect((await resumen()).totales).toMatchObject({
      respuestaVigente: null,
      porRecibir: null,
      recibidos: 0,
      sinRespuesta: 1,
    });
  });
  it("suma faltantes por solicitud sin compensar exceso A contra B", async () => {
    const a = await responder(await solicitar(), 2);
    await responder(await solicitar(), 5);
    await recibir(a.id, 4);
    expect((await resumen()).totales).toMatchObject({
      respuestaVigente: 7,
      recibidos: 4,
      porRecibir: 5,
    });
  });
  it("particiona otorgados incluso propios/anulados, disponibles, anulados sin asignar y estados activos no elegibles", async () => {
    const s = await solicitar();
    const r = await recibir(s.id, 5);
    const [propio, disponible, anulado, cargando, vinculado] = r.cupos;
    await enviar<OtorgarResultado>("otorgamientos", {
      destinatarioTipo: "propio",
      cupos: [propio, vinculado].map((c) => ({ id: c.id, revision: c.revision })),
    });
    for (const c of [propio, anulado]) {
      const seg = await seguimiento(c.id);
      await enviar(`seguimientos/${c.id}/anular`, {
        revision: seg.revision,
        motivo: "Anulación ficticia",
      });
    }
    const estado = await seguimiento(cargando.id);
    await enviar(
      `seguimientos/${cargando.id}/estado`,
      {
        revision: estado.revision,
        estadoObservado: "cargando",
        observadoAl: `${hoy()}T12:00:00Z`,
        fuente: "operador",
        referencia: "Estado ficticio",
      },
      "PUT",
    );
    const actual = await seguimiento(vinculado.id);
    const erp = erpLogisticaDemo
      .filas()
      .find((e) => e.contrato === "V-DEMO/1" && e.grupo === 701 && e.cupo === 1)!;
    await enviar(
      `cupos/${vinculado.id}/vinculo-erp`,
      {
        revision: actual.cupo.revision,
        clave: { contrato: erp.contrato, grupo: erp.grupo, cupo: erp.cupo },
        evidencia: "Vínculo ficticio",
        confirmado: true,
      },
      "PUT",
    );
    expect((await seguimiento(disponible.id)).cupo.disponibleParaOtorgar).toBe(true);
    const erpExacta = vi.spyOn(erpLogisticaDemo, "exacta");
    const erpLote = vi.spyOn(erpLogisticaDemo, "lote");
    const m = (await resumen()).totales;
    expect(erpExacta).not.toHaveBeenCalled();
    expect(erpLote).not.toHaveBeenCalled();
    expect(m).toMatchObject({
      recibidos: 5,
      otorgados: 2,
      porOtorgar: 1,
      otrosSinOtorgar: 2,
      anulados: 2,
    });
    expect(m.recibidos).toBe(m.otorgados + m.porOtorgar + m.otrosSinOtorgar);
  });
  it("filtra solicitudes antes de grupos y el destino pedido conserva recepciones en otra terminal", async () => {
    const a = await solicitar(4, 101);
    await solicitar(8, 102);
    await solicitar(12, 101, sumarDias(hoy(), 1));
    await recibir(a.id, 2, hoy(), 102);
    const r = await resumen({
      desde: hoy(),
      hastaExclusivo: sumarDias(hoy(), 1),
      destinoCodigo: "101",
      contrato: "V-DEMO/1",
      producto: "10",
      campania: "2025-2026",
    });
    expect(r.filas).toHaveLength(1);
    expect(r.totales).toMatchObject({
      solicitudes: 1,
      solicitados: 4,
      recibidos: 2,
      destinoDistinto: 2,
    });
    expect((await resumen({ contrato: "v-demo/1" })).filas).toEqual([]);
    expect((await resumen({ producto: "1" })).totales.solicitudes).toBe(0);
    expect((await resumen({ campania: "2026-2027" })).totales.solicitudes).toBe(0);
  });
  it("pagina con empates de fecha y terminal y conserva totales completos después del último grupo", async () => {
    for (let i = 0; i < 52; i++) await solicitar(i + 1, 101 + i);
    const primera = await resumen();
    expect(primera.filas).toHaveLength(50);
    expect(primera.hayMas).toBe(true);
    const siguiente = await resumen({ ...cursorResumen(primera.filas.at(-1)!), tamano: "50" });
    expect(siguiente.filas).toHaveLength(2);
    expect(siguiente.hayMas).toBe(false);
    expect(siguiente.totales).toEqual(primera.totales);
    expect(new Set([...primera.filas, ...siguiente.filas].map(claveResumen)).size).toBe(52);
    const vacia = await resumen(cursorResumen(siguiente.filas.at(-1)!));
    expect(vacia.filas).toEqual([]);
    expect(vacia.totales.solicitudes).toBe(52);
    expect(siguiente.filas.at(-1)?.destinoNombre).toBeNull();
  });
  it("aplica los cinco componentes al cursor con empates de las primeras claves", async () => {
    const s = await solicitar();
    const filas: Solicitud[] = [
      s,
      { ...s, id: crypto.randomUUID(), contratoVenta: "V-DEMO/2" },
      { ...s, id: crypto.randomUUID(), contratoVenta: "V-DEMO/2", producto: 11 },
      {
        ...s,
        id: crypto.randomUUID(),
        contratoVenta: "V-DEMO/2",
        producto: 11,
        campania: "2026-2027",
      },
      { ...s, id: crypto.randomUUID(), destinoCodigo: 102 },
      { ...s, id: crypto.randomUUID(), fechaSolicitada: sumarDias(hoy(), 1) },
    ];
    // Sólo fixture de las claves inaccesibles al catálogo demo; el cálculo usa el mismo handler.
    server.use(
      ...crearResumenDemo({
        solicitudes: () => filas,
        recepciones: () => [],
        cupos: () => [],
        seguimiento: () => null,
        productos: () => [],
        destinos: () => [],
      }),
    );
    const vistas: GrupoResumen[] = [];
    let cursor = {};
    for (let i = 0; i < filas.length; i++) {
      const r = await resumen({ tamano: "1", ...cursor });
      expect(r.filas).toHaveLength(1);
      expect(r.totales.solicitudes).toBe(6);
      vistas.push(r.filas[0]);
      cursor = cursorResumen(r.filas[0]);
    }
    expect(
      vistas.map((f) => [f.fechaSolicitada, f.destinoCodigo, f.contrato, f.producto, f.campania]),
    ).toEqual(
      filas.map((f) => [
        f.fechaSolicitada,
        f.destinoCodigo,
        f.contratoVenta,
        f.producto,
        f.campania,
      ]),
    );
    expect(new Set(vistas.map(claveResumen)).size).toBe(6);
  });

  it("historia de respuestas y varias tandas no multiplican solicitudes ni cupos; replay no duplica recepción", async () => {
    let s = await responder(await solicitar(5), 2);
    s = await responder(s, 3);
    await recibir(s.id, 2);
    const body = {
      contratoVenta: "V-DEMO/1",
      solicitudId: s.id,
      referencia: "Replay ficticio",
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
    const clave = crypto.randomUUID();
    const enviarMisma = () =>
      fetch(`${API}/cupos/recepciones`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json", "Idempotency-Key": clave },
        body: JSON.stringify(body),
      });
    const primera = await enviarMisma(),
      repetida = await enviarMisma();
    expect(await repetida.json()).toEqual(await primera.json());
    expect((await resumen()).totales).toMatchObject({
      solicitudes: 1,
      solicitados: 5,
      respuestaVigente: 3,
      recibidos: 3,
      porRecibir: 0,
    });
  });
  it("mantiene sumas mayores a Int32 sin truncar cantidades", async () => {
    await responder(await solicitar(2147483647), 2147483647);
    await responder(await solicitar(2147483647), 2147483647);
    expect((await resumen()).totales).toMatchObject({
      solicitados: 4294967294,
      respuestaVigente: 4294967294,
      porRecibir: 4294967294,
    });
  });
  it("no considera disponible un cupo sin seguimiento o con vínculo vigente sin otorgamiento", async () => {
    const s = await solicitar(),
      r = await recibir(s.id, 3);
    const actual = await seguimiento(r.cupos[1].id);
    const conVinculo: Seguimiento = {
      ...actual,
      vinculoErpVigente: {
        id: crypto.randomUUID(),
        contrato: "V-DEMO/1",
        grupo: 701,
        cupo: 1,
        vigenteDesde: new Date().toISOString(),
        evidencia: "Ficticia",
        registradoPorId: 1,
      },
    };
    const disponible = await seguimiento(r.cupos[2].id);
    // Casos defensivos que los comandos demo actuales no pueden producir; se ejercita el handler real.
    server.use(
      ...crearResumenDemo({
        solicitudes: () => [s],
        recepciones: () => [r],
        cupos: () => r.cupos,
        seguimiento: (id) =>
          id === r.cupos[0].id ? null : id === r.cupos[1].id ? conVinculo : disponible,
        productos: () => [],
        destinos: () => [],
      }),
    );
    expect((await resumen()).totales).toMatchObject({
      recibidos: 3,
      otorgados: 0,
      porOtorgar: 1,
      otrosSinOtorgar: 2,
    });
  });

  it.each([
    { desde: "2026-02-30" },
    { desde: "1752-12-31" },
    { hastaExclusivo: hoy(), desde: hoy() },
    { desde: hoy(), hastaExclusivo: sumarDias(hoy(), 367) },
    { tamano: "0" },
    { tamano: "201" },
    { tamano: "1.5" },
    { tamano: "" },
    { producto: "0" },
    { producto: "1000000" },
    { producto: "" },
    { destinoCodigo: "100000000" },
    { destinoCodigo: "-1" },
    { contrato: "abcdefghijklmnop" },
    { contrato: "  " },
    { contrato: "V\n1" },
    { campania: "2025-2027" },
    { campania: "1899-1900" },
    { despuesFecha: hoy() },
    { despuesFecha: "" },
    { despuesContrato: "" },
    {
      despuesFecha: hoy(),
      despuesDestinoCodigo: "101",
      despuesContrato: "V-DEMO/1",
      despuesProducto: "10",
      despuesCampania: "",
    },
    {
      despuesFecha: sumarDias(hoy(), -30),
      despuesDestinoCodigo: "101",
      despuesContrato: "V-DEMO/1",
      despuesProducto: "10",
      despuesCampania: "2025-2026",
    },
  ])("devuelve 400 para consulta inválida %j", async (extra) => {
    const r = await fetch(
      `${API}/resumen?${new URLSearchParams(Object.entries({ ...periodoInicial(), ...extra }).map(([k, v]) => [k, String(v)]))}`,
      { headers: auth },
    );
    expect(r.status).toBe(400);
  });

  it.each([8, 9, 10])("autoriza lectura/cargas/cupos con identidad %i", async (id) => {
    const r = await fetch(`${API}/resumen?${new URLSearchParams(periodoInicial())}`, {
      headers: { Authorization: `Bearer mock-access-${id}` },
    });
    expect(r.status).toBe(200);
  });

  it.each([
    undefined,
    "",
    "   ",
    "Bearer inválido",
    "Bearer mock-access-2",
    "Bearer mock-access-11",
  ])("rechaza anónimo, token inválido u otro rol %s", async (token) => {
    const r = await fetch(`${API}/resumen?${new URLSearchParams(periodoInicial())}`, {
      headers: token !== undefined ? { Authorization: token } : {},
    });
    expect(r.status).toBe(token?.endsWith("-2") || token?.endsWith("-11") ? 403 : 401);
  });
});
