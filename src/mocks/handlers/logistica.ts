import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";
import { hoy, sumarDias } from "@/features/logistica/format";
import { crearResumenDemo } from "./logistica-resumen";
import { crearConciliacionDemo } from "./logistica-conciliacion";
import { crearSeguimientosDemo } from "./logistica-seguimientos";
import { permisoLogisticaDemo } from "./auth";
import type {
  Cupo,
  Evento,
  Pedido,
  Preventa,
  Recepcion,
  Referencia,
  Solicitud,
  Venta,
  OtorgarBody,
  Otorgamiento,
  OtorgarResultado,
} from "@/features/logistica/types";
const API = `${env.apiUrl}/logistica`;
// Sólo datos ficticios. La operación propia siempre arranca vacía en el demo.
const venta: Venta = {
  numero: "V-DEMO/1",
  compradorNombre: "Comprador de ejemplo",
  productoNombre: "Soja",
  producto: 10,
  campania: 20252026,
  destinoCodigo: 101,
  destinoNombre: "Terminal de ejemplo",
  fechaEntrega: hoy(),
  fechaEntrega1: sumarDias(hoy(), 30),
  estado: "V",
};
const preventa: Preventa = {
  operacion: "PF",
  numero: "PF-DEMO/1",
  clienteNumero: 9000000001,
  clienteNombre: "Productor ficticio",
  productoNombre: "Soja",
  producto: 10,
  campania: 20252026,
  fechaEntregaInicio: hoy(),
  fechaEntregaFin: sumarDias(hoy(), 30),
  kgContratados: 300000,
  estado: "V",
};
const catalogos: Record<string, Referencia[]> = {
  clientes: [
    { codigo: 9000000001, nombre: "Productor ficticio", estado: "A" },
    { codigo: 1, nombre: "Cliente de prueba uno", estado: "A" },
  ],
  productos: [
    { codigo: 10, nombre: "Soja", estado: "V" },
    { codigo: 1, nombre: "Maíz", estado: "V" },
  ],
  destinos: [
    { codigo: 101, nombre: "Terminal de ejemplo", estado: null },
    { codigo: 102, nombre: "Otra terminal de ejemplo", estado: null },
  ],
};
let solicitudes: Solicitud[] = [],
  pedidos: Pedido[] = [],
  cupos: Cupo[] = [],
  recepciones: Recepcion[] = [];
