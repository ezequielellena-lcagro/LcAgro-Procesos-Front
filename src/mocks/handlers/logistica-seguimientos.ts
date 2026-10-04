import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";
import {
  patenteOperativaValida,
  decimalCanonico,
  pesoOperativoValido,
  textoOperativoValido,
} from "@/features/logistica/lib/seguimiento";
import { ESTADOS_SEGUIMIENTO, FUENTES_OPERATIVAS } from "@/features/logistica/types";
import type {
  AnularSeguimientoBody,
  Cupo,
  DatoOperativo,
  DatoOperativoBody,
  EstadoSeguimientoBody,
  Seguimiento,
  VinculoErpSeguimiento,
} from "@/features/logistica/types";
import { permisoLogisticaDemo, usuarioLogisticaDemo } from "./auth";
import { textoFlotaValido, trimFlota } from "@/features/logistica/lib/flota";
import { flotaDisponibleDemo, versionFlotaDisponibleDemo } from "./logistica-flota";
import type {
  SeleccionarFlotaSeguimientoBody,
  RetirarFlotaSeguimientoBody,
} from "@/features/logistica/types";
import { conciliarLogisticaDemo } from "./logistica-conciliacion";
import { excelLogisticaDemo } from "./logistica-excel";

const API = `${env.apiUrl}/logistica`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidValido = (valor: unknown): valor is string =>
  typeof valor === "string" && uuid.test(valor) && valor !== "00000000-0000-0000-0000-000000000000";
