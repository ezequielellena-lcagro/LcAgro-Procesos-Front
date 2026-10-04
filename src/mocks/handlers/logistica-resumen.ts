import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";
import type {
  Cupo,
  GrupoResumen,
  MetricasResumen,
  Recepcion,
  Referencia,
  Seguimiento,
  Solicitud,
} from "@/features/logistica/types";
import { campaniaResumenValida, claveResumen } from "@/features/logistica/lib/resumen";
import { permisoLogisticaDemo } from "./auth";
interface Contexto {
  solicitudes: () => Solicitud[];
  recepciones: () => Recepcion[];
  cupos: () => Cupo[];
  seguimiento: (id: string) => Seguimiento | null;
  productos: () => Referencia[];
  destinos: () => Referencia[];
}
const error = (status: number, detail: string) => HttpResponse.json({ status, detail }, { status });
function diaValido(d: string | null): d is string {
  return (
    !!d &&
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d) &&
    d >= "1753-01-01" &&
    Number.isFinite(Date.parse(d)) &&
    new Date(d).toISOString().slice(0, 10) === d
  );
}
function claveValida(s: string | null) {
  return !!s?.trim() && s.length <= 15 && !/\p{Cc}/u.test(s);
}
function entero(s: string | null, max: number) {
  return s !== null && /^\+?[0-9]+$/.test(s) && Number(s) >= 1 && Number(s) <= max;
}
function validar(p: URLSearchParams) {
  const desde = p.get("desde"),
    hasta = p.get("hastaExclusivo");
  if (
    !diaValido(desde) ||
    !diaValido(hasta) ||
    hasta <= desde ||
    (Date.parse(hasta) - Date.parse(desde)) / 86400000 > 366
  )
    return "Indicá un período cerrado de hasta 366 días, con inicio anterior al fin exclusivo.";
  if (p.has("tamano") && !entero(p.get("tamano"), 200))
    return "El tamaño de página debe estar entre 1 y 200.";
  if (p.has("contrato") && !claveValida(p.get("contrato"))) return "Contrato inválido.";
  if (p.has("producto") && !entero(p.get("producto"), 999999)) return "Producto inválido.";
  if (p.has("destinoCodigo") && !entero(p.get("destinoCodigo"), 99999999))
    return "Destino inválido.";
  if (p.has("campania") && !campaniaResumenValida(p.get("campania")!)) return "Campaña inválida.";
  const cursor = [
    "despuesFecha",
    "despuesDestinoCodigo",
    "despuesContrato",
    "despuesProducto",
    "despuesCampania",
  ];
  if (!cursor.some((c) => p.has(c))) return null;
  const fecha = p.get("despuesFecha");
  if (
    !diaValido(fecha) ||
    !entero(p.get("despuesDestinoCodigo"), 99999999) ||
    !claveValida(p.get("despuesContrato")) ||
    !entero(p.get("despuesProducto"), 999999) ||
    !campaniaResumenValida(p.get("despuesCampania") ?? "")
  )
    return "La continuación requiere fecha, destino, contrato, producto y campaña completos y válidos.";
  return fecha < desde || fecha >= hasta
    ? "La continuación debe pertenecer al período consultado."
    : null;
}
function vacias(): MetricasResumen {
  return {
    solicitudes: 0,
    cerradas: 0,
    solicitados: 0,
    respuestaVigente: null,
    sinRespuesta: 0,
    respuestaCero: 0,
    recibidos: 0,
    otorgados: 0,
    porRecibir: null,
    porOtorgar: 0,
    otrosSinOtorgar: 0,
    anulados: 0,
    fechaCargaDistinta: 0,
    destinoDistinto: 0,
  };
}
function sumar(a: MetricasResumen, b: MetricasResumen) {
  for (const key of Object.keys(a) as (keyof MetricasResumen)[]) {
    if (key === "respuestaVigente" || key === "porRecibir") {
      if (b[key] !== null) a[key] = (a[key] ?? 0) + b[key];
    } else a[key] += b[key];
  }
}
function comparar(
  a: Pick<GrupoResumen, "fechaSolicitada" | "destinoCodigo" | "contrato" | "producto" | "campania">,
  b: Pick<GrupoResumen, "fechaSolicitada" | "destinoCodigo" | "contrato" | "producto" | "campania">,
) {
  for (const key of [
    "fechaSolicitada",
    "destinoCodigo",
    "contrato",
    "producto",
    "campania",
  ] as const) {
    if (a[key] < b[key]) return -1;
    if (a[key] > b[key]) return 1;
  }
  return 0;
}
export function crearResumenDemo(contexto: Contexto) {
  return [
    http.get(`${env.apiUrl}/logistica/resumen`, ({ request }) => {
      const permiso = request.headers.get("Authorization")?.trim()
        ? permisoLogisticaDemo(request, false)
        : 401;
      if (permiso)
        return error(
          permiso,
          permiso === 401 ? "Ingresá para continuar." : "No tenés acceso al resumen de cupos.",
        );
      const p = new URL(request.url).searchParams;
      const invalidacion = validar(p);
      if (invalidacion) return error(400, invalidacion);
      const propiosAl = new Date().toISOString();
      // Una instantánea del mismo store: toda recepción vinculada, sin recortar por carga.
      const solicitudes = structuredClone(contexto.solicitudes());
      const recepciones = structuredClone(contexto.recepciones());
      const cupos = structuredClone(contexto.cupos());
      const seguimientos = new Map(cupos.map((c) => [c.id, contexto.seguimiento(c.id)]));
      const solicitudPorTanda = new Map(recepciones.map((r) => [r.id, r.solicitudId]));
      const seleccion = solicitudes.filter(
        (s) =>
          s.fechaSolicitada >= p.get("desde")! &&
          s.fechaSolicitada < p.get("hastaExclusivo")! &&
          (!p.has("contrato") || s.contratoVenta === p.get("contrato")) &&
          (!p.has("producto") || s.producto === Number(p.get("producto"))) &&
          (!p.has("campania") || s.campania === p.get("campania")) &&
          (!p.has("destinoCodigo") || s.destinoCodigo === Number(p.get("destinoCodigo"))),
      );
      const grupos = new Map<string, GrupoResumen>();
      const totales = vacias();
      for (const s of seleccion) {
        const vinculados = [
          ...new Map(
            cupos.filter((c) => solicitudPorTanda.get(c.tandaId) === s.id).map((c) => [c.id, c]),
          ).values(),
        ];
        const m = vacias();
        m.solicitudes = 1;
        m.cerradas = s.cerradaAl ? 1 : 0;
        m.solicitados = s.cantidadCupos;
        m.respuestaVigente = s.ultimaRespuesta;
        m.sinRespuesta = s.ultimaRespuesta === null ? 1 : 0;
        m.respuestaCero = s.ultimaRespuesta === 0 ? 1 : 0;
        m.recibidos = vinculados.length;
        m.porRecibir =
          s.ultimaRespuesta === null ? null : Math.max(0, s.ultimaRespuesta - m.recibidos);
        for (const c of vinculados) {
          const seg = seguimientos.get(c.id);
          if (c.otorgamientoVigente) m.otorgados++;
          else if (
            seg &&
            !seg.anuladoAl &&
            seg.estadoObservado === "por_iniciar" &&
            !seg.vinculoErpVigente
          )
            m.porOtorgar++;
          else m.otrosSinOtorgar++;
          if (seg?.anuladoAl) m.anulados++;
          if (c.fechaCarga !== s.fechaSolicitada) m.fechaCargaDistinta++;
          if (c.destinoCodigo !== s.destinoCodigo) m.destinoDistinto++;
        }
        const fila: GrupoResumen = {
          fechaSolicitada: s.fechaSolicitada,
          destinoCodigo: s.destinoCodigo,
          contrato: s.contratoVenta,
          producto: s.producto,
          campania: s.campania,
          metricas: vacias(),
        };
        const key = claveResumen(fila);
        const grupo = grupos.get(key) ?? fila;
        sumar(grupo.metricas, m);
        grupos.set(key, grupo);
        sumar(totales, m);
      }
      const cursor = p.has("despuesFecha")
        ? {
            fechaSolicitada: p.get("despuesFecha")!,
            destinoCodigo: Number(p.get("despuesDestinoCodigo")),
            contrato: p.get("despuesContrato")!,
            producto: Number(p.get("despuesProducto")),
            campania: p.get("despuesCampania")!,
          }
        : null;
      const ordenadas = [...grupos.values()]
        .sort(comparar)
        .filter((g) => !cursor || comparar(g, cursor) > 0);
      const tamano = Number(p.get("tamano") ?? 50);
      const filas = ordenadas.slice(0, tamano).map((f) => ({
        ...f,
        productoNombre: contexto.productos().find((n) => n.codigo === f.producto)?.nombre ?? null,
        destinoNombre:
          contexto.destinos().find((n) => n.codigo === f.destinoCodigo)?.nombre ?? null,
      }));
      return HttpResponse.json({
        filas,
        totales,
        hayMas: ordenadas.length > tamano,
        propiosAl,
        datosAl: new Date().toISOString(),
        baseFecha: "fecha_solicitada",
        fuente: "logistica",
      });
    }),
  ];
}
