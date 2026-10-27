import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";
import { hoy, sumarDias } from "@/features/logistica/format";
import { fichasActivasDemo, versionFlotaDemo } from "./logistica-flota";
import type {
  CargaLogistica,
  CargaPropia,
  ClaveCupo,
  CupoErp,
  CupoPlanta0,
  DeshacerResultado,
  EstadoOtorgamiento,
  Evento,
  Pedido,
  Preventa,
  Referencia,
  Solicitud,
  Venta,
  OtorgarBody,
  Otorgamiento,
  OtorgamientoConEstado,
  OtorgarResultado,
  PlanCarga,
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
  campanias: [
    { codigo: 20252026, nombre: "2025-2026", estado: "V" },
    { codigo: 20242025, nombre: "2024-2025", estado: "V" },
  ],
  destinos: [
    { codigo: 101, nombre: "Terminal de ejemplo", estado: null },
    { codigo: 102, nombre: "Otra terminal de ejemplo", estado: null },
  ],
};
/**
 * MacroGest simulado: planes de carga ficticios del contrato de ejemplo. La planta del plan ES el
 * estado del cupo (0 disponible, 10 otorgado a cliente, 15 carga propia). Se arma relativo a hoy
 * para que siempre haya disponibles y un vencido sin usar.
 */
function macroInicial(): CupoErp[] {
  const fila = (plan: number, cupo: number, dias: number, planta = 0): CupoErp => ({
    contrato: venta.numero,
    plan,
    cupo,
    codigoTerminal: `COD-DEMO-${plan}-${cupo}`,
    fechaCarga: `${sumarDias(hoy(), dias)}T00:00:00`,
    planta,
    productorPlan: planta === 10 ? 1 : null,
    cargadorPlan: 1,
    producto: venta.producto,
    productoNombre: venta.productoNombre,
    campania: venta.campania,
    destinoNombre: venta.destinoNombre,
    destinoCodigo: venta.destinoCodigo,
    tieneCabecera: true,
    tieneCartaPorte: false,
    tieneDescarga: false,
    ctg: null,
    patenteChasis: null,
    kgCargaErp: null,
    kgDescargaErp: null,
    fechaDescarga: null,
  });
  return [
    fila(1, 1, 1),
    fila(1, 2, 1),
    fila(2, 1, 2),
    fila(2, 2, 2),
    fila(3, 1, -3),
    fila(4, 1, 1, 10),
  ];
}
let solicitudes: Solicitud[] = [],
  pedidos: Pedido[] = [],
  otorgamientos: Otorgamiento[] = [],
  macro: CupoErp[] = macroInicial();
// Lo propio de cada carga (camión y observación), por id de otorgamiento.
const cargas = new Map<string, CargaPropia>();
const historia = new Map<string, Evento[]>();
const comandos = new Map<string, { cuerpo: string; dato: unknown }>();
export function resetLogisticaDemo() {
  solicitudes = [];
  pedidos = [];
  otorgamientos = [];
  macro = macroInicial();
  cargas.clear();
  historia.clear();
  comandos.clear();
}
/** Lo que haría el operador a mano en MacroGest: cambiar planta y productor de un plan entero. */
export function pasarPlanDemo(
  contrato: string,
  plan: number,
  planta: number,
  productor: number | null,
) {
  macro = macro.map((c) =>
    c.contrato === contrato && c.plan === plan ? { ...c, planta, productorPlan: productor } : c,
  );
}
/** Lo que registra MacroGest cuando se emite la carta de porte de un cupo. */
export function cargarDemo(clave: ClaveCupo) {
  macro = macro.map((c) =>
    mismaClave(c, clave)
      ? {
          ...c,
          tieneCartaPorte: true,
          ctg: "CTG-DEMO",
          patenteChasis: "AA001ZZ",
          kgCargaErp: "30000",
        }
      : c,
  );
}
/** Lo que registra MacroGest cuando el puerto descarga un cupo (o nada, si lo rechaza). */
export function descargarDemo(clave: ClaveCupo, kg: number | null) {
  macro = macro.map((c) =>
    mismaClave(c, clave) ? { ...c, tieneDescarga: kg !== null, kgDescargaErp: kg } : c,
  );
}
const mismaClave = (a: ClaveCupo, b: ClaveCupo) =>
  a.contrato === b.contrato && a.plan === b.plan && a.cupo === b.cupo;
