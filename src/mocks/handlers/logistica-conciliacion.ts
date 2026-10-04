import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";
import { hoy, sumarDias } from "@/features/logistica/format";
import { incidenciasErp } from "@/features/logistica/lib/conciliacion";
import { textoOperativoValido } from "@/features/logistica/lib/seguimiento";
import type {
  ClaveCupoErp,
  ConciliacionFila,
  CupoErp,
  Evento,
  Pagina,
  Seguimiento,
  ReemplazarVinculoErpBody,
  RetirarVinculoErpBody,
  RetiroVinculoErpResultado,
  VinculoErpBody,
  VinculoErpResultado,
} from "@/features/logistica/types";
import type { crearSeguimientosDemo } from "./logistica-seguimientos";
import { permisoLogisticaDemo } from "./auth";

const API = `${env.apiUrl}/logistica`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidValido = (v: string) => uuid.test(v) && v !== "00000000-0000-0000-0000-000000000000";
function error(status: number, detail: string) {
  return HttpResponse.json({ status, detail }, { status });
}
function permiso(request: Request, escritura = false) {
  const status = permisoLogisticaDemo(request, escritura, "logistica-cupos");
  return status
    ? error(
        status,
        status === 403 ? "No tenés permiso para esta operación." : "Ingresá para continuar.",
      )
    : null;
}
function fixtures(): CupoErp[] {
  const base: CupoErp = {
    contrato: "V-DEMO/1",
    grupo: 701,
    cupo: 1,
    codigoTerminal: "DEMO-01",
    fechaCarga: hoy(),
    fechaAltaErp: sumarDias(hoy(), -2),
    destinoNombre: "Terminal de ejemplo",
    destinoCodigo: 101,
    tieneCabecera: true,
    plantaTrabajo: 10,
    plantaDetalle: 15,
    productorPlan: 9000000001,
    cargadorPlan: 9000000002,
    codigoCp: 1,
    sucursalCp: 1,
    numeroCp: 70001,
    ordenCp: 1,
    tieneCartaPorte: true,
    tieneDescarga: true,
    ctg: "CTG-FICTICIO-01",
    patenteChasis: "DEMO123",
    patenteAcoplado: null,
    kgCargaErp: "30000.0000",
    kgDescargaErp: "28999.9999",
    fechaDescarga: hoy(),
  };
  return [
    { ...base, grupo: 0, cupo: 0, codigoTerminal: "OTRO-00" },
    base,
    { ...base, contrato: "V-OTRO/1" },
    {
      ...base,
      grupo: 702,
      tieneCartaPorte: false,
      tieneDescarga: false,
      codigoCp: null,
      sucursalCp: null,
      numeroCp: null,
      ordenCp: null,
      ctg: null,
      kgCargaErp: null,
      kgDescargaErp: null,
      patenteChasis: null,
    },
    {
      ...base,
      grupo: 703,
      codigoTerminal: "OTRO-03",
      tieneCabecera: false,
      destinoNombre: null,
      destinoCodigo: null,
      productorPlan: null,
      cargadorPlan: null,
      tieneCartaPorte: false,
      tieneDescarga: false,
    },
    {
      ...base,
      grupo: 704,
      codigoTerminal: null,
      tieneDescarga: false,
      kgCargaErp: "0",
      kgDescargaErp: null,
      patenteChasis: "   ",
    },
  ];
}
const claveIgual = (a: ClaveCupoErp, b: ClaveCupoErp) =>
  a.contrato === b.contrato && a.grupo === b.grupo && a.cupo === b.cupo;