const INT64_MAXIMO = 9223372036854775807n;
function revisionInt64Valida(valor: unknown): valor is number {
  // Alcance: números de JSON.stringify del frontend. Number(Int64.MaxValue) redondea a 2^63;
  // comparar BigInt evita admitir ese valor fuera del DTO long sin limitar a SafeInteger.
  return (
    typeof valor === "number" &&
    Number.isFinite(valor) &&
    Number.isInteger(valor) &&
    valor >= 1 &&
    BigInt(valor) <= INT64_MAXIMO
  );
}
type Body = EstadoSeguimientoBody | DatoOperativoBody | AnularSeguimientoBody;
interface Contexto {
  cupos: () => Cupo[];
  conNombre: (cupo: Cupo) => Cupo;
  registrar: (
    recurso: string,
    id: string,
    revision: number,
    tipo: string,
    datos: unknown,
    motivo?: string | null,
    actor?: number,
  ) => void;
}
function error(status: number, detail: string) {
  return HttpResponse.json({ status, detail }, { status });
}
function permiso(request: Request, escritura = false) {
  const status = permisoLogisticaDemo(request, escritura);
  return status
    ? error(
        status,
        status === 403 ? "No tenés permiso para esta operación." : "Ingresá para continuar.",
      )
    : null;
}
function fuenteValida(body: EstadoSeguimientoBody | DatoOperativoBody) {
  return (
    (FUENTES_OPERATIVAS as readonly string[]).includes(body.fuente) &&
    typeof body.observadoAl === "string" &&
    /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(body.observadoAl) &&
    Number.isFinite(Date.parse(body.observadoAl)) &&
    typeof body.referencia === "string" &&
    textoOperativoValido(body.referencia, 200)
  );
}
function motivoValido(motivo: unknown) {
  return typeof motivo === "string" && textoOperativoValido(motivo, 500);
}
function observacion(s: Seguimiento) {
  return {
    estadoObservado: s.estadoObservado,
    estadoObservadoAl: s.estadoObservadoAl,
    estadoFuente: s.estadoFuente,
    estadoReferencia: s.estadoReferencia,
  };
}
export function crearSeguimientosDemo(contexto: Contexto) {
  const seguimientos = new Map<string, Seguimiento>();
  const vinculos = new Map<
    string,
    (VinculoErpSeguimiento & { vigenteHasta: string | null; retiradoPorId: number | null })[]
  >();
  const comandos = new Map<string, { cuerpo: string; original: Seguimiento }>();
  function iniciar(cupo: Cupo, referenciaRecepcion: string) {
    seguimientos.set(cupo.id, {
      cupoId: cupo.id,
      revision: 1,
      cupo,
      referenciaRecepcion,
      estadoObservado: "por_iniciar",
      estadoObservadoAl: null,
      estadoFuente: null,
      estadoReferencia: null,
      observacion: null,
      anuladoAl: null,
      anuladoPorId: null,
      motivoAnulacion: null,
      datosVigentes: [],
      vinculoErpVigente: null,
      flotaVigente: null,
    });
  }
  function snapshot(id: string, hidratar = false): Seguimiento | null {
    const s = seguimientos.get(id);
    const cupo = contexto.cupos().find((c) => c.id === id);
    if (!s || !cupo) return null;
    const propio = {
      ...cupo,
      productoNombre: null,
      destinoNombre: null,
      estadoObservado: s.estadoObservado,
      seguimientoAnulado: !!s.anuladoAl,
      disponibleParaOtorgar:
        !s.anuladoAl &&
        s.estadoObservado === "por_iniciar" &&
        !cupo.otorgamientoVigente &&
        !s.vinculoErpVigente,
      otorgamientoVigente: cupo.otorgamientoVigente
        ? { ...cupo.otorgamientoVigente, clienteNombre: null }
        : null,
    };
    return structuredClone({ ...s, cupo: hidratar ? contexto.conNombre(propio) : propio });
  }
  function validar(body: Body, operacion: string) {
    if (!Number.isInteger(body.revision) || body.revision < 1) return false;
    if (operacion === "anular") return motivoValido((body as AnularSeguimientoBody).motivo);
    const dato = body as DatoOperativoBody;
    if (
      !fuenteValida(dato) ||
      (dato.motivoCorreccion != null && !motivoValido(dato.motivoCorreccion))
    )
      return false;
    if (operacion === "estado")
      return (ESTADOS_SEGUIMIENTO as readonly string[]).includes(
        (body as EstadoSeguimientoBody).estadoObservado,
      );
    return (
      ["patente", "kg_carga", "kg_descarga"].includes(dato.tipo) &&
      (dato.reemplazaId == null || uuidValido(dato.reemplazaId)) &&
      (dato.tipo === "patente"
        ? dato.kilogramos == null &&
          typeof dato.texto === "string" &&
          patenteOperativaValida(dato.texto)
        : dato.texto == null &&
          typeof dato.kilogramos === "string" &&
          pesoOperativoValido(dato.kilogramos))
    );
  }
  async function ejecutar(request: Request, cupoId: string, operacion: string) {
    const denied = permiso(request, true);
    if (denied) return denied;
    cupoId = cupoId.toLowerCase();
    const key = (request.headers.get("Idempotency-Key") ?? "").toLowerCase();
    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return error(400, "La observación no tiene un formato válido.");
    }
    if (!body || typeof body !== "object")
      return error(400, "La observación no tiene un formato válido.");
    if (operacion === "dato") {
      const peso = (body as { kilogramos?: unknown }).kilogramos;
      // Compatibilidad con fixtures previos pequeños; valores extremos se envían como texto.
      if (typeof peso === "number" && Number.isFinite(peso) && Math.abs(peso) < 1e9)
        body = { ...body, kilogramos: String(peso) } as Body;
      if (typeof (body as DatoOperativoBody).kilogramos === "string") {
        const valor = (body as DatoOperativoBody).kilogramos!;
        const canonico = decimalCanonico(valor);
        if (canonico !== null) body = { ...body, kilogramos: canonico } as Body;
      }
    }
    if (!uuidValido(key) || !uuidValido(cupoId) || !validar(body, operacion))
      return error(
        400,
        "Revisá los valores, la fuente, la fecha y las referencias de la observación.",
      );
    // Identidad por operador + operación lógica + UUID; cupoId participa del cuerpo hash, no del ámbito de la clave.
    const clave = `${request.headers.get("Authorization") ?? "test"}:seguimiento.${operacion}:${key}`;
    const b = body as DatoOperativoBody & EstadoSeguimientoBody & AnularSeguimientoBody;
    const solicitud =
      operacion === "anular"
        ? { revision: b.revision, motivo: b.motivo }
        : operacion === "estado"
          ? {
              revision: b.revision,
              estadoObservado: b.estadoObservado,
              observadoAl: b.observadoAl,
              fuente: b.fuente,
              referencia: b.referencia,
              motivoCorreccion: b.motivoCorreccion ?? null,
            }
          : {
              revision: b.revision,
              tipo: b.tipo,
              kilogramos: b.kilogramos ?? null,
              texto: b.texto ?? null,
              fuente: b.fuente,
              observadoAl: b.observadoAl,
              referencia: b.referencia,
              reemplazaId: b.reemplazaId ?? null,
              motivoCorreccion: b.motivoCorreccion ?? null,
            };
    const cuerpo = JSON.stringify({ cupoId: cupoId.toLowerCase(), request: solicitud });
    const previo = comandos.get(clave);
    if (previo)
      return previo.cuerpo === cuerpo
        ? HttpResponse.json(structuredClone(previo.original))
        : error(409, "La clave corresponde a otra observación.");
    const s = seguimientos.get(cupoId);
    const cupo = contexto.cupos().find((c) => c.id === cupoId);
    if (!s || !cupo) return error(404, "El seguimiento no existe.");
    if (s.revision !== body.revision || s.anuladoAl)
      return error(409, "El seguimiento cambió o está anulado. Actualizá los datos.");
    const ahora = new Date().toISOString();
    const actor = Number(
      /mock-access-(\d+)/.exec(request.headers.get("Authorization") ?? "")?.[1] ?? 1,
    );
    let anterior: unknown, nuevo: unknown, tipo: string, motivo: string | null;
    if (operacion === "estado") {
      const b = body as EstadoSeguimientoBody;
      if (s.estadoObservadoAl && b.motivoCorreccion == null)
        return error(400, "Indicá el motivo de corrección.");
      anterior = observacion(s);
      s.estadoObservado = b.estadoObservado;
      s.estadoObservadoAl = new Date(b.observadoAl).toISOString();
      s.estadoFuente = b.fuente;
      s.estadoReferencia = b.referencia;
      nuevo = observacion(s);
      tipo = "estado_observado";
      motivo = b.motivoCorreccion ?? null;
    } else if (operacion === "dato") {
      const b = body as DatoOperativoBody;
      const head = s.datosVigentes.find((d) => d.tipo === b.tipo);
      if ((!head && b.reemplazaId != null) || (head && b.reemplazaId !== head.id))
        return error(409, "La corrección no reemplaza el dato vigente de este cupo y tipo.");
      if ((!head && b.motivoCorreccion != null) || (head && b.motivoCorreccion == null))
        return error(400, "El primer dato no lleva motivo; una corrección requiere motivo.");
      const dato: DatoOperativo = {
        id: crypto.randomUUID(),
        cupoId,
        tipo: b.tipo,
        kilogramos: b.kilogramos ?? null,
        texto: b.texto?.trim() ?? null,
        fuente: b.fuente,
        observadoAl: new Date(b.observadoAl).toISOString(),
        referencia: b.referencia,
        registradoAl: ahora,
        registradoPorId: actor,
        reemplazaId: b.reemplazaId ?? null,
        motivoCorreccion: b.motivoCorreccion ?? null,
      };
      anterior = head ?? null;
      nuevo = dato;
      tipo = "dato_operativo_registrado";
      motivo = dato.motivoCorreccion;
      s.datosVigentes = [...s.datosVigentes.filter((d) => d.tipo !== b.tipo), dato].sort((a, b) =>
        a.tipo.localeCompare(b.tipo),
      );
    } else {
      const b = body as AnularSeguimientoBody;
      anterior = { anuladoAl: null };
      s.anuladoAl = ahora;
      s.anuladoPorId = actor;
      s.motivoAnulacion = b.motivo;
      nuevo = { anuladoAl: ahora, anuladoPorId: actor, motivoAnulacion: b.motivo };
      tipo = "seguimiento_anulado";
      motivo = b.motivo;
    }
    s.revision++;
    cupo.revision++;
    cupo.estadoObservado = s.estadoObservado;
    cupo.seguimientoAnulado = !!s.anuladoAl;
    cupo.disponibleParaOtorgar =
      !s.anuladoAl &&
      s.estadoObservado === "por_iniciar" &&
      !cupo.otorgamientoVigente &&
      !s.vinculoErpVigente;
    contexto.registrar(
      "seguimientos",
      cupoId,
      s.revision,
      tipo,
      structuredClone({ anterior, nuevo }),
      motivo,
      actor,
    );
    contexto.registrar(
      "cupos",
      cupoId,
      cupo.revision,
      "seguimiento_modificado",
      { seguimientoRevision: s.revision },
      null,
      actor,
    );
    const original = snapshot(cupoId)!;
    comandos.set(clave, { cuerpo, original });
    return HttpResponse.json(structuredClone(original), {
      status: operacion === "dato" ? 201 : 200,
    });
  }
  async function ejecutarFlota(request: Request, cupoId: string, retirar: boolean) {
    const denied = permiso(request, true);
    if (denied) return denied;
    const actor = usuarioLogisticaDemo(request);
    if (!actor) return error(401, "Sesión inválida.");
    let recibido: unknown;
    try {
      recibido = await request.json();
    } catch {
      return error(400, "Cuerpo inválido.");
    }
    if (!recibido || typeof recibido !== "object" || Array.isArray(recibido))
      return error(400, "Cuerpo inválido.");
    const body = recibido as SeleccionarFlotaSeguimientoBody & RetirarFlotaSeguimientoBody;
    const key = request.headers.get("Idempotency-Key") ?? "";
    if (
      !uuidValido(cupoId) ||
      !uuidValido(key) ||
      !revisionInt64Valida(body.revision) ||
      (retirar
        ? !textoFlotaValido(body.motivo, 500)
        : !uuidValido(body.fichaId ?? "") ||
          !uuidValido(body.versionId ?? "") ||
          (body.motivo != null && !textoFlotaValido(body.motivo, 500)))
    )
      return error(400, "Revisá la revisión, la ficha, la versión y el motivo.");
    cupoId = cupoId.toLowerCase();
    const solicitud = retirar
      ? { revision: body.revision, motivo: body.motivo }
      : {
          revision: body.revision,
          fichaId: body.fichaId.toLowerCase(),
          versionId: body.versionId.toLowerCase(),
          motivo: body.motivo ?? null,
        };
    const operacion = retirar ? "seguimiento.flota.retirar" : "seguimiento.flota.seleccionar";
    const clave = actor.id + ":" + operacion + ":" + key.toLowerCase();
    const cuerpo = JSON.stringify({ cupoId, request: solicitud });
    const previo = comandos.get(clave);
    if (previo)
      return previo.cuerpo === cuerpo
        ? HttpResponse.json(structuredClone(previo.original))
        : error(409, "La clave corresponde a otra operación.");
    const s = seguimientos.get(cupoId),
      cupo = contexto.cupos().find((c) => c.id === cupoId);
    if (!s || !cupo) return error(404, "El seguimiento no existe.");
    if (s.revision !== body.revision || s.anuladoAl)
      return error(409, "El seguimiento cambió o está anulado. Actualizá los datos.");
    const anterior = s.flotaVigente ?? null;
    let nuevo = null;
    if (retirar) {
      if (anterior === null) return error(409, "El seguimiento no tiene un camión elegido.");
    } else {
      const version = versionFlotaDisponibleDemo(body.fichaId, body.versionId);
      if (version.status !== 200)
        return error(
          version.status,
          version.status === 404
            ? "La ficha o versión no existe."
            : "La ficha cambió o está inactiva. Actualizá los datos.",
        );
      if (anterior?.versionId === version.dato.versionId)
        return error(409, "Ese camión y versión ya están elegidos.");
      if (anterior && body.motivo == null) return error(400, "Indicá el motivo del reemplazo.");
      if (!anterior && body.motivo != null)
        return error(400, "La primera selección no lleva motivo.");
      nuevo = version.dato;
    }
    const motivo = body.motivo == null ? null : trimFlota(body.motivo);
    const tipo = retirar ? "flota_retirada" : anterior ? "flota_reemplazada" : "flota_seleccionada";
    // Todos los rechazos preceden a este commit síncrono; el viaje conserva sus demás campos.
    s.flotaVigente = structuredClone(nuevo);
    s.revision++;
    cupo.revision++;
    contexto.registrar(
      "seguimientos",
      cupoId,
      s.revision,
      tipo,
      structuredClone({ anterior, nuevo, motivo }),
      motivo,
      actor.id,
    );
    contexto.registrar(
      "cupos",
      cupoId,
      cupo.revision,
      "seguimiento_modificado",
      { cupoId, seguimientoRevision: s.revision },
      null,
      actor.id,
    );
    const original = snapshot(cupoId)!;
    comandos.set(clave, { cuerpo, original });
    return HttpResponse.json(structuredClone(original));
  }
  function listar(request: Request, completo = false) {
    const denied = permiso(request);
    if (denied) return denied;
    const p = new URL(request.url).searchParams;
    const desde = p.get("desde") ?? "",
      hasta = p.get("hastaExclusivo") ?? "";
    const dias = (Date.parse(hasta) - Date.parse(desde)) / 86400000;
    const n = Number(p.get("tamano") ?? 50);
    const df = p.get("despuesFecha"),
      di = p.get("despuesId");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(desde) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(hasta) ||
      desde < "1753-01-01" ||
      !Number.isFinite(dias) ||
      new Date(`${desde}T00:00:00Z`).toISOString().slice(0, 10) !== desde ||
      new Date(`${hasta}T00:00:00Z`).toISOString().slice(0, 10) !== hasta ||
      (completo && [...p.keys()].some((k) => k.startsWith("despues"))) ||
      dias < 1 ||
      dias > 366 ||
      !Number.isInteger(n) ||
      n < 1 ||
      n > 200 ||
      !!df !== !!di ||
      (di && !uuid.test(di)) ||
      (p.has("anulados") && !["true", "false"].includes(p.get("anulados")!)) ||
      (p.has("estadoObservado") &&
        !(ESTADOS_SEGUIMIENTO as readonly string[]).includes(p.get("estadoObservado")!)) ||
      (p.has("circuito") && !["directa", "propia"].includes(p.get("circuito")!)) ||
      [
        ["clienteNumero", 9999999999],
        ["producto", 999999],
        ["destinoCodigo", 99999999],
      ].some(
        ([k, max]) =>
          p.has(String(k)) &&
          (!Number.isInteger(Number(p.get(String(k)))) ||
            Number(p.get(String(k))) < 1 ||
            Number(p.get(String(k))) > Number(max)),
      ) ||
      (p.has("campania") &&
        (!/^\d{4}-\d{4}$/.test(p.get("campania")!) ||
          Number(p.get("campania")!.slice(0, 4)) < 1900 ||
          Number(p.get("campania")!.slice(0, 4)) >= 9999 ||
          Number(p.get("campania")!.slice(5)) !== Number(p.get("campania")!.slice(0, 4)) + 1)) ||
      (p.has("contrato") && !textoOperativoValido(p.get("contrato")!, 15))
    )
      return error(400, "Elegí un período de hasta 366 días y filtros válidos.");
    // Filtrar la operación cruda antes de leer nombres: el límite se comprueba con 5000+1.
    const cuposPorId = new Map(contexto.cupos().map((c) => [c.id, c]));
    const coincidentes: { seguimiento: Seguimiento; cupo: Cupo }[] = [];
    for (const seguimiento of seguimientos.values()) {
      const cupo = cuposPorId.get(seguimiento.cupoId);
      if (
        !cupo ||
        cupo.fechaCarga < desde ||
        cupo.fechaCarga >= hasta ||
        !!seguimiento.anuladoAl !== (p.get("anulados") === "true") ||
        (p.has("contrato") && cupo.contratoVenta !== p.get("contrato")) ||
        (p.has("clienteNumero") &&
          cupo.otorgamientoVigente?.clienteNumero !== Number(p.get("clienteNumero"))) ||
        (p.has("producto") && cupo.producto !== Number(p.get("producto"))) ||
        (p.has("campania") && cupo.campania !== p.get("campania")) ||
        (p.has("destinoCodigo") && cupo.destinoCodigo !== Number(p.get("destinoCodigo"))) ||
        (p.has("circuito") && cupo.circuito !== p.get("circuito")) ||
        (p.has("estadoObservado") && seguimiento.estadoObservado !== p.get("estadoObservado")) ||
        (df && !(cupo.fechaCarga > df || (cupo.fechaCarga === df && seguimiento.cupoId > di!)))
      )
        continue;
      coincidentes.push({ seguimiento, cupo });
      if (completo && coincidentes.length > 5000)
        return error(400, "La exportación supera 5000 filas. Acotá el período o los filtros.");
    }
    coincidentes.sort(
      (a, b) =>
        a.cupo.fechaCarga.localeCompare(b.cupo.fechaCarga) ||
        a.seguimiento.cupoId.localeCompare(b.seguimiento.cupoId),
    );
    const pagina = completo ? coincidentes : coincidentes.slice(0, n);
    return HttpResponse.json({
      filas: pagina.map(({ seguimiento }) => snapshot(seguimiento.cupoId, true)!),
      hayMas: !completo && coincidentes.length > n,
      datosAl: new Date().toISOString(),
    });
  }
  const handlers = [
    http.get(`${API}/seguimientos/excel`, async ({ request }) => {
      const iniciadoAl = new Date().toISOString();
      const propia = listar(request, true);
      if (!propia.ok) return propia;
      const { filas } = (await propia.json()) as { filas: Seguimiento[] };
      const propiosAl = new Date().toISOString();
      const conciliadas = conciliarLogisticaDemo(filas);
      const consultadoAl = new Date().toISOString();
      const filtros = new URL(request.url).searchParams;
      let bytes: Uint8Array;
      try {
        bytes = await excelLogisticaDemo(conciliadas, filtros, iniciadoAl, propiosAl, consultadoAl);
      } catch (e) {
        if (
          e instanceof Error &&
          e.message === "La revisión de flota no se puede exportar sin pérdida de precisión."
        )
          return error(500, e.message);
        throw e;
      }
      const nombre = `seguimientos-logistica-${filtros.get("desde")!.replaceAll("-", "")}-${filtros.get("hastaExclusivo")!.replaceAll("-", "")}.xlsx`;
      return new HttpResponse(bytes, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${nombre}"`,
        },
      });
    }),
    http.get(`${API}/seguimientos`, ({ request }) => listar(request)),
    http.get(API + "/seguimientos/flota-disponible", ({ request }) => {
      const denied = permiso(request);
      if (denied) return denied;
      const q = new URL(request.url).searchParams;
      const textoTamano = trimFlota(q.get("tamano") ?? "50"),
        tamano = Number(textoTamano);
      const cursor = q.get("despuesId"),
        buscar = q.get("buscar");
      if (
        !/^[+-]?[0-9]+$/.test(textoTamano) ||
        !Number.isInteger(tamano) ||
        tamano < 1 ||
        tamano > 200 ||
        (cursor !== null && !uuidValido(cursor)) ||
        (buscar !== null && !textoFlotaValido(buscar, 200))
      )
        return error(400, "Filtros de camiones inválidos.");
      const filas = flotaDisponibleDemo(buscar, cursor);
      return HttpResponse.json({
        filas: filas.slice(0, tamano),
        hayMas: filas.length > tamano,
        datosAl: new Date().toISOString(),
      });
    }),
    http.put(API + "/seguimientos/:id/flota", ({ request, params }) =>
      ejecutarFlota(request, String(params.id), false),
    ),
    http.post(API + "/seguimientos/:id/flota/retirar", ({ request, params }) =>
      ejecutarFlota(request, String(params.id), true),
    ),
    http.get(API + "/seguimientos/:id", ({ request, params }) => {
      const denied = permiso(request);
      if (denied) return denied;
      const s = snapshot(String(params.id), true);
      return s
        ? HttpResponse.json({ dato: s, datosAl: new Date().toISOString() })
        : error(404, "El seguimiento no existe.");
    }),
    http.put(`${API}/seguimientos/:id/estado`, ({ request, params }) =>
      ejecutar(request, String(params.id), "estado"),
    ),
    http.post(`${API}/seguimientos/:id/datos-operativos`, ({ request, params }) =>
      ejecutar(request, String(params.id), "dato"),
    ),
    http.post(`${API}/seguimientos/:id/anular`, ({ request, params }) =>
      ejecutar(request, String(params.id), "anular"),
    ),
  ];
  return {
    handlers,
    iniciar,
    obtener: snapshot,
    listar,
    todos: () => [...seguimientos.keys()].map((id) => snapshot(id)!),
    vincular: (id: string, vinculo: VinculoErpSeguimiento) => {
      const s = seguimientos.get(id)!;
      const cupo = contexto.cupos().find((c) => c.id === id)!;
      s.vinculoErpVigente = structuredClone(vinculo);
      vinculos.set(id, [
        ...(vinculos.get(id) ?? []),
        { ...structuredClone(vinculo), vigenteHasta: null, retiradoPorId: null },
      ]);
      s.revision++;
      cupo.revision++;
      cupo.tieneVinculoErpVigente = true;
      cupo.disponibleParaOtorgar = false;
      return snapshot(id)!;
    },
    corregirVinculo: (
      id: string,
      nuevo: VinculoErpSeguimiento | null,
      instante: string,
      actor: number,
    ) => {
      const s = seguimientos.get(id)!;
      const cupo = contexto.cupos().find((c) => c.id === id)!;
      const historicos = vinculos.get(id)!;
      const vigente = historicos.find((v) => v.id === s.vinculoErpVigente!.id)!;
      vigente.vigenteHasta = instante;
      vigente.retiradoPorId = actor;
      if (nuevo)
        historicos.push({ ...structuredClone(nuevo), vigenteHasta: null, retiradoPorId: null });
      s.vinculoErpVigente = structuredClone(nuevo);
      s.revision++;
      cupo.revision++;
      cupo.tieneVinculoErpVigente = nuevo !== null;
      cupo.disponibleParaOtorgar = false;
      return snapshot(id)!;
    },
    historialVinculos: (id: string) => structuredClone(vinculos.get(id) ?? []),
    existe: (id: string) => seguimientos.has(id),
    reset: () => {
      seguimientos.clear();
      vinculos.clear();
      comandos.clear();
    },
  };
}