const diaCarga = (c: CupoErp) => (c.fechaCarga ?? "").slice(0, 10);
const campaniaTexto = (c: number | null) =>
  c ? `${Math.floor(c / 10000)}-${String(c % 10000).padStart(4, "0")}` : null;
const nombreCliente = (numero: number | null) =>
  catalogos.clientes.find((c) => c.codigo === numero)?.nombre ?? null;
const vigentes = () => otorgamientos.filter((o) => !o.vigenteHasta);
const conCliente = (o: Otorgamiento): Otorgamiento => ({
  ...o,
  clienteNombre: nombreCliente(o.clienteNumero),
});
/** Mismas reglas que el servicio: el estado se recalcula leyendo MacroGest en cada consulta. */
function estado(o: Otorgamiento): OtorgamientoConEstado {
  const erp = macro.find((c) => mismaClave(c, o)) ?? null;
  const fila = (e: EstadoOtorgamiento, detalle: string): OtorgamientoConEstado => ({
    otorgamiento: conCliente(o),
    estado: e,
    detalle,
    erp,
    productorPlanNombre: nombreCliente(erp?.productorPlan ?? null),
  });
  const propio = o.destinatarioTipo === "propio";
  if (o.vigenteHasta)
    return fila(
      "deshecho",
      erp && erp.planta !== 0
        ? `Deshecho en la app; en MacroGest sigue en planta ${erp.planta}: volvelo a planta 0.`
        : "Deshecho en la app.",
    );
  if (!erp) return fila("no_esta", "El cupo ya no está en MacroGest.");
  if (erp.planta === 0)
    return fila(
      "pendiente",
      `Falta pasarlo en MacroGest: ${propio ? "planta 15" : `productor ${o.clienteNumero} y planta 10`}.`,
    );
  if (propio)
    return erp.planta === 15
      ? fila("confirmado", "MacroGest lo tiene en planta 15.")
      : fila("otra_planta", `MacroGest lo tiene en planta ${erp.planta}; se esperaba planta 15.`);
  if (erp.planta !== 10)
    return fila(
      "otra_planta",
      `MacroGest lo tiene en planta ${erp.planta}; se esperaba planta 10.`,
    );
  return erp.productorPlan === o.clienteNumero
    ? fila("confirmado", "MacroGest lo tiene otorgado a este productor.")
    : fila(
        "otro_productor",
        `MacroGest lo tiene otorgado al productor ${erp.productorPlan ?? "(vacío)"}, no al ${o.clienteNumero}.`,
      );
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
/** Mismo cálculo que el servicio: descarga de sus cupos en MacroGest contra lo contratado. */
function conDescarga(p: Preventa): Preventa {
  const kgDescargados = vigentes()
    .filter((o) => o.preventa?.numero === p.numero && o.preventa.operacion === p.operacion)
    .reduce(
      (total, o) => total + Number(macro.find((c) => mismaClave(c, o))?.kgDescargaErp ?? 0),
      0,
    );
  return {
    ...p,
    kgDescargados,
    cumplida: (p.kgContratados ?? 0) > 0 && kgDescargados >= (p.kgContratados ?? 0),
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
export const logisticaHandlers = [
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
  // Resumen de MacroGest: disponibles de hoy en adelante por cereal, plantas y vencidos sin usar.
  http.get(`${API}/cupos/disponibles`, ({ request }) => {
    const url = new URL(request.url);
    const producto = url.searchParams.get("producto");
    const campania = url.searchParams.get("campania");
    const filtrados = macro.filter(
      (c) =>
        (!producto || c.producto === Number(producto)) &&
        (!campania || c.campania === Number(campania)),
    );
    const desdeHoy = filtrados.filter((c) => diaCarga(c) >= hoy());
    const disponibles = desdeHoy.filter((c) => c.planta === 0);
    const porPlanta = [...new Set(desdeHoy.map((c) => c.planta))].map((planta) => ({
      planta,
      cupos: desdeHoy.filter((c) => c.planta === planta).length,
      conCartaPorte: desdeHoy.filter((c) => c.planta === planta && c.tieneCartaPorte).length,
    }));
    return HttpResponse.json({
      porCereal: disponibles.length
        ? [
            {
              producto: venta.producto,
              productoNombre: venta.productoNombre,
              campania: venta.campania,
              cupos: disponibles.length,
            },
          ]
        : [],
      porPlanta,
      vencidosSinUsar: filtrados.filter(
        (c) => c.planta === 0 && diaCarga(c) < hoy() && !c.tieneCartaPorte,
      ).length,
      desde: hoy(),
      kgPorCupo: 30000,
      datosAl: new Date().toISOString(),
    });
  }),
  // Planta 0 uno por uno: disponibles (de hoy en adelante) o vencidos sin carta de porte.
  http.get(`${API}/cupos/planta-0`, ({ request }) => {
    const url = new URL(request.url);
    const vencidos = url.searchParams.get("vencidos") === "true";
    const producto = url.searchParams.get("producto");
    const campania = url.searchParams.get("campania");
    const contrato = url.searchParams.get("contrato");
    const despues = url.searchParams.get("despuesFecha");
    const clave = (c: CupoErp) =>
      `${diaCarga(c)}|${c.contrato}|${String(c.plan).padStart(8, "0")}|${String(c.cupo).padStart(3, "0")}`;
    const cursor = despues
      ? `${despues.slice(0, 10)}|${url.searchParams.get("despuesContrato")}|${String(url.searchParams.get("despuesPlan")).padStart(8, "0")}|${String(url.searchParams.get("despuesCupo")).padStart(3, "0")}`
      : null;
    const filas = macro
      .filter(
        (c) =>
          c.planta === 0 &&
          (vencidos ? diaCarga(c) < hoy() && !c.tieneCartaPorte : diaCarga(c) >= hoy()) &&
          (!producto || c.producto === Number(producto)) &&
          (!campania || c.campania === Number(campania)) &&
          (!contrato || c.contrato === contrato) &&
          (!cursor || clave(c) > cursor),
      )
      .sort((a, b) => clave(a).localeCompare(clave(b)))
      .map(
        (c): CupoPlanta0 => ({
          contrato: c.contrato,
          plan: c.plan,
          cupo: c.cupo,
          codigoTerminal: c.codigoTerminal,
          fechaCarga: diaCarga(c),
          producto: c.producto,
          productoNombre: c.productoNombre,
          campania: campaniaTexto(c.campania),
          destinoCodigo: c.destinoCodigo,
          destinoNombre: c.destinoNombre,
          otorgamientoVigente: (() => {
            const o = vigentes().find((v) => mismaClave(v, c));
            return o ? conCliente(o) : null;
          })(),
        }),
      );
    const n = Math.min(200, Number(url.searchParams.get("tamano") ?? 50));
    return pagina(filas.slice(0, n), filas.length > n);
  }),
  // Plan de Carga ficticio con las mismas reglas que el servicio: titular La Clementina si se carga
  // en planta o es propio; los cupos son los del plan otorgados al mismo destinatario.
  http.get(`${API}/otorgamientos/:id/plan-carga`, ({ params }) => {
    const o = otorgamientos.find((f) => f.id === params.id);
    if (!o) return error(404, "El otorgamiento no existe.");
    if (o.vigenteHasta) return error(409, "El otorgamiento está deshecho: no tiene Plan de Carga.");
    const propio = o.destinatarioTipo === "propio";
    const enPlanta = propio || pedidos.find((p) => p.id === o.pedidoId)?.seCargaEnPlanta === true;
    const mismos = vigentes().filter(
      (x) =>
        x.contrato === o.contrato &&
        x.plan === o.plan &&
        x.destinatarioTipo === o.destinatarioTipo &&
        x.clienteNumero === o.clienteNumero,
    );
    const cupos = macro
      .filter((c) => mismos.some((x) => mismaClave(x, c)))
      .sort((a, b) => a.cupo - b.cupo);
    const ref = (codigo: number, nombre: string, cuit = "30000000001") => ({
      codigo,
      nombre,
      cuit,
    });
    const plan: PlanCarga = {
      contrato: o.contrato,
      plan: o.plan,
      viajes: macro.filter((c) => c.contrato === o.contrato && c.plan === o.plan).length,
      toneladas: 30 * macro.filter((c) => c.contrato === o.contrato && c.plan === o.plan).length,
      fecha: cupos[0] ? diaCarga(cupos[0]) : null,
      cereal: { codigo: venta.producto, nombre: venta.productoNombre },
      campania: venta.campania,
      titular: enPlanta
        ? { codigo: 1, nombre: "La Clementina (ejemplo)" }
        : { codigo: o.clienteNumero, nombre: nombreCliente(o.clienteNumero) },
      numeroEstablecimiento: 12345,
      destino: ref(101, "Terminal de ejemplo"),
      destinoDomicilio: "Calle de ejemplo 100 - (2000) - Localidad de ejemplo - Santa Fe",
      planta: propio
        ? { codigo: 15, nombre: "Planta propia (ejemplo)" }
        : { codigo: 10, nombre: "DIRECTA" },
      destinatario: ref(7, "Comprador de ejemplo"),
      corredorVentaSecundaria: ref(8, "Corredor de ejemplo"),
      mercadoTermino: null,
      corredorVentaPrimaria: ref(8, "Corredor de ejemplo"),
      entregador: ref(45, "Entregador de ejemplo"),
      observaciones: null,
      cupos: cupos.map((c) => ({
        cupo: c.cupo,
        fechaCarga: diaCarga(c),
        codigoOtorgado: c.codigoTerminal,
        cartaPorte: null,
      })),
      destinatarioApp: propio ? "Carga propia" : (nombreCliente(o.clienteNumero) ?? ""),
      datosAl: new Date().toISOString(),
    };
    return HttpResponse.json(plan);
  }),
  // Cargas a puerto: los otorgamientos vigentes con su estado leído de MacroGest y lo propio.
  http.get(`${API}/cargas/camiones`, () => pagina(fichasActivasDemo())),
  http.get(`${API}/cargas/excel`, () =>
    HttpResponse.arrayBuffer(new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="cargas-a-puerto.xlsx"',
      },
    }),
  ),
  http.get(`${API}/cargas`, ({ request }) => {
    const url = new URL(request.url);
    const desde = url.searchParams.get("desde") ?? "";
    const hasta = url.searchParams.get("hastaExclusivo") ?? "9999";
    const filas = vigentes()
      .filter((o) => o.vigenteDesde.slice(0, 10) >= desde && o.vigenteDesde.slice(0, 10) < hasta)
      .map((o): CargaLogistica => {
        const fila = estado(o);
        const erp = fila.erp;
        return {
          otorgamiento: fila,
          estado: ["sin_verificar", "no_esta"].includes(fila.estado)
            ? (fila.estado as "sin_verificar" | "no_esta")
            : erp?.tieneDescarga
              ? "descargado"
              : erp?.tieneCartaPorte
                ? "en_viaje"
                : fila.estado === "confirmado"
                  ? "por_cargar"
                  : fila.estado === "pendiente"
                    ? "falta_pasar"
                    : "revisar",
          cartaPorte: erp?.tieneCartaPorte ? `0101-3574000${erp.cupo}` : null,
          propio: cargas.get(o.id) ?? null,
        };
      });
    const n = Math.min(200, Number(url.searchParams.get("tamano") ?? 50));
    return pagina(filas.slice(0, n), filas.length > n);
  }),
  http.put(`${API}/cargas/:id`, async ({ request, params }) => {
    const body = (await request.json()) as {
      revision: number | null;
      fichaId: string | null;
      versionId: string | null;
      observacion: string | null;
    };
    const o = otorgamientos.find((f) => f.id === params.id);
    if (!o) return error(404, "El otorgamiento no existe.");
    return comando(request, body, () => {
      if (o.vigenteHasta) return error(409, "El otorgamiento está deshecho: no se carga.");
      const anterior = cargas.get(o.id);
      if ((anterior?.revision ?? null) !== body.revision)
        return error(409, "La carga cambió. Actualizá los datos.");
      if ((body.fichaId == null) !== (body.versionId == null))
        return error(400, "Indicá la ficha y su versión, o ninguna.");
      let camion = null;
      if (body.versionId) {
        if (anterior?.camion?.versionId === body.versionId) camion = anterior.camion;
        else {
          const ficha = fichasActivasDemo().find((f) => f.id === body.fichaId);
          const version = versionFlotaDemo(body.versionId);
          if (!ficha || !version || ficha.versionId !== version.id)
            return error(
              409,
              "La ficha del camión cambió o está de baja. Elegí su versión actual.",
            );
          camion = {
            fichaId: ficha.id,
            versionId: version.id,
            revision: version.revision,
            patenteChasis: version.ficha.patenteChasis,
            patenteAcoplado: version.ficha.patenteAcoplado,
            conductor: version.ficha.conductor,
            transportista: version.ficha.transportista,
          };
        }
      }
      const dato: CargaPropia = {
        otorgamientoId: o.id,
        revision: (anterior?.revision ?? 0) + 1,
        camion,
        observacion: body.observacion?.trim() || null,
      };
      cargas.set(o.id, dato);
      registrar("cargas", o.id, dato.revision, "carga_guardada", { anterior, nuevo: dato });
      return dato;
    });
  }),
  // Otorgamientos de la app con su estado leído de MacroGest.
  http.get(`${API}/otorgamientos`, ({ request }) => {
    const url = new URL(request.url);
    const deshechos = url.searchParams.get("deshechos") === "true";
    const pedidoId = url.searchParams.get("pedidoId");
    const desde = url.searchParams.get("desde") ?? "";
    const hasta = url.searchParams.get("hastaExclusivo") ?? "9999";
    const filas = otorgamientos
      .filter(
        (o) =>
          !!o.vigenteHasta === deshechos &&
          (!pedidoId || o.pedidoId === pedidoId) &&
          o.vigenteDesde.slice(0, 10) >= desde &&
          o.vigenteDesde.slice(0, 10) < hasta,
      )
      .map(estado);
    const n = Math.min(200, Number(url.searchParams.get("tamano") ?? 50));
    return pagina(filas.slice(0, n), filas.length > n);
  }),
  // Cola de prioridad de entrega: la demo trae una preventa que arranca hoy, así que cae en
  // "vigentes y próximos" y la cola de vencidas queda vacía.
  http.get(`${API}/preventas/cola`, ({ request }) => {
    const url = new URL(request.url);
    const campania = Number(url.searchParams.get("campania"));
    const vencidas = url.searchParams.get("vencidas") !== "false";
    const producto = url.searchParams.get("producto");
    const arranco = Date.parse(`${preventa.fechaEntregaInicio}T12:00:00Z`) < Date.now();
    const filas =
      campania === preventa.campania &&
      vencidas === arranco &&
      (!producto || Number(producto) === preventa.producto)
        ? [conDescarga(preventa)].filter((p) => !p.cumplida)
        : [];
    return HttpResponse.json({ filas, hayMas: false, datosAl: new Date().toISOString() });
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
        ? [conDescarga(preventa)]
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
  // Los conseguidos se cuentan en el MacroGest simulado: cupos del contrato con fecha de carga
  // en la fecha pedida, en cualquier planta.
  http.get(`${API}/solicitudes-terminal`, ({ request }) =>
    listado(
      solicitudes.map((f) => ({
        ...f,
        conseguidos: macro.filter(
          (c) => c.contrato === f.contratoVenta && diaCarga(c) === f.fechaSolicitada,
        ).length,
      })),
      new URL(request.url),
      (f) => f.fechaSolicitada,
    ),
  ),
  http.get(`${API}/solicitudes-terminal/:id`, ({ params }) => {
    const dato = solicitudes.find((s) => s.id === params.id);
    return dato
      ? HttpResponse.json({ dato, datosAl: new Date().toISOString() })
      : error(404, "La solicitud no existe.");
  }),
  http.get(`${API}/pedidos`, ({ request }) => {
    const url = new URL(request.url);
    return listado(
      filtrosComerciales(pedidos, url)
        .map(pedidoConNombres)
        .filter(
          (p) =>
            (!url.searchParams.has("clienteNumero") ||
              p.clienteNumero === Number(url.searchParams.get("clienteNumero"))) &&
            (url.searchParams.get("soloPendientes") !== "true" || p.pendientes > 0) &&
            (url.searchParams.get("cumplidos") !== "true" || p.pendientes === 0) &&
            (!url.searchParams.get("preventaNumero") ||
              (p.preventa?.numero ?? "").includes(url.searchParams.get("preventaNumero")!)),
        ),
      url,
      (f) => f.fechaSolicitada,
    );
  }),
  http.get(`${API}/:recurso/:id/historial`, ({ params, request }) => {
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
      "id" | "revision" | "producto" | "campania" | "cerradaAl" | "motivoCierre" | "conseguidos"
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
        cerradaAl: null,
        motivoCierre: null,
        conseguidos: null,
      };
      solicitudes.push(dato);
      registrar("solicitudes-terminal", dato.id, 1, "solicitud_creada", dato);
      return dato;
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
        seCargaEnPlanta: body.seCargaEnPlanta ?? false,
      };
      pedidos.push(dato);
      registrar("pedidos", dato.id, 1, "pedido_creado", dato);
      return dato;
    });
  }),
  http.get(`${API}/pedidos/:id`, ({ params }) => {
    const dato = pedidos.find((p) => p.id === params.id);
    return dato
      ? HttpResponse.json({ dato: pedidoConNombres(dato), datosAl: new Date().toISOString() })
      : error(404, "El pedido no existe.");
  }),
  // Eliminar se bloquea con otorgamientos vigentes y dice cuántos; los deshechos quedan sin pedido.
  http.post(`${API}/pedidos/:id/eliminar`, async ({ request, params }) => {
    const body = (await request.json()) as { revision: number };
    const pedido = pedidos.find((p) => p.id === params.id);
    if (!pedido) return error(404, "El pedido no existe.");
    return comando(request, body, () => {
      if (pedido.revision !== body.revision)
        return error(409, "El pedido cambió. Actualizá la revisión.");
      const otorgados = vigentes().filter((o) => o.pedidoId === pedido.id).length;
      if (otorgados > 0)
        return error(
          409,
          `El pedido tiene ${otorgados} ${otorgados === 1 ? "cupo otorgado" : "cupos otorgados"}. Deshacé esos otorgamientos antes de eliminarlo.`,
        );
      otorgamientos.forEach((o) => {
        if (o.pedidoId === pedido.id) o.pedidoId = null;
      });
      pedidos = pedidos.filter((p) => p.id !== pedido.id);
      registrar("pedidos", pedido.id, pedido.revision + 1, "pedido_eliminado", {
        anterior: pedido,
      });
      return { ...pedido, revision: pedido.revision + 1 };
    });
  }),
  http.put(`${API}/pedidos/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Pedido;
    const anterior = pedidos.find((f) => f.id === params.id);
    if (!anterior) return error(404, "Pedido inexistente.");
    return comando(request, body, () => {
      if (anterior.revision !== body.revision)
        return error(409, "El pedido cambió. Actualizá los datos.");
      const otorgados = vigentes().filter((o) => o.pedidoId === anterior.id).length;
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
  http.post(`${API}/otorgamientos`, async ({ request }) => {
    const body = (await request.json()) as OtorgarBody;
    return comando(request, body, () => {
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (
        !uuid.test(request.headers.get("Idempotency-Key") ?? "") ||
        !Array.isArray(body.cupos) ||
        body.cupos.length < 1 ||
        body.cupos.length > 200 ||
        body.cupos.some(
          (c) => !c.contrato || !Number.isInteger(c.plan) || !Number.isInteger(c.cupo),
        ) ||
        body.cupos.some((c, i) => body.cupos.findIndex((d) => mismaClave(c, d)) !== i)
      )
        return error(400, "Elegí de 1 a 200 cupos únicos de MacroGest.");
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
        !catalogos.clientes.some((c) => c.codigo === body.clienteNumero && c.estado === "A")
      )
        return error(400, "Elegí un cliente activo.");
      // Se lee MacroGest en el momento: planta, fecha, cereal y campaña.
      const filas = body.cupos.map((c) => macro.find((m) => mismaClave(m, c)));
      const faltante = body.cupos.find((_, i) => !filas[i]);
      if (faltante)
        return error(
          404,
          `El cupo ${faltante.contrato} plan ${faltante.plan} cupo ${faltante.cupo} no está en MacroGest.`,
        );
      const elegidos = filas as CupoErp[];
      const ocupado = elegidos.find((c) => c.planta !== 0);
      if (ocupado)
        return error(
          409,
          `El cupo ${ocupado.codigoTerminal} ya no está disponible: MacroGest lo tiene en planta ${ocupado.planta}.`,
        );
      const vencido = elegidos.find((c) => diaCarga(c) < hoy());
      if (vencido)
        return error(
          400,
          `El cupo ${vencido.codigoTerminal} está vencido: su fecha de carga ya pasó. Dalo de baja en MacroGest.`,
        );
      const primero = elegidos[0];
      if (elegidos.some((c) => c.producto !== primero.producto || c.campania !== primero.campania))
        return error(400, "Elegí cupos del mismo cereal y campaña.");
      const yaOtorgados = body.cupos.filter((c) => vigentes().some((o) => mismaClave(o, c)));
      if (yaOtorgados.length)
        return error(
          409,
          `Ya se otorgó en la app: ${yaOtorgados.map((c) => `${c.contrato} plan ${c.plan} cupo ${c.cupo}`).join(", ")}. Actualizá los datos.`,
        );
      const pedido = body.pedidoId ? pedidos.find((p) => p.id === body.pedidoId) : null;
      if (body.pedidoId && !pedido) return error(404, "El pedido no existe.");
      if (pedido && pedido.revision !== body.pedidoRevision)
        return error(409, "El pedido cambió. Actualizá los datos y elegí de nuevo.");
      const campania = campaniaTexto(primero.campania);
      if (pedido && (pedido.producto !== primero.producto || pedido.campania !== campania))
        return error(
          400,
          `El cupo no coincide con el pedido: cupo ${primero.productoNombre} ${campania} · pedido ${pedido.productoNombre ?? pedido.producto} ${pedido.campania}.`,
        );
      if (pedido && elegidos.length > pedido.pendientes)
        return error(
          409,
          `Elegiste ${elegidos.length} cupos y al pedido le faltan ${pedido.pendientes}.`,
        );
      if (pedido && pedido.clienteNumero !== body.clienteNumero)
        return error(400, "El cliente o la preventa no coinciden con el pedido.");
      const ref = body.preventa ?? pedido?.preventa ?? null;
      if (ref && (ref.numero !== preventa.numero || ref.operacion !== preventa.operacion))
        return error(404, "La preventa no existe.");
      if (
        ref &&
        (preventa.clienteNumero !== body.clienteNumero ||
          preventa.producto !== primero.producto ||
          preventa.campania !== primero.campania)
      )
        return error(400, "La preventa no corresponde al cliente, cereal y campaña.");
      const advertencias: string[] = [];
      for (const plan of new Set(body.cupos.map((c) => `${c.contrato}|${c.plan}`))) {
        const [contrato, numero] = plan.split("|");
        const delPlan = (o: ClaveCupo) => o.contrato === contrato && o.plan === Number(numero);
        const otros = vigentes().filter(
          (o) =>
            delPlan(o) &&
            (o.destinatarioTipo !== body.destinatarioTipo ||
              o.clienteNumero !== (body.clienteNumero ?? null)),
        );
        if (otros.length)
          advertencias.push(
            `El plan ${numero} del contrato ${contrato} ya tiene ${otros.length} cupo(s) otorgados a otro destinatario. En MacroGest un plan va a un solo cliente: hay que partirlo.`,
          );
        const libres = macro.filter(
          (c) =>
            delPlan(c) &&
            c.planta === 0 &&
            !body.cupos.some((e) => mismaClave(e, c)) &&
            !vigentes().some((o) => mismaClave(o, c)),
        ).length;
        if (libres)
          advertencias.push(
            `El plan ${numero} del contrato ${contrato} tiene ${libres} cupo(s) más sin otorgar. Al pasarlo de planta en MacroGest se van todos al mismo destinatario, salvo que partas el plan.`,
          );
      }
      if (new Set(elegidos.map(diaCarga)).size > 1)
        advertencias.push("Los cupos tienen fechas de carga distintas.");
      if (pedido && elegidos.some((c) => diaCarga(c) !== pedido.fechaSolicitada))
        advertencias.push(
          "Hay cupos con fecha de carga distinta de la fecha solicitada del pedido.",
        );
      const vigenteDesde = new Date().toISOString();
      const nuevos: Otorgamiento[] = body.cupos.map((c) => ({
        id: crypto.randomUUID(),
        revision: 1,
        contrato: c.contrato,
        plan: c.plan,
        cupo: c.cupo,
        pedidoId: pedido?.id ?? null,
        destinatarioTipo: body.destinatarioTipo,
        clienteNumero: body.clienteNumero ?? null,
        preventa: ref,
        vigenteDesde,
        vigenteHasta: null,
        motivoDeshecho: null,
      }));
      otorgamientos.push(...nuevos);
      nuevos.forEach((o) =>
        registrar("otorgamientos", o.id, 1, "otorgamiento_creado", { otorgamiento: o }),
      );
      if (pedido) {
        pedido.revision++;
        pedido.otorgados += nuevos.length;
        pedido.pendientes = pedido.cantidadCupos - pedido.otorgados;
        pedido.estado = pedido.pendientes === 0 ? "atendido" : "parcial";
        registrar("pedidos", pedido.id, pedido.revision, "cupos_otorgados", {
          pedidoId: pedido.id,
          otorgamientos: nuevos.map((o) => ({
            id: o.id,
            contrato: o.contrato,
            plan: o.plan,
            cupo: o.cupo,
          })),
          otorgados: pedido.otorgados,
          pendientes: pedido.pendientes,
        });
      }
      return {
        otorgamientos: nuevos,
        pedido: pedido ? { ...pedido } : null,
        advertencias,
      } satisfies OtorgarResultado;
    });
  }),
  http.post(`${API}/otorgamientos/:id/deshacer`, async ({ request, params }) => {
    const body = (await request.json()) as { revision: number; motivo: string };
    const o = otorgamientos.find((f) => f.id === params.id);
    if (!o) return error(404, "El otorgamiento no existe.");
    if (!body.motivo?.trim()) return error(400, "Indicá la revisión actual y el motivo.");
    return comando(request, body, () => {
      if (o.revision !== body.revision)
        return error(409, "El otorgamiento cambió. Actualizá los datos.");
      if (o.vigenteHasta) return error(409, "El otorgamiento ya estaba deshecho.");
      o.revision++;
      o.vigenteHasta = new Date().toISOString();
      o.motivoDeshecho = body.motivo.trim();
      registrar(
        "otorgamientos",
        o.id,
        o.revision,
        "otorgamiento_deshecho",
        { otorgamiento: o },
        o.motivoDeshecho,
      );
      const pedido = o.pedidoId ? pedidos.find((p) => p.id === o.pedidoId) : null;
      if (pedido) {
        pedido.revision++;
        pedido.otorgados--;
        pedido.pendientes = pedido.cantidadCupos - pedido.otorgados;
        pedido.estado = pedido.otorgados === 0 ? "pendiente" : "parcial";
        registrar(
          "pedidos",
          pedido.id,
          pedido.revision,
          "otorgamiento_deshecho",
          {
            contrato: o.contrato,
            plan: o.plan,
            cupo: o.cupo,
            otorgados: pedido.otorgados,
            pendientes: pedido.pendientes,
          },
          o.motivoDeshecho,
        );
      }
      const erp = macro.find((c) => mismaClave(c, o));
      return {
        otorgamiento: { ...o },
        pedido: pedido ? { ...pedido } : null,
        advertencias:
          erp && erp.planta !== 0
            ? [
                `En MacroGest el plan ${erp.plan} del contrato ${erp.contrato} sigue en planta ${erp.planta}: volvelo a planta 0 a mano.`,
              ]
            : [],
      } satisfies DeshacerResultado;
    });
  }),
];