// Fuente administrativa ficticia separada de la operación propia. Tests pueden simular fallos del lector.
export const erpLogisticaDemo = {
  filas: (): CupoErp[] => structuredClone(fixtures()),
  exacta: (clave: ClaveCupoErp): CupoErp | null =>
    structuredClone(
      fixtures().find(
        (f) =>
          f.contrato.toUpperCase() === clave.contrato.trimEnd().toUpperCase() &&
          f.grupo === clave.grupo &&
          f.cupo === clave.cupo,
      ) ?? null,
    ),
  lote: (claves: ClaveCupoErp[]): CupoErp[] =>
    structuredClone(fixtures().filter((f) => claves.some((c) => claveIgual(c, f)))),
};
// Misma consulta por vínculos y diagnósticos para la tabla y el Excel ficticios.
export function conciliarLogisticaDemo(filas: Seguimiento[]): ConciliacionFila[] {
  const claves = filas.flatMap((s) => (s.vinculoErpVigente ? [s.vinculoErpVigente] : []));
  let erps: CupoErp[] = [],
    disponible = true;
  try {
    if (claves.length) erps = erpLogisticaDemo.lote(claves);
  } catch {
    disponible = false;
  }
  return filas.map((seguimiento) => {
    const link = seguimiento.vinculoErpVigente;
    if (!link)
      return {
        seguimiento,
        estadoConsulta: "sin_vinculo",
        erp: null,
        incidencias: ["vinculo_pendiente"],
      };
    if (!disponible)
      return {
        seguimiento,
        estadoConsulta: "no_disponible",
        erp: null,
        incidencias: ["erp_no_disponible"],
      };
    const erp = erps.find((f) => claveIgual(f, link)) ?? null;
    return erp
      ? {
          seguimiento,
          estadoConsulta: "verificado",
          erp,
          incidencias: incidenciasErp(seguimiento, erp),
        }
      : {
          seguimiento,
          estadoConsulta: "no_encontrado",
          erp: null,
          incidencias: ["referencia_no_encontrada"],
        };
  });
}
function rangoValido(p: URLSearchParams, max = 31): boolean {
  const d = p.get("desde") ?? "",
    h = p.get("hastaExclusivo") ?? "";
  const dias = (Date.parse(h) - Date.parse(d)) / 86400000;
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    /^\d{4}-\d{2}-\d{2}$/.test(h) &&
    d >= "1753-01-01" &&
    Number.isFinite(dias) &&
    dias >= 1 &&
    dias <= max &&
    new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d &&
    new Date(`${h}T00:00:00Z`).toISOString().slice(0, 10) === h
  );
}
// DateTime ISO de la API (o fecha sola), conservando las siete posiciones de ticks.
function fechaHoraErp(valor: string | null): string | null {
  const partes =
    /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,7}))?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(
      valor ?? "",
    );
  if (!partes) return null;
  const [, dia, hora = "00", minuto = "00", segundo = "00", fraccion = "", zona = "Z"] = partes;
  const calendario = Date.parse(`${dia}T00:00:00Z`);
  if (
    !Number.isFinite(calendario) ||
    new Date(calendario).toISOString().slice(0, 10) !== dia ||
    Number(hora) > 23 ||
    Number(minuto) > 59 ||
    Number(segundo) > 59
  )
    return null;
  const tiempo = Date.parse(
    `${dia}T${hora}:${minuto}:${segundo}${fraccion ? `.${fraccion}` : ""}${zona}`,
  );
  if (!Number.isFinite(tiempo)) return null;
  const iso = new Date(tiempo).toISOString();
  return iso.length === 24 ? `${iso.slice(0, 19)}.${fraccion.padEnd(7, "0")}` : null;
}
function entero(p: URLSearchParams, nombre: string, min: number, max: number): boolean {
  return (
    !p.has(nombre) ||
    (p.get(nombre) !== "" &&
      /^\d+$/.test(p.get(nombre)!) &&
      Number(p.get(nombre)) >= min &&
      Number(p.get(nombre)) <= max)
  );
}
function candidatosValidos(p: URLSearchParams): boolean {
  return (
    rangoValido(p) &&
    entero(p, "tamano", 1, 200) &&
    entero(p, "grupo", 0, 99999999) &&
    entero(p, "despuesGrupo", 0, 99999999) &&
    entero(p, "despuesCupo", 0, 999) &&
    p.has("despuesGrupo") === p.has("despuesCupo") &&
    (!p.has("porCodigo") || ["true", "false"].includes(p.get("porCodigo")!))
  );
}
function filtrarErp(p: URLSearchParams, contrato?: string, codigo?: string | null) {
  return erpLogisticaDemo
    .filas()
    .filter(
      (f) =>
        (!contrato || f.contrato === contrato) &&
        (!codigo?.trim() || f.codigoTerminal === codigo) &&
        f.fechaCarga != null &&
        f.fechaCarga.slice(0, 10) >= p.get("desde")! &&
        f.fechaCarga.slice(0, 10) < p.get("hastaExclusivo")! &&
        (!p.has("grupo") || f.grupo === Number(p.get("grupo"))) &&
        (!p.has("despuesGrupo") ||
          f.grupo > Number(p.get("despuesGrupo")) ||
          (f.grupo === Number(p.get("despuesGrupo")) && f.cupo > Number(p.get("despuesCupo")))),
    )
    .sort((a, b) => a.grupo - b.grupo || a.cupo - b.cupo);
}
interface Contexto {
  productoVenta: (contrato: string) => number | null;
  seguimientos: Pick<
    ReturnType<typeof crearSeguimientosDemo>,
    "obtener" | "listar" | "todos" | "vincular" | "corregirVinculo"
  >;
  registrar: (
    recurso: string,
    id: string,
    revision: number,
    tipo: Evento["tipo"],
    datos: unknown,
    motivo?: string | null,
    actor?: number,
  ) => void;
}
export function crearConciliacionDemo(contexto: Contexto) {
  const comandos = new Map<string, { cuerpo: string; original: VinculoErpResultado }>();
  const ocupado = (clave: ClaveCupoErp, cupoId: string) =>
    contexto.seguimientos
      .todos()
      .some(
        (s) => s.cupoId !== cupoId && s.vinculoErpVigente && claveIgual(s.vinculoErpVigente, clave),
      );
  const correcciones = new Map<
    string,
    { cuerpo: string; original: VinculoErpResultado | RetiroVinculoErpResultado }
  >();
  async function corregir(request: Request, cupoId: string, modo: "reemplazar" | "retirar") {
    const denied = permiso(request, true);
    if (denied) return denied;
    const id = cupoId.toLowerCase(),
      key = (request.headers.get("Idempotency-Key") ?? "").toLowerCase();
    let body: RetirarVinculoErpBody | ReemplazarVinculoErpBody;
    try {
      body = (await request.json()) as RetirarVinculoErpBody | ReemplazarVinculoErpBody;
    } catch {
      return error(400, "La corrección no tiene un formato válido.");
    }
    const c = (body as ReemplazarVinculoErpBody)?.claveNueva;
    if (
      !uuidValido(id) ||
      !uuidValido(key) ||
      !Number.isInteger(body?.revision) ||
      body.revision < 1 ||
      typeof body.vinculoActualId !== "string" ||
      !uuidValido(body.vinculoActualId) ||
      typeof body.evidencia !== "string" ||
      !textoOperativoValido(body.evidencia, 500) ||
      typeof body.motivo !== "string" ||
      !textoOperativoValido(body.motivo, 500) ||
      body.confirmado !== true ||
      (modo === "reemplazar" &&
        (!c ||
          typeof c.contrato !== "string" ||
          !textoOperativoValido(c.contrato, 15) ||
          !Number.isInteger(c.grupo) ||
          c.grupo < 0 ||
          c.grupo > 99999999 ||
          !Number.isInteger(c.cupo) ||
          c.cupo < 0 ||
          c.cupo > 999))
    )
      return error(400, "Revisá evidencia, motivo, confirmación y referencia completa.");
    const identity = `${request.headers.get("Authorization") ?? "test"}:cupo.vinculo_erp_${modo}:${key}`;
    const hash = JSON.stringify({
      cupoId: id,
      request: {
        revision: body.revision,
        vinculoActualId: body.vinculoActualId.toLowerCase(),
        ...(modo === "reemplazar"
          ? { claveNueva: { contrato: c.contrato, grupo: c.grupo, cupo: c.cupo } }
          : {}),
        evidencia: body.evidencia,
        motivo: body.motivo,
        confirmado: body.confirmado,
      },
    });
    const previo = correcciones.get(identity);
    if (previo)
      return previo.cuerpo === hash
        ? HttpResponse.json(structuredClone(previo.original))
        : error(409, "La clave corresponde a otra corrección.");
    // Reemplazo verifica la clave exacta antes de la transacción lógica; retiro no lee ERP.
    let erp: CupoErp | null = null;
    let verificadoAl: string | null = null;
    if (modo === "reemplazar") {
      try {
        erp = erpLogisticaDemo.exacta(c);
      } catch {
        return error(503, "MacroGest no está disponible.");
      }
      if (!erp) return error(404, "La referencia ERP no existe.");
      verificadoAl = new Date().toISOString();
    }
    const s = contexto.seguimientos.obtener(id);
    if (!s) return error(404, "El cupo no existe.");
    const vigente = s.vinculoErpVigente;
    if (
      s.cupo.revision !== body.revision ||
      s.anuladoAl ||
      !s.cupo.otorgamientoVigente ||
      !vigente ||
      vigente.id !== body.vinculoActualId.toLowerCase()
    )
      return error(409, "El cupo o su referencia cambió. Actualizá los datos.");
    if (erp) {
      if (erp.contrato !== s.cupo.contratoVenta)
        return error(409, "La referencia ERP pertenece a otro contrato.");
      if (
        !erp.tieneCabecera ||
        !textoOperativoValido(erp.contrato, 15) ||
        !Number.isInteger(erp.grupo) ||
        erp.grupo < 0 ||
        erp.grupo > 99999999 ||
        !Number.isInteger(erp.cupo) ||
        erp.cupo < 0 ||
        erp.cupo > 999
      )
        return error(400, "La referencia ERP requiere una clave válida y cabecera de plan.");
      if (claveIgual(vigente, erp)) return error(409, "La referencia ERP ya es la vigente.");
      if (ocupado(erp, id)) return error(409, "La referencia ERP ya está vinculada a otro cupo.");
    }
    const instante = new Date().toISOString();
    const actor = Number(
      /mock-access-(\d+)/.exec(request.headers.get("Authorization") ?? "")?.[1] ?? 1,
    );
    const claveDe = (v: ClaveCupoErp) => ({ contrato: v.contrato, grupo: v.grupo, cupo: v.cupo });
    const nuevo = erp
      ? {
          id: crypto.randomUUID(),
          ...claveDe(erp),
          vigenteDesde: instante,
          evidencia: body.evidencia,
          registradoPorId: actor,
        }
      : null;
    // Todas las validaciones terminan antes de mutar el store canónico y registrar ambos eventos.
    const seguimiento = contexto.seguimientos.corregirVinculo(id, nuevo, instante, actor);
    const datos = {
      cupoId: id,
      seguimientoRevision: seguimiento.revision,
      anterior: { id: vigente.id, clave: claveDe(vigente) },
      nuevo: nuevo ? { id: nuevo.id, clave: claveDe(nuevo) } : null,
      evidencia: body.evidencia,
      motivo: body.motivo,
      registradoPorId: actor,
      ...(erp ? { verificadoAl: verificadoAl! } : { retiradoAl: instante }),
    };
    const tipo = erp ? "vinculo_erp_reemplazado" : "vinculo_erp_retirado";
    contexto.registrar("cupos", id, seguimiento.cupo.revision, tipo, datos, body.motivo, actor);
    contexto.registrar("seguimientos", id, seguimiento.revision, tipo, datos, body.motivo, actor);
    const original = structuredClone(
      erp ? { seguimiento, verificadoAl: verificadoAl! } : { seguimiento, retiradoAl: instante },
    );
    correcciones.set(identity, { cuerpo: hash, original });
    return HttpResponse.json(structuredClone(original));
  }
  const handlers = [
    http.post(`${API}/cupos/:id/vinculo-erp/reemplazar`, ({ request, params }) =>
      corregir(request, String(params.id), "reemplazar"),
    ),
    http.post(`${API}/cupos/:id/vinculo-erp/retirar`, ({ request, params }) =>
      corregir(request, String(params.id), "retirar"),
    ),
    http.get(`${API}/cupos/:id/candidatos-erp`, ({ request, params }) => {
      const denied = permiso(request);
      if (denied) return denied;
      const p = new URL(request.url).searchParams;
      if (!candidatosValidos(p))
        return error(400, "Elegí hasta 31 días, tamaño y cursor completos válidos.");
      const s = contexto.seguimientos.obtener(String(params.id).toLowerCase());
      if (!s) return error(404, "El cupo no existe.");
      try {
        const filas = filtrarErp(
          p,
          s.cupo.contratoVenta,
          p.get("porCodigo") === "false" ? null : s.cupo.codigoTerminal,
        );
        const n = Number(p.get("tamano") ?? 50);
        return HttpResponse.json({
          filas: filas.slice(0, n).map((erp) => ({ erp, ocupado: ocupado(erp, s.cupoId) })),
          hayMas: filas.length > n,
          datosAl: new Date().toISOString(),
        });
      } catch {
        return error(503, "MacroGest no está disponible.");
      }
    }),
    http.put(`${API}/cupos/:id/vinculo-erp`, async ({ request, params }) => {
      const denied = permiso(request, true);
      if (denied) return denied;
      const id = String(params.id).toLowerCase(),
        key = (request.headers.get("Idempotency-Key") ?? "").toLowerCase();
      let body: VinculoErpBody;
      try {
        body = (await request.json()) as VinculoErpBody;
      } catch {
        return error(400, "Vinculación inválida.");
      }
      const c = body?.clave;
      if (
        !uuidValido(id) ||
        !uuidValido(key) ||
        !Number.isInteger(body?.revision) ||
        body.revision < 1 ||
        !c ||
        typeof c.contrato !== "string" ||
        !textoOperativoValido(c.contrato, 15) ||
        !Number.isInteger(c.grupo) ||
        c.grupo < 0 ||
        c.grupo > 99999999 ||
        !Number.isInteger(c.cupo) ||
        c.cupo < 0 ||
        c.cupo > 999 ||
        typeof body.evidencia !== "string" ||
        !textoOperativoValido(body.evidencia, 500) ||
        body.confirmado !== true ||
        body.motivoCambio != null
      )
        return error(
          400,
          "Revisá evidencia, confirmación y referencia completa. No se admite reemplazar un vínculo.",
        );
      const identity = `${request.headers.get("Authorization") ?? "test"}:cupo.vinculo_erp:${key}`;
      const hash = JSON.stringify({
        cupoId: id,
        request: {
          revision: body.revision,
          clave: { contrato: c.contrato, grupo: c.grupo, cupo: c.cupo },
          evidencia: body.evidencia,
          confirmado: body.confirmado,
          motivoCambio: body.motivoCambio ?? null,
        },
      });
      const previo = comandos.get(identity);
      if (previo)
        return previo.cuerpo === hash
          ? HttpResponse.json(structuredClone(previo.original))
          : error(409, "La clave corresponde a otra vinculación.");
      let erp: CupoErp | null;
      try {
        erp = erpLogisticaDemo.exacta(c);
      } catch {
        return error(503, "MacroGest no está disponible.");
      }
      if (!erp) return error(404, "La referencia ERP no existe.");
      const verificadoAl = new Date().toISOString();
      const s = contexto.seguimientos.obtener(id);
      if (!s) return error(404, "El cupo no existe.");
      if (
        s.cupo.revision !== body.revision ||
        s.anuladoAl ||
        !s.cupo.otorgamientoVigente ||
        s.vinculoErpVigente ||
        s.cupo.tieneVinculoErpVigente ||
        erp.contrato !== s.cupo.contratoVenta ||
        ocupado(erp, id)
      )
        return error(
          409,
          "El cupo cambió, no está asignado o la referencia ya está vinculada. Actualizá los datos.",
        );
      if (!erp.tieneCabecera) return error(400, "La referencia ERP requiere cabecera de plan.");
      const clave = { contrato: erp.contrato, grupo: erp.grupo, cupo: erp.cupo };
      const actor = Number(
        /mock-access-(\d+)/.exec(request.headers.get("Authorization") ?? "")?.[1] ?? 1,
      );
      const seguimiento = contexto.seguimientos.vincular(id, {
        id: crypto.randomUUID(),
        ...clave,
        vigenteDesde: new Date().toISOString(),
        evidencia: body.evidencia,
        registradoPorId: actor,
      });
      const datos = {
        cupoId: id,
        seguimientoRevision: seguimiento.revision,
        clave,
        evidencia: body.evidencia,
        registradoPorId: actor,
        verificadoAl,
      };
      contexto.registrar(
        "cupos",
        id,
        seguimiento.cupo.revision,
        "vinculo_erp_registrado",
        datos,
        null,
        actor,
      );
      contexto.registrar(
        "seguimientos",
        id,
        seguimiento.revision,
        "vinculo_erp_registrado",
        datos,
        null,
        actor,
      );
      const original = structuredClone({ seguimiento, verificadoAl });
      comandos.set(identity, { cuerpo: hash, original });
      return HttpResponse.json(structuredClone(original));
    }),
    http.get(`${API}/conciliacion`, async ({ request }) => {
      const denied = permiso(request);
      if (denied) return denied;
      const propia = contexto.seguimientos.listar(request);
      if (!propia.ok) return propia;
      const pagina = (await propia.json()) as Pagina<Seguimiento>;
      return HttpResponse.json({
        ...pagina,
        datosAl: new Date().toISOString(),
        filas: conciliarLogisticaDemo(pagina.filas),
      });
    }),
    http.get(`${API}/cupos/macrogest/detalle`, ({ request }) => {
      const denied = permiso(request);
      if (denied) return denied;
      const p = new URL(request.url).searchParams;
      const c = {
        contrato: p.get("contrato") ?? "",
        grupo: Number(p.get("grupo")),
        cupo: Number(p.get("cupo")),
      };
      if (
        !textoOperativoValido(c.contrato, 15) ||
        !p.has("grupo") ||
        !p.has("cupo") ||
        !entero(p, "grupo", 0, 99999999) ||
        !entero(p, "cupo", 0, 999)
      )
        return error(400, "Indicá la referencia completa.");
      try {
        const erp = erpLogisticaDemo.exacta(c);
        return erp
          ? HttpResponse.json({ dato: erp, datosAl: new Date().toISOString() })
          : error(404, "El vínculo exacto no se encontró en MacroGest.");
      } catch {
        return error(503, "MacroGest no está disponible.");
      }
    }),
    http.get(`${API}/cupos/macrogest`, ({ request }) => {
      const denied = permiso(request);
      if (denied) return denied;
      const p = new URL(request.url).searchParams;
      const cursorCampos = ["despuesFecha", "despuesContrato", "despuesGrupo", "despuesCupo"];
      const conCursor = cursorCampos.some((k) => p.has(k));
      const inicio = fechaHoraErp(p.get("desde")),
        fin = fechaHoraErp(p.get("hastaExclusivo"));
      const despues = fechaHoraErp(p.get("despuesFecha"));
      if (
        !rangoValido(p) ||
        !entero(p, "tamano", 1, 200) ||
        !entero(p, "producto", 1, 999999) ||
        !entero(p, "destinoCodigo", 1, 99999999) ||
        (p.has("contrato") && !textoOperativoValido(p.get("contrato")!, 15)) ||
        (conCursor &&
          (!cursorCampos.every((k) => p.has(k)) ||
            !entero(p, "despuesGrupo", 0, 99999999) ||
            !entero(p, "despuesCupo", 0, 999) ||
            !textoOperativoValido(p.get("despuesContrato")!, 15) ||
            despues === null ||
            despues < inicio! ||
            despues >= fin!))
      )
        return error(400, "Elegí hasta 31 días, filtros y cursor completos válidos.");
      try {
        // Esta consulta existente ordena por fecha/clave, a diferencia del buscador C7 grupo/cupo.
        const comparar = (
          a: CupoErp,
          b: { fechaCarga: string; contrato: string; grupo: number; cupo: number },
        ) =>
          fechaHoraErp(a.fechaCarga)!.localeCompare(fechaHoraErp(b.fechaCarga)!) ||
          a.contrato.localeCompare(b.contrato) ||
          a.grupo - b.grupo ||
          a.cupo - b.cupo;
        const cursor = p.has("despuesFecha")
          ? {
              fechaCarga: p.get("despuesFecha")!,
              contrato: p.get("despuesContrato") ?? "",
              grupo: Number(p.get("despuesGrupo")),
              cupo: Number(p.get("despuesCupo")),
            }
          : null;
        const filas = erpLogisticaDemo
          .filas()
          .filter(
            (f) =>
              f.fechaCarga != null &&
              fechaHoraErp(f.fechaCarga)! >= inicio! &&
              fechaHoraErp(f.fechaCarga)! < fin! &&
              (!p.has("contrato") || f.contrato === p.get("contrato")) &&
              (!p.has("producto") ||
                contexto.productoVenta(f.contrato) === Number(p.get("producto"))) &&
              (!p.has("destinoCodigo") || f.destinoCodigo === Number(p.get("destinoCodigo"))) &&
              (!p.has("codigoTerminal") || f.codigoTerminal === p.get("codigoTerminal")) &&
              (!cursor || comparar(f, cursor) > 0),
          )
          .sort((a, b) => comparar(a, { ...b, fechaCarga: b.fechaCarga! }));
        const n = Number(p.get("tamano") ?? 50);
        return HttpResponse.json({
          filas: filas.slice(0, n),
          hayMas: filas.length > n,
          datosAl: new Date().toISOString(),
        });
      } catch {
        return error(503, "MacroGest no está disponible.");
      }
    }),
  ];
  return {
    handlers,
    reset: () => {
      comandos.clear();
      correcciones.clear();
    },
  };
}
