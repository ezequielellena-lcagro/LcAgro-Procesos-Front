import { unzipSync, strFromU8 } from "fflate";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { env } from "@/lib/env";
import { logisticaHandlers, resetLogisticaDemo } from "@/mocks/handlers/logistica";
import { erpLogisticaDemo } from "@/mocks/handlers/logistica-conciliacion";
import { hoy, periodoInicial } from "../format";
import type { ConciliacionFila, Cupo, Detalle, Recepcion, Seguimiento } from "../types";
import { excelLogisticaDemo } from "@/mocks/handlers/logistica-excel";
import { crearSeguimientosDemo } from "@/mocks/handlers/logistica-seguimientos";
const API = `${env.apiUrl}/logistica`;
const server = setupServer(...logisticaHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetLogisticaDemo();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
async function enviar<T>(ruta: string, body: object, method = "POST") {
  const r = await fetch(`${API}/${ruta}`, {
    method,
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  expect(r.ok).toBe(true);
  return (await r.json()) as T;
}
async function recibir(n = 1) {
  return enviar<Recepcion>("cupos/recepciones", {
    contratoVenta: "V-DEMO/1",
    solicitudId: null,
    referencia: "=Recepción ficticia",
    recibidoAl: new Date().toISOString(),
    filas: Array.from({ length: n }, (_, i) => ({
      ordinal: i + 1,
      fechaCarga: hoy(),
      destinoCodigo: i === 0 ? 101 : 102,
      codigoTerminal: `X-${i}`,
      circuito: i === 0 ? "directa" : "propia",
      lugarTipo: "planta",
      lugarReferencia: null,
    })),
  });
}
function params(extra: Record<string, string> = {}) {
  return new URLSearchParams({ ...periodoInicial(), ...extra });
}
function libro(bytes: Uint8Array) {
  const zip = unzipSync(bytes);
  const parser = new DOMParser();
  const strings = parser.parseFromString(strFromU8(zip["xl/sharedStrings.xml"]), "application/xml");
  const textos = [...strings.querySelectorAll("si")].map((si) =>
    [...si.querySelectorAll("t")].map((t) => t.textContent ?? "").join(""),
  );
  function sheet(n: number) {
    const xml = parser.parseFromString(
      strFromU8(zip[`xl/worksheets/sheet${n}.xml`]),
      "application/xml",
    );
    const filas = [...xml.querySelectorAll("sheetData row")].map((row) =>
      Object.fromEntries(
        [...row.querySelectorAll("c")].map((c) => {
          const key = c.getAttribute("r")!.replace(/[0-9]/g, "");
          const v = c.querySelector("v")?.textContent ?? "";
          return [
            key,
            c.getAttribute("t") === "s"
              ? textos[Number(v)]
              : c.getAttribute("t") === "inlineStr"
                ? (c.querySelector("t")?.textContent ?? "")
                : v,
          ];
        }),
      ),
    );
    const [header, ...data] = filas;
    return {
      xml,
      headers: Object.values(header),
      filas: data.map((r) =>
        Object.fromEntries(Object.entries(header).map(([key, title]) => [title, r[key] ?? ""])),
      ),
    };
  }
  return { zip, seguimientos: sheet(1), metadatos: sheet(2) };
}
describe("XLSX ficticio del store único", () => {
  it("la ruta específica precede al detalle y un libro vacío conserva cabeceras/metadatos", async () => {
    const r = await fetch(`${API}/seguimientos/excel?${params()}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(r.headers.get("Content-Disposition")).toContain("seguimientos-logistica-");
    const doc = libro(new Uint8Array(await r.arrayBuffer()));
    expect(doc.seguimientos.filas).toEqual([]);
    expect(doc.seguimientos.headers).toEqual(
      expect.arrayContaining([
        "Cupo ID",
        "Cliente número",
        "Kg carga operativos",
        "Kg descarga operativos",
        "Kg carga ERP",
        "Kg descarga ERP",
        "Consulta ERP diagnóstico",
        "Incidencias",
      ]),
    );
    expect(strFromU8(doc.zip["xl/workbook.xml"])).toContain("Filtros y fuentes");
    expect(doc.metadatos.filas.some((f) => Object.values(f).some((v) => /fictici/i.test(v)))).toBe(
      true,
    );
  });
  it("exporta todas las filas del período sin depender de páginas abiertas, filtros propios y anulados", async () => {
    const recibido = await recibir(52);
    const r = await fetch(`${API}/seguimientos/excel?${params()}`);
    const doc = libro(new Uint8Array(await r.arrayBuffer()));
    expect(doc.seguimientos.filas).toHaveLength(52);
    expect(doc.seguimientos.filas.map((f) => f["Cupo ID"]).sort()).toEqual(
      recibido.cupos.map((c) => c.id).sort(),
    );
    expect(
      doc.seguimientos.filas.every((f) => f["Consulta ERP diagnóstico"] === "sin_vinculo"),
    ).toBe(true);
    expect(doc.seguimientos.xml.querySelector("f")).toBeNull();
    expect(
      doc.seguimientos.filas.every((f) =>
        ["Kg carga operativos", "Kg descarga operativos", "Kg carga ERP", "Kg descarga ERP"].every(
          (k) => f[k] === "",
        ),
      ),
    ).toBe(true);
    expect(doc.seguimientos.filas[0]["Recepción referencia"]).toBe("=Recepción ficticia");
    const elegido = recibido.cupos[0];
    await enviar(`seguimientos/${elegido.id}/anular`, {
      revision: 1,
      motivo: "Anulación ficticia",
    });
    const anulados = await fetch(
      `${API}/seguimientos/excel?${params({ anulados: "true", producto: "10", destinoCodigo: "101", circuito: "directa", contrato: "V-DEMO/1", campania: "2025-2026", estadoObservado: "por_iniciar" })}`,
    );
    const fila = libro(new Uint8Array(await anulados.arrayBuffer())).seguimientos.filas;
    expect(fila).toHaveLength(1);
    expect(fila[0]["Cupo ID"]).toBe(elegido.id);
    expect(fila[0]["Motivo anulación"]).toBe("Anulación ficticia");
  });
  it("incluye asignación, fuentes, vínculo vigente y cuatro pesos textuales exactos sin mezclar ERP", async () => {
    const r = await recibir();
    const c = r.cupos[0];
    await enviar("otorgamientos", {
      destinatarioTipo: "cliente",
      clienteNumero: 9000000001,
      cupos: [{ id: c.id, revision: 1 }],
    });
    await enviar(`seguimientos/${c.id}/datos-operativos`, {
      revision: 1,
      tipo: "kg_carga",
      kilogramos: "999999999999.9999",
      fuente: "balanza",
      observadoAl: `${hoy()}T12:00:00Z`,
      referencia: "Balanza ficticia",
    });
    await enviar(`seguimientos/${c.id}/datos-operativos`, {
      revision: 2,
      tipo: "kg_descarga",
      kilogramos: "1.0001",
      fuente: "terminal",
      observadoAl: `${hoy()}T12:00:00Z`,
      referencia: "Ticket ficticio",
    });
    await enviar(
      `cupos/${c.id}/vinculo-erp`,
      {
        revision: 4,
        clave: { contrato: "V-DEMO/1", grupo: 701, cupo: 1 },
        evidencia: "Vínculo ficticio",
        confirmado: true,
      },
      "PUT",
    );
    const erp = erpLogisticaDemo.filas()[1];
    vi.spyOn(erpLogisticaDemo, "lote").mockReturnValue([
      { ...erp, kgCargaErp: "0.0000", kgDescargaErp: "999999999999.9999", ctg: "=CTG literal" },
    ]);
    const response = await fetch(
      `${API}/seguimientos/excel?${params({ clienteNumero: "9000000001" })}`,
    );
    const doc = libro(new Uint8Array(await response.arrayBuffer()));
    const f = doc.seguimientos.filas[0];
    expect(f["Cliente número"]).toBe("9000000001");
    expect(f["Asignación"]).toBe("Cliente");
    expect(f["Cliente nombre"]).toBe("Productor ficticio");
    expect(f["Kg carga operativos"]).toBe("999999999999.9999");
    expect(f["Kg descarga operativos"]).toBe("1.0001");
    expect(f["Kg carga ERP"]).toBe("0.0000");
    expect(f["Kg descarga ERP"]).toBe("999999999999.9999");
    expect(f["Kg carga operativos fuente"]).toBe("balanza");
    expect(f["Kg descarga operativos referencia"]).toBe("Ticket ficticio");
    expect(f["Kg carga operativos observado al (UTC-3)"]).toContain("09:00:00 -03:00");
    expect(f["Consulta ERP diagnóstico"]).toBe("verificado");
    expect(f["Incidencias"]).toContain("kg_carga_diferente");
    expect(f["CTG ERP"]).toBe("=CTG literal");
    expect(doc.seguimientos.xml.querySelector("f")).toBeNull();
  });
  it.each<Record<string, string>>([
    { tamano: "0" },
    { tamano: "201" },
    { tamano: "inválido" },
    { despuesId: crypto.randomUUID() },
    { desde: "2026-02-31" },
    { producto: "0" },
    { destinoCodigo: "-1" },
    { campania: "2025-2027" },
    { anulados: "otro" },
    { circuito: "inferido" },
  ])("rechaza parámetros inválidos %j con ProblemDetails", async (extra) => {
    const r = await fetch(`${API}/seguimientos/excel?${params(extra)}`);
    expect(r.status).toBe(400);
    expect((await r.json()).detail).toBeTruthy();
  });
  it("limita a 5000 antes de hidratar catálogos o consultar ERP", async () => {
    const {
      cupos: [base],
    } = await recibir();
    const cupos: Cupo[] = Array.from({ length: 5001 }, (_, i) => ({
      ...base,
      id: crypto.randomUUID(),
      ordinal: i + 1,
    }));
    const conNombre = vi.fn((cupo: Cupo) => cupo);
    const erp = vi.spyOn(erpLogisticaDemo, "lote");
    const demo = crearSeguimientosDemo({ cupos: () => cupos, conNombre, registrar: vi.fn() });
    cupos.forEach((cupo) => demo.iniciar(cupo, "Recepción ficticia de límite"));
    demo.vincular(cupos[0].id, {
      id: crypto.randomUUID(),
      contrato: "V-DEMO/1",
      grupo: 701,
      cupo: 1,
      vigenteDesde: new Date().toISOString(),
      evidencia: "Referencia ficticia",
      registradoPorId: 7,
    });
    server.use(...demo.handlers);
    const r = await fetch(`${API}/seguimientos/excel?${params()}`);
    expect(r.status).toBe(400);
    expect((await r.json()).detail).toMatch(/acot/i);
    expect(conNombre.mock.calls.length).toBe(0);
    expect(erp).not.toHaveBeenCalled();
  });
  it.each([1, 50, 200])(
    "valida tamano=%s pero exporta el conjunto completo sin paginar",
    async (tamano) => {
      await recibir(52);
      const response = await fetch(
        `${API}/seguimientos/excel?${params({ tamano: String(tamano) })}`,
      );
      expect(response.status).toBe(200);
      expect(libro(new Uint8Array(await response.arrayBuffer())).seguimientos.filas).toHaveLength(
        52,
      );
    },
  );
  it.each([0, 1, 52])("reabre un libro con autofiltro completo para %s filas", async (cantidad) => {
    if (cantidad) await recibir(cantidad);
    const response = await fetch(`${API}/seguimientos/excel?${params()}`);
    expect(response.status).toBe(200);
    const { seguimientos } = libro(new Uint8Array(await response.arrayBuffer()));
    expect(seguimientos.xml.querySelector("parsererror")).toBeNull();
    expect(seguimientos.xml.querySelectorAll("autoFilter")).toHaveLength(1);
    expect(seguimientos.xml.querySelector("autoFilter")?.getAttribute("ref")).toBe(
      `A1:CV${cantidad + 1}`,
    );
    expect(seguimientos.xml.querySelector("autoFilter")?.previousElementSibling?.localName).toBe(
      "sheetData",
    );
  });
  it.each([1, 8, 9, 10])(
    "respeta permiso lectura existente del operador ficticio %s",
    async (id) => {
      const r = await fetch(`${API}/seguimientos/excel?${params()}`, {
        headers: { Authorization: `Bearer mock-access-${id}` },
      });
      expect(r.status).toBe(200);
    },
  );
  it("rechaza actor ajeno y token anónimo inválido sin devolver archivo", async () => {
    const ajeno = await fetch(`${API}/seguimientos/excel?${params()}`, {
      headers: { Authorization: "Bearer mock-access-3" },
    });
    expect(ajeno.status).toBe(403);
    const anonimo = await fetch(`${API}/seguimientos/excel?${params()}`, {
      headers: { Authorization: "Bearer invalido" },
    });
    expect(anonimo.status).toBe(401);
  });
  it.each(["no_encontrado", "no_disponible"] as const)(
    "preserva datos propios y diagnóstico %s con vínculo vigente",
    async (diagnostico) => {
      const recepcion = await recibir();
      const c = recepcion.cupos[0];
      await enviar("otorgamientos", {
        destinatarioTipo: "propio",
        cupos: [{ id: c.id, revision: 1 }],
      });
      await enviar(`seguimientos/${c.id}/datos-operativos`, {
        revision: 1,
        tipo: "patente",
        texto: "DEMO999",
        fuente: "cliente",
        observadoAl: `${hoy()}T12:00:00Z`,
        referencia: "Llamado ficticio",
      });
      await enviar(
        `cupos/${c.id}/vinculo-erp`,
        {
          revision: 3,
          clave: { contrato: "V-DEMO/1", grupo: 701, cupo: 1 },
          evidencia: "Referencia ficticia",
          confirmado: true,
        },
        "PUT",
      );
      const spy = vi.spyOn(erpLogisticaDemo, "lote");
      if (diagnostico === "no_disponible")
        spy.mockImplementation(() => {
          throw new Error("ERP ficticio fallido");
        });
      else spy.mockReturnValue([]);
      const r = await fetch(`${API}/seguimientos/excel?${params()}`);
      expect(r.status).toBe(200);
      const row = libro(new Uint8Array(await r.arrayBuffer())).seguimientos.filas[0];
      expect(row["Consulta ERP diagnóstico"]).toBe(diagnostico);
      expect(row["Patente operativa"]).toBe("DEMO999");
      expect(row["Patente operativa fuente"]).toBe("cliente");
      expect(row["Asignación"]).toBe("Propio");
      expect(row["Cliente nombre"]).toBe("Propio");
      expect(row["Cliente número"]).toBe("");
      expect(row["Vínculo ERP grupo"]).toBe("701");
      expect(row["ERP contrato"]).toBe("");
    },
  );
  it("sólo formatea pesos sin pérdida y rechaza precisión ficticia adicional no nula", async () => {
    const recepcion = await recibir();
    const c = recepcion.cupos[0];
    const seguimiento = (
      (await (await fetch(`${API}/seguimientos/${c.id}`)).json()) as Detalle<Seguimiento>
    ).dato;
    const erp = erpLogisticaDemo.filas()[1];
    const ahora = new Date().toISOString();
    const fila: ConciliacionFila = {
      seguimiento,
      erp: { ...erp, kgCargaErp: "321.456700000000" },
      estadoConsulta: "verificado",
      incidencias: [],
    };
    const bytes = await excelLogisticaDemo([fila], params(), ahora, ahora, ahora);
    expect(libro(bytes).seguimientos.filas[0]["Kg carga ERP"]).toBe("321.4567");
    fila.erp = { ...erp, kgCargaErp: "321.45671" };
    await expect(excelLogisticaDemo([fila], params(), ahora, ahora, ahora)).rejects.toThrow(
      "cuatro decimales sin pérdida",
    );
  });
});
