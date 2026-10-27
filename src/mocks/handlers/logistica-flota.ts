import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";
import {
  fichaFlotaValida,
  normalizarFichaFlota,
  mayusculasFlotaInvariantes,
  patenteFlotaEquivalente,
  textoFlotaValido,
  trimFlota,
} from "@/features/logistica/lib/flota";
import type {
  FichaFlotaDto,
  FichaFlotaRequest,
  FichaFlotaVersionDto,
  Evento,
} from "@/features/logistica/types";
import { permisoLogisticaDemo, usuarioLogisticaDemo } from "./auth";

const API = env.apiUrl + "/logistica/flota";
const REVISION_MAXIMA = 9223372036854775807n;
const fichas = new Map<string, FichaFlotaDto>();
const versiones = new Map<string, FichaFlotaVersionDto>();
const historias = new Map<string, Evento[]>();
const comandos = new Map<string, { cuerpo: string; dato: FichaFlotaDto }>();
/** Camiones activos del padrón, como los ve Cargas a puerto para elegir. */
export function fichasActivasDemo(): FichaFlotaDto[] {
  return [...fichas.values()].filter((f) => f.activo).map((f) => structuredClone(f));
}
/** La versión de una ficha, si existe: Cargas guarda la versión exacta elegida. */
export function versionFlotaDemo(versionId: string): FichaFlotaVersionDto | undefined {
  const v = versiones.get(versionId.toLowerCase());
  return v ? structuredClone(v) : undefined;
}
// El padrón propio comienza vacío. El reset sólo sirve a pruebas; no borra datos al login.
export function resetFlotaDemo() {
  fichas.clear();
  versiones.clear();
  historias.clear();
  comandos.clear();
}
function error(status: number, detail: string) {
  return HttpResponse.json({ status, detail }, { status });
}
function uuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) &&
    value !== "00000000-0000-0000-0000-000000000000"
  );
}
function permitido(request: Request, escritura = false) {
  const status = permisoLogisticaDemo(request, escritura, "logistica-flete");
  return status ? error(status, "No tenés acceso a Flete.") : null;
}
function repetida(id: string, campos: FichaFlotaRequest) {
  const patente = patenteFlotaEquivalente(campos.patenteChasis);
  return [...fichas.values()].some(
    (f) => f.id !== id && f.activo && patenteFlotaEquivalente(f.ficha.patenteChasis) === patente,
  );
}
function leer(f: FichaFlotaDto) {
  return { ...structuredClone(f), patenteChasisRepetida: repetida(f.id, f.ficha) };
}
function detalle(dato: unknown) {
  return HttpResponse.json({ dato, datosAl: new Date().toISOString() });
}
function pagina(filas: unknown[], n: number) {
  return HttpResponse.json({
    filas: filas.slice(0, n),
    hayMas: filas.length > n,
    datosAl: new Date().toISOString(),
  });
}
// Equivale a serializar el DTO recibido: orden estable, valores sin normalizar.
function peticionFicha(f: FichaFlotaRequest): FichaFlotaRequest {
  return {
    patenteChasis: f.patenteChasis,
    patenteAcoplado: f.patenteAcoplado ?? null,
    conductor: f.conductor ?? null,
    cuitConductor: f.cuitConductor ?? null,
    transportista: f.transportista ?? null,
    cuitTransportista: f.cuitTransportista ?? null,
    importeReferencia: f.importeReferencia ?? null,
    moneda: f.moneda ?? null,
    vigenteDesde: f.vigenteDesde ?? null,
  };
}
type Cambio = { revision?: number; ficha?: FichaFlotaRequest; motivo?: string };
async function ejecutar(request: Request, modo: "crear" | "editar" | "baja", rutaId?: string) {
  const denied = permitido(request, true);
  if (denied) return denied;
  let recibido: unknown;
  try {
    recibido = await request.json();
  } catch {
    return error(400, "Cuerpo inválido.");
  }
  if (!recibido || typeof recibido !== "object" || Array.isArray(recibido))
    return error(400, "Cuerpo inválido.");
  const cambio = recibido as Cambio;
  const crear = modo === "crear";
  const ficha = crear ? recibido : cambio.ficha;
  if (
    (modo !== "baja" && !fichaFlotaValida(ficha)) ||
    (!crear &&
      (!Number.isInteger(cambio.revision) ||
        (cambio.revision ?? 0) < 1 ||
        BigInt(cambio.revision!) > REVISION_MAXIMA ||
        !textoFlotaValido(cambio.motivo, 500))) ||
    (!crear && !uuid(rutaId))
  )
    return error(400, "Revisá los campos obligatorios, formatos y límites de la ficha.");
  const clave = request.headers.get("Idempotency-Key");
  if (!uuid(clave)) return error(400, "Indicá Idempotency-Key como UUID no vacío.");
  const actor = usuarioLogisticaDemo(request);
  if (!actor) return error(401, "Sesión inválida.");
  const id = rutaId?.toLowerCase();
  const identidad = actor.id + ":flota_" + modo + ":" + clave.toLowerCase();
  const cuerpo = JSON.stringify(
    crear
      ? peticionFicha(ficha as FichaFlotaRequest)
      : {
          fichaId: id,
          request:
            modo === "editar"
              ? {
                  revision: cambio.revision,
                  ficha: peticionFicha(cambio.ficha!),
                  motivo: cambio.motivo,
                }
              : { revision: cambio.revision, motivo: cambio.motivo },
        },
  );
  const anteriorComando = comandos.get(identidad);
  if (anteriorComando)
    return anteriorComando.cuerpo === cuerpo
      ? HttpResponse.json(structuredClone(anteriorComando.dato))
      : error(409, "La clave de idempotencia ya se usó con otra operación.");
  const anterior = id ? fichas.get(id) : undefined;
  if (!crear && !anterior) return error(404, "La ficha o versión no existe.");
  if (anterior && (!anterior.activo || anterior.revision !== cambio.revision))
    return error(409, "La ficha cambió o está inactiva. Actualizá los datos.");
  const al = new Date().toISOString();
  const fichaId = anterior?.id ?? crypto.randomUUID();
  const campos =
    modo === "baja"
      ? structuredClone(anterior!.ficha)
      : normalizarFichaFlota(ficha as FichaFlotaRequest);
  const version: FichaFlotaVersionDto = {
    id: crypto.randomUUID(),
    fichaId,
    revision: (anterior?.revision ?? 0) + 1,
    activo: modo !== "baja",
    ficha: campos,
    registradoAl: al,
    registradoPorId: actor.id,
  };
  const dato: FichaFlotaDto = {
    id: fichaId,
    revision: version.revision,
    versionId: version.id,
    activo: version.activo,
    ficha: structuredClone(campos),
    patenteChasisRepetida: repetida(fichaId, campos),
    creadoAl: anterior?.creadoAl ?? al,
    creadoPorId: anterior?.creadoPorId ?? actor.id,
    actualizadoAl: al,
    actualizadoPorId: actor.id,
  };
  const motivo = crear ? null : trimFlota(cambio.motivo!);
  const evento: Evento = {
    id: crypto.randomUUID(),
    revision: version.revision,
    tipo:
      modo === "crear"
        ? "ficha_flota_creada"
        : modo === "editar"
          ? "ficha_flota_editada"
          : "ficha_flota_baja",
    datos: JSON.stringify({
      anterior: anterior ? versiones.get(anterior.versionId) : null,
      nuevo: version,
      motivo,
      registradoAl: al,
      registradoPorId: actor.id,
    }),
    registradoAl: al,
    registradoPorId: actor.id,
    motivo,
  };
  // Todos los rechazos ocurren antes de este commit síncrono de estado, versión, evento y respuesta.
  fichas.set(fichaId, structuredClone(dato));
  versiones.set(version.id, structuredClone(version));
  historias.set(fichaId, [...(historias.get(fichaId) ?? []), evento]);
  comandos.set(identidad, { cuerpo, dato: structuredClone(dato) });
  return HttpResponse.json(dato, { status: crear ? 201 : 200 });
}
export const logisticaFlotaHandlers = [
  http.get(API, ({ request }) => {
    const denied = permitido(request);
    if (denied) return denied;
    const q = new URL(request.url).searchParams;
    const tamano = trimFlota(q.get("tamano") ?? "50");
    const n = Number(tamano);
    const cursor = q.get("despuesId");
    const buscar = q.get("buscar");
    const activo = q.get("activo");
    if (
      !/^[+-]?[0-9]+$/.test(tamano) ||
      !Number.isInteger(n) ||
      n < 1 ||
      n > 200 ||
      (cursor !== null && !uuid(cursor)) ||
      (buscar !== null && !textoFlotaValido(buscar, 200)) ||
      (activo !== null && !["true", "false"].includes(activo.toLowerCase()))
    )
      return error(400, "Filtros de flota inválidos.");
    const busqueda = buscar === null ? undefined : mayusculasFlotaInvariantes(trimFlota(buscar));
    const equivalencia = buscar === null ? null : patenteFlotaEquivalente(trimFlota(buscar));
    const filas = [...fichas.values()]
      .filter(
        (f) =>
          (cursor === null || f.id > cursor.toLowerCase()) &&
          (activo === null || f.activo === (activo.toLowerCase() === "true")) &&
          (!busqueda ||
            [
              f.ficha.conductor,
              f.ficha.transportista,
              f.ficha.patenteChasis,
              f.ficha.patenteAcoplado,
            ].some((t) => t !== null && mayusculasFlotaInvariantes(t).includes(busqueda)) ||
            (equivalencia !== null &&
              equivalencia.length > 0 &&
              patenteFlotaEquivalente(f.ficha.patenteChasis).includes(equivalencia))),
      )
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map(leer);
    return pagina(filas, n);
  }),
  http.get(API + "/:id/versiones/:versionId", ({ request, params }) => {
    const denied = permitido(request);
    if (denied) return denied;
    if (!uuid(params.id) || !uuid(params.versionId)) return error(400, "Identificador inválido.");
    const version = versiones.get(params.versionId.toLowerCase());
    return version?.fichaId === params.id.toLowerCase()
      ? detalle(structuredClone(version))
      : error(404, "La ficha o versión no existe.");
  }),
  http.get(API + "/:id/historial", ({ request, params }) => {
    const denied = permitido(request);
    if (denied) return denied;
    const textoRevision = trimFlota(
      new URL(request.url).searchParams.get("despuesRevision") ?? "0",
    );
    const revision = /^[+-]?[0-9]+$/.test(textoRevision) ? BigInt(textoRevision) : null;
    if (!uuid(params.id) || revision === null || revision > REVISION_MAXIMA || revision < 0)
      return error(400, "Continuación de historia inválida.");
    const id = params.id.toLowerCase();
    if (!fichas.has(id)) return error(404, "La ficha o versión no existe.");
    return pagina(
      (historias.get(id) ?? []).filter((f) => BigInt(f.revision) > revision),
      200,
    );
  }),
  http.get(API + "/:id", ({ request, params }) => {
    const denied = permitido(request);
    if (denied) return denied;
    if (!uuid(params.id)) return error(400, "Identificador inválido.");
    const f = fichas.get(params.id.toLowerCase());
    return f ? detalle(leer(f)) : error(404, "La ficha o versión no existe.");
  }),
  http.post(API, ({ request }) => ejecutar(request, "crear")),
  http.put(API + "/:id", ({ request, params }) => ejecutar(request, "editar", String(params.id))),
  http.post(API + "/:id/baja", ({ request, params }) =>
    ejecutar(request, "baja", String(params.id)),
  ),
];