const historia = new Map<string, Evento[]>();
const comandos = new Map<string, { cuerpo: string; dato: unknown }>();
export function resetLogisticaDemo() {
  solicitudes = [];
  pedidos = [];
  cupos = [];
  recepciones = [];
  historia.clear();
  comandos.clear();
  seguimientoDemo.reset();
  conciliacionDemo.reset();
}
function pagina<T>(filas: T[], hayMas = false) {
  return HttpResponse.json({ filas, hayMas, datosAl: new Date().toISOString() });
}
function error(status: number, detail: string) {
  return HttpResponse.json({ status, detail }, { status });
}
function registrar(
  recurso: string,
  id: string,
  revision: number,
  tipo: string,
  datos: unknown,
  motivo: string | null = null,
  actor = 1,
) {
  const clave = `${recurso}/${id}`;
  const previos = historia.get(clave) ?? [];
  previos.push({
    id: crypto.randomUUID(),
    revision,
    tipo,
    datos: JSON.stringify(datos),
    registradoAl: new Date().toISOString(),
    registradoPorId: actor,
    motivo,
  });
  historia.set(clave, previos);
}
function listado<T extends { id: string }>(filas: T[], url: URL, dia: (f: T) => string) {
  const desde = url.searchParams.get("desde") ?? "";
  const hasta = url.searchParams.get("hastaExclusivo") ?? "";
  const despues = url.searchParams.get("despuesFecha");
  const id = url.searchParams.get("despuesId") ?? "";
  const todos = filas
    .filter(
      (f) =>
        dia(f) >= desde &&
        dia(f) < hasta &&
        (!despues || dia(f) > despues || (dia(f) === despues && f.id > id)),
    )
    .sort((a, b) => dia(a).localeCompare(dia(b)) || a.id.localeCompare(b.id));
  const n = Math.min(200, Number(url.searchParams.get("tamano") ?? 50));
  return pagina(todos.slice(0, n), todos.length > n);
}
function filtrosComerciales<T extends { producto: number; campania: string }>(
  filas: T[],
  url: URL,
) {
  const producto = url.searchParams.get("producto");
  const campania = url.searchParams.get("campania");
  return filas.filter(
    (f) => (!producto || f.producto === Number(producto)) && (!campania || f.campania === campania),
  );
}
function disponible(cupo: Cupo) {
  return (
    !cupo.otorgamientoVigente &&
    !cupo.seguimientoAnulado &&
    !cupo.tieneVinculoErpVigente &&
    cupo.estadoObservado === "por_iniciar"
  );
}
function conNombre(cupo: Cupo): Cupo {
  return {
    ...cupo,
    productoNombre: catalogos.productos.find((p) => p.codigo === cupo.producto)?.nombre ?? null,
    destinoNombre: catalogos.destinos.find((d) => d.codigo === cupo.destinoCodigo)?.nombre ?? null,
    disponibleParaOtorgar: disponible(cupo),
    otorgamientoVigente: cupo.otorgamientoVigente
      ? {
          ...cupo.otorgamientoVigente,
          clienteNombre:
            catalogos.clientes.find((c) => c.codigo === cupo.otorgamientoVigente?.clienteNumero)
              ?.nombre ?? null,
        }
      : null,
  };
}
function pedidoConNombres(pedido: Pedido): Pedido {
  return {
    ...pedido,
    clienteNombre:
      catalogos.clientes.find((c) => c.codigo === pedido.clienteNumero)?.nombre ?? null,
    productoNombre: catalogos.productos.find((p) => p.codigo === pedido.producto)?.nombre ?? null,
  };
}
function comando(request: Request, cuerpo: unknown, crear: () => unknown) {
  const key = request.headers.get("Idempotency-Key");
  if (!key) return error(400, "Falta clave de idempotencia.");
  const clave = `${request.headers.get("Authorization")}:${request.method}:${request.url}:${key}`;
  const json = JSON.stringify(cuerpo);
  const existente = comandos.get(clave);
  if (existente)
    return existente.cuerpo === json
      ? HttpResponse.json(existente.dato as Record<string, unknown>)
      : error(409, "Clave usada con otro cuerpo.");
  const dato = crear();
  if (dato instanceof Response) return dato;
  const original = structuredClone(dato);
  comandos.set(clave, { cuerpo: json, dato: original });
  return HttpResponse.json(original as Record<string, unknown>, {
    status: request.method === "PUT" ? 200 : 201,
  });
}
const seguimientoDemo = crearSeguimientosDemo({ cupos: () => cupos, conNombre, registrar });
const conciliacionDemo = crearConciliacionDemo({
  seguimientos: seguimientoDemo,
  registrar,
  productoVenta: (contrato) => (contrato === venta.numero ? venta.producto : null),
});
export const logisticaHandlers = [
  ...crearResumenDemo({
    solicitudes: () => solicitudes,
    recepciones: () => recepciones,
    cupos: () => cupos,
    seguimiento: seguimientoDemo.obtener,
    productos: () => catalogos.productos,
    destinos: () => catalogos.destinos,
  }),
  ...conciliacionDemo.handlers,
  ...seguimientoDemo.handlers,
  http.get(`${API}/catalogos/:tipo`, ({ params, request }) => {
    const url = new URL(request.url);
    const buscar = (url.searchParams.get("buscar") ?? "").toLowerCase();
    const numerica = /^\d+$/.test(buscar);
    if (
      buscar &&
      (numerica ? Number(buscar) < 1 || Number(buscar) > 9999999999 : buscar.length < 2)
    )
      return error(400, "Ingresá un código positivo o al menos dos letras.");
    const filas = (catalogos[String(params.tipo)] ?? [])
      .filter(
        (f) =>
          (!buscar ||
            (numerica
              ? f.codigo === Number(buscar)
              : (f.nombre ?? "").toLowerCase().includes(buscar))) &&
          f.codigo > Number(url.searchParams.get("despuesCodigo") ?? 0),
      )
      .sort((a, b) => a.codigo - b.codigo);
    const tamano = Math.min(200, Number(url.searchParams.get("tamano") ?? 50));
    return pagina(filas.slice(0, tamano), filas.length > tamano);
  }),
  http.get(`${API}/preventas`, ({ request }) => {
    const url = new URL(request.url);
    const buscar = (url.searchParams.get("buscar") ?? "").toLowerCase();
    const cliente = url.searchParams.get("clienteNumero");
    const producto = url.searchParams.get("producto");
    const campania = url.searchParams.get("campania");
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hastaExclusivo");
    if (desde && hasta && (Date.parse(hasta) - Date.parse(desde)) / 86400000 > 366)
      return error(400, "Elegí un período de hasta 366 días.");
    return pagina(
      !url.searchParams.get("despuesNumero") &&
        (!cliente || preventa.clienteNumero === Number(cliente)) &&
        (!producto || preventa.producto === Number(producto)) &&
        (!campania || preventa.campania === Number(campania)) &&
        (!desde || hoy() >= desde) &&
        (!hasta || hoy() < hasta) &&
        `${preventa.numero} ${preventa.clienteNombre}`.toLowerCase().includes(buscar)
        ? [preventa]
        : [],
    );
  }),
  http.get(`${API}/preventas/detalle`, ({ request }) =>
    new URL(request.url).searchParams.get("numero") === preventa.numero
      ? HttpResponse.json({ dato: preventa, datosAl: new Date().toISOString() })
      : error(404, "Preventa de ejemplo inexistente."),
  ),
  http.get(`${API}/contratos`, ({ request }) => {
    const url = new URL(request.url);
    const buscar = (url.searchParams.get("buscar") ?? "").toLowerCase();
    return pagina(
      !url.searchParams.get("despuesNumero") &&
        `${venta.numero} ${venta.compradorNombre}`.toLowerCase().includes(buscar)
        ? [venta]
        : [],
    );
  }),
  http.get(`${API}/solicitudes-terminal`, ({ request }) =>
    listado(solicitudes, new URL(request.url), (f) => f.fechaSolicitada),
  ),
  http.get(`${API}/pedidos`, ({ request }) => {
    const url = new URL(request.url);
    return listado(
      filtrosComerciales(pedidos, url)
        .map(pedidoConNombres)
        .filter(
          (p) =>
            (!url.searchParams.has("clienteNumero") ||
              p.clienteNumero === Number(url.searchParams.get("clienteNumero"))) &&
            (url.searchParams.get("soloPendientes") !== "true" || p.pendientes > 0),
        ),
      url,
      (f) => f.fechaSolicitada,
    );
  }),
  http.get(`${API}/cupos`, ({ request }) => {
    const url = new URL(request.url);
    const destino = url.searchParams.get("destinoCodigo");
    const circuito = url.searchParams.get("circuito");
    const cliente = url.searchParams.get("clienteNumero");
    return listado(
      filtrosComerciales(cupos.map(conNombre), url).filter(
        (c) =>
          (!url.searchParams.has("contrato") ||
            c.contratoVenta === url.searchParams.get("contrato")) &&
          (!destino || c.destinoCodigo === Number(destino)) &&
          (!circuito || c.circuito === circuito) &&
          (!cliente || c.otorgamientoVigente?.clienteNumero === Number(cliente)) &&
          (url.searchParams.get("soloDisponibles") !== "true" || c.disponibleParaOtorgar),
      ),
      url,
      (f) => f.fechaCarga,
    );
  }),
  http.get(`${API}/:recurso/:id/historial`, ({ params, request }) => {
    if (params.recurso === "seguimientos") {
      const denied = permisoLogisticaDemo(request, false);
      if (denied) return error(denied, "No tenés acceso a este historial.");
      if (!seguimientoDemo.existe(String(params.id)))
        return error(404, "El seguimiento no existe.");
    }
    const revision = Number(new URL(request.url).searchParams.get("despuesRevision") ?? 0);
    if (!Number.isInteger(revision) || revision < 0)
      return error(400, "Continuación de historia inválida.");
    const filas = (historia.get(`${params.recurso}/${params.id}`) ?? []).filter(
      (f) => f.revision > revision,
    );
    return pagina(filas.slice(0, 200), filas.length > 200);
  }),
  http.post(`${API}/solicitudes-terminal`, async ({ request }) => {
    const body = (await request.json()) as Omit<
      Solicitud,
      | "id"
      | "revision"
      | "producto"
      | "campania"
      | "cerradaAl"
      | "motivoCierre"
      | "ultimaRespuesta"
      | "recibidos"
    >;
    if (body.contratoVenta !== venta.numero) return error(404, "Contrato de ejemplo inexistente.");
    return comando(request, body, () => {
      const dato: Solicitud = {
        ...body,
        id: crypto.randomUUID(),
        revision: 1,
        productoNombre: "Soja",
        producto: 10,
        campania: "2025-2026",
        destinoNombre: catalogos.destinos.find((d) => d.codigo === body.destinoCodigo)?.nombre,
        cerradaAl: null,
        motivoCierre: null,
        ultimaRespuesta: null,
        recibidos: 0,
      };
      solicitudes.push(dato);
      registrar("solicitudes-terminal", dato.id, 1, "solicitud_creada", dato);
      return dato;
    });
  }),
  http.post(`${API}/solicitudes-terminal/:id/respuestas`, async ({ request, params }) => {
    const body = (await request.json()) as {
      revision: number;
      cantidadCupos: number;
      referencia: string;
      observadoAl: string;
    };
    const s = solicitudes.find((f) => f.id === params.id);
    if (!s) return error(404, "Solicitud inexistente.");
    return comando(request, body, () => {
      if (s.revision !== body.revision)
        return error(409, "La solicitud cambió. Actualizá los datos.");
      s.revision++;
      s.ultimaRespuesta = body.cantidadCupos;
      registrar("solicitudes-terminal", s.id, s.revision, "respuesta_registrada", {
        respuesta: body,
      });
      return { ...s };
    });
  }),
  http.post(`${API}/solicitudes-terminal/:id/cerrar`, async ({ request, params }) => {
    const body = (await request.json()) as { revision: number; motivo: string };
    const s = solicitudes.find((f) => f.id === params.id);
    if (!s) return error(404, "Solicitud inexistente.");
    return comando(request, body, () => {
      if (s.revision !== body.revision || s.cerradaAl)
        return error(409, "La solicitud cambió o ya está cerrada.");
      s.revision++;
      s.cerradaAl = new Date().toISOString();
      s.motivoCierre = body.motivo;
      registrar("solicitudes-terminal", s.id, s.revision, "solicitud_cerrada", s, body.motivo);
      return { ...s };
    });
  }),
  http.post(`${API}/pedidos`, async ({ request }) => {
    const body = (await request.json()) as Omit<
      Pedido,
      "id" | "revision" | "clienteNombre" | "otorgados" | "pendientes" | "estado"
    >;
    return comando(request, body, () => {
      const dato: Pedido = {
        ...body,
        id: crypto.randomUUID(),
        revision: 1,
        clienteNombre: null,
        productoNombre: null,
        otorgados: 0,
        pendientes: body.cantidadCupos,
        estado: "pendiente",
      };
      pedidos.push(dato);
      registrar("pedidos", dato.id, 1, "pedido_creado", dato);
      return dato;
    });
  }),
  http.put(`${API}/pedidos/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Pedido;
    const anterior = pedidos.find((f) => f.id === params.id);
    if (!anterior) return error(404, "Pedido inexistente.");
    return comando(request, body, () => {
      if (anterior.revision !== body.revision)
        return error(409, "El pedido cambió. Actualizá los datos.");
      const otorgados = cupos.filter((c) => c.otorgamientoVigente?.pedidoId === anterior.id).length;
      if (
        body.cantidadCupos < otorgados ||
        (otorgados > 0 &&
          (anterior.clienteNumero !== body.clienteNumero ||
            anterior.producto !== body.producto ||
            anterior.campania !== body.campania ||
            anterior.preventa?.operacion !== body.preventa?.operacion ||
            anterior.preventa?.numero !== body.preventa?.numero))
      )
        return error(
          409,
          "El pedido tiene otorgamientos vigentes. Conservá sus referencias y una cantidad suficiente.",
        );
      const dato: Pedido = {
        ...anterior,
        ...body,
        id: anterior.id,
        revision: anterior.revision + 1,
        clienteNombre: null,
        productoNombre: null,
        otorgados,
        pendientes: Math.max(0, body.cantidadCupos - otorgados),
        estado:
          otorgados === 0 ? "pendiente" : otorgados < body.cantidadCupos ? "parcial" : "atendido",
      };
      pedidos = pedidos.map((f) => (f.id === dato.id ? dato : f));
      registrar("pedidos", dato.id, dato.revision, "pedido_corregido", { anterior, nuevo: dato });
      return dato;
    });
  }),
  http.post(`${API}/cupos/recepciones`, async ({ request }) => {
    const body = (await request.json()) as {
      contratoVenta: string;
      solicitudId: string | null;
      referencia: string;
      recibidoAl: string;
      filas: Omit<
        Cupo,
        | "id"
        | "revision"
        | "tandaId"
        | "contratoVenta"
        | "producto"
        | "campania"
        | "estadoObservado"
      >[];
    };
    return comando(request, body, () => {
      const id = crypto.randomUUID();
      const nuevos: Cupo[] = body.filas.map((f) => ({
        ...f,
        id: crypto.randomUUID(),
        revision: 1,
        tandaId: id,
        contratoVenta: body.contratoVenta,
        productoNombre: "Soja",
        producto: 10,
        campania: "2025-2026",
        destinoNombre: catalogos.destinos.find((d) => d.codigo === f.destinoCodigo)?.nombre,
        estadoObservado: "por_iniciar",
        otorgamientoVigente: null,
        seguimientoAnulado: false,
        tieneVinculoErpVigente: false,
        disponibleParaOtorgar: true,
      }));
      const solicitud = solicitudes.find((s) => s.id === body.solicitudId);
      const advertencias: string[] = [];
      if (solicitud) {
        solicitud.revision++;
        solicitud.recibidos += nuevos.length;
        if (solicitud.cerradaAl)
          advertencias.push("Recepción posterior al cierre de la solicitud.");
        if (
          nuevos.some(
            (f) =>
              f.fechaCarga !== solicitud.fechaSolicitada ||
              f.destinoCodigo !== solicitud.destinoCodigo,
          )
        )
          advertencias.push("Hay filas con fecha o destino distintos a lo solicitado.");
        registrar("solicitudes-terminal", solicitud.id, solicitud.revision, "recepcion_vinculada", {
          cantidad: nuevos.length,
          advertencias,
        });
      }
      const dato: Recepcion = {
        id,
        revision: 1,
        contratoVenta: body.contratoVenta,
        solicitudId: body.solicitudId,
        referencia: body.referencia,
        recibidoAl: body.recibidoAl,
        cupos: nuevos,
        advertencias,
      };
      nuevos.forEach((f) => registrar("cupos", f.id, 1, "cupo_recibido", f));
      cupos.push(...nuevos);
      nuevos.forEach((f) => seguimientoDemo.iniciar(f, body.referencia));
      recepciones.push(dato);
      return dato;
    });
  }),
  http.post(`${API}/otorgamientos`, async ({ request }) => {
    const body = (await request.json()) as OtorgarBody;
    return comando(request, body, () => {
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (
        !uuid.test(request.headers.get("Idempotency-Key") ?? "") ||
        !Array.isArray(body.cupos) ||
        body.cupos.length < 1 ||
        body.cupos.length > 200 ||
        new Set(body.cupos.map((c) => c.id)).size !== body.cupos.length ||
        body.cupos.some((c) => !uuid.test(c.id) || !Number.isInteger(c.revision) || c.revision < 1)
      )
        return error(400, "Elegí de 1 a 200 cupos únicos con revisiones válidas.");
      if (body.destinatarioTipo !== "cliente" && body.destinatarioTipo !== "propio")
        return error(400, "Elegí un destinatario válido.");
      if (
        body.destinatarioTipo === "propio" &&
        (body.clienteNumero != null ||
          body.pedidoId != null ||
          body.pedidoRevision != null ||
          body.preventa != null)
      )
        return error(400, "Propio no admite cliente, pedido ni preventa.");
      if (
        body.destinatarioTipo === "cliente" &&
        (!Number.isInteger(body.clienteNumero) ||
          (body.clienteNumero ?? 0) < 1 ||
          (body.clienteNumero ?? 0) > 9999999999)
      )
        return error(400, "Elegí un cliente válido.");
      if (
        body.pedidoId
          ? !Number.isInteger(body.pedidoRevision) || (body.pedidoRevision ?? 0) < 1
          : body.pedidoRevision != null
      )
        return error(400, "El pedido requiere su revisión.");
      const filas = body.cupos.map((c) => cupos.find((f) => f.id === c.id));
      if (filas.some((f) => !f)) return error(404, "Un cupo no existe.");
      const elegidos = filas as Cupo[];
      if (elegidos.some((c, i) => c.revision !== body.cupos[i].revision || !disponible(c)))
        return error(409, "Un cupo cambió o ya no está disponible.");
      const primero = elegidos[0];
      if (elegidos.some((c) => c.producto !== primero.producto || c.campania !== primero.campania))
        return error(400, "Los cupos deben compartir cereal y campaña.");
      const pedido = body.pedidoId ? pedidos.find((p) => p.id === body.pedidoId) : null;
      if (body.pedidoId && !pedido) return error(404, "El pedido no existe.");
      if (
        pedido &&
        (pedido.revision !== body.pedidoRevision || elegidos.length > pedido.pendientes)
      )
        return error(409, "El pedido cambió o no tiene suficientes pendientes.");
      if (
        pedido &&
        (pedido.clienteNumero !== body.clienteNumero ||
          pedido.producto !== primero.producto ||
          pedido.campania !== primero.campania)
      )
        return error(400, "El destinatario no coincide con el pedido y los cupos.");
      if (
        body.destinatarioTipo === "cliente" &&
        !catalogos.clientes.some((c) => c.codigo === body.clienteNumero && c.estado === "A")
      )
        return error(400, "El cliente no está activo.");
      if (
        pedido &&
        body.preventa &&
        (pedido.preventa?.numero !== body.preventa.numero ||
          pedido.preventa.operacion !== body.preventa.operacion)
      )
        return error(400, "La preventa no coincide con el pedido.");
      const ref = body.preventa ?? pedido?.preventa ?? null;
      if (ref && (ref.numero !== preventa.numero || ref.operacion !== preventa.operacion))
        return error(404, "La preventa no existe.");
      if (
        ref &&
        (preventa.clienteNumero !== body.clienteNumero ||
          preventa.producto !== primero.producto ||
          preventa.campania !== Number(primero.campania.replace("-", "")) ||
          preventa.estado === "A")
      )
        return error(400, "La preventa no corresponde al cliente, cereal y campaña.");
      const vigenteDesde = new Date().toISOString();
      const otorgamientos: Otorgamiento[] = elegidos.map((c) => ({
        id: crypto.randomUUID(),
        revision: 1,
        cupoId: c.id,
        pedidoId: pedido?.id ?? null,
        destinatarioTipo: body.destinatarioTipo,
        clienteNumero: body.clienteNumero ?? null,
        clienteNombre: null,
        preventa: ref,
        kgEstimados: 30000,
        vigenteDesde,
      }));
      elegidos.forEach((c, i) => {
        c.revision++;
        c.otorgamientoVigente = otorgamientos[i];
        c.disponibleParaOtorgar = false;
        const o = otorgamientos[i];
        registrar("cupos", c.id, c.revision, "cupo_otorgado", {
          otorgamientoId: o.id,
          cupoId: c.id,
          pedidoId: o.pedidoId,
          destinatarioTipo: o.destinatarioTipo,
          clienteNumero: o.clienteNumero,
          preventa: o.preventa,
          kgEstimados: o.kgEstimados,
          vigenteDesde: o.vigenteDesde,
        });
      });
      if (pedido) {
        pedido.revision++;
        pedido.otorgados += elegidos.length;
        pedido.pendientes = pedido.cantidadCupos - pedido.otorgados;
        pedido.estado = pedido.pendientes === 0 ? "atendido" : "parcial";
        registrar("pedidos", pedido.id, pedido.revision, "cupos_otorgados", {
          pedidoId: pedido.id,
          cupos: elegidos.map((c) => ({ id: c.id, revision: c.revision })),
          otorgamientos: otorgamientos.map((o) => o.id),
          otorgados: pedido.otorgados,
          pendientes: pedido.pendientes,
        });
      }
      const advertencias: string[] = [];
      if (elegidos.some((c) => !c.codigoTerminal))
        advertencias.push("Hay cupos con código terminal pendiente de informar.");
      if (elegidos.some((c) => c.fechaCarga < hoy()))
        advertencias.push("Hay cupos con fecha de carga pasada.");
      if (new Set(elegidos.map((c) => c.fechaCarga)).size > 1)
        advertencias.push("Las fechas de carga son distintas.");
      if (new Set(elegidos.map((c) => c.destinoCodigo)).size > 1)
        advertencias.push("Los destinos son distintos.");
      return {
        otorgamientos,
        cupos: elegidos,
        pedido: pedido ?? null,
        advertencias,
      } satisfies OtorgarResultado;
    });
  }),
];
