import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";
import { hoy, sumarDias } from "@/features/logistica/format";
import { fichasActivasDemo, versionFlotaDemo } from "./logistica-flota";
import type {
  CargaLogistica,
  CargaPropia,
  ContratoVentaSeguimiento,
  GuardarCargaBody,
  ClaveCupo,
  CupoErp,
  CupoPlan,
  DeshacerResultado,
  Evento,
  Pedido,
  Preventa,
  Referencia,
  Solicitud,
  Venta,
  OtorgarBody,
  Otorgamiento,
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
  estadoEntrega: "P",
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
 * MacroGest simulado: planes de carga ficticios del contrato de ejemplo, relativos a hoy. Planta y
 * productor son los del plan (10, carga directa del cliente; 15, la planta). En la app sólo se
 * vinculan con un pedido.
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
// Lo propio de cada carga (camión, estado, humedad, calidad, observación), por clave del cupo.
const cargas = new Map<string, CargaPropia>();
const claveTexto = (c: ClaveCupo) => `${c.contrato}|${c.plan}|${c.cupo}`;
/** Como el servicio: MacroGest adelanta el estado del ciclo, nunca lo atrasa ni pisa excepciones. */
const CICLO = [
  "DISPONIBLE",
  "AUTORIZADO",
  "LLAMADO",
  "CARGANDO",
  "EN VIAJE",
  "CALADO",
  "DESCARGADO",
];
const ESTADOS = [
  ...CICLO,
  "RECHAZADO",
  "DESVIADO",
  "ACONDICIONADORA",
  "NO LO USÓ",
  "PERDIDO POR HORARIO",
  "NO SE CONSIGUIÓ CAMIÓN",
  "DADO DE BAJA",
  "PENDIENTE PASAR CUPO",
];
function estadoEfectivo(manual: string | null, sugerido: string) {
  if (!manual) return sugerido;
  const m = CICLO.indexOf(manual);
  return m >= 0 && CICLO.indexOf(sugerido) > m ? sugerido : manual;
}
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
/**
 * Lo que hace César en MacroGest al armar el plan del cliente: un plan nuevo del contrato de
 * ejemplo con esos códigos, la planta y el productor. Devuelve el número de plan.
 */
export function armarPlanDemo(
  codigos: string[],
  planta: number,
  productor: number | null,
  fechaCarga = sumarDias(hoy(), 1),
) {
  const plan =
    Math.max(0, ...macro.filter((c) => c.contrato === venta.numero).map((c) => c.plan)) + 1;
  macro = [
    ...macro,
    ...codigos.map(
      (codigo, i): CupoErp => ({
        contrato: venta.numero,
        plan,
        cupo: i + 1,
        codigoTerminal: codigo,
        fechaCarga: `${fechaCarga}T00:00:00`,
        planta,
        productorPlan: productor,
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
      }),
    ),
  ];
  return plan;
}
const mismaClave = (a: ClaveCupo, b: ClaveCupo) =>
  a.contrato === b.contrato && a.plan === b.plan && a.cupo === b.cupo;
const diaCarga = (c: CupoErp) => (c.fechaCarga ?? "").slice(0, 10);
const campaniaTexto = (c: number | null) =>
  c ? `${Math.floor(c / 10000)}-${String(c % 10000).padStart(4, "0")}` : null;
const nombreCliente = (numero: number | null) =>
  catalogos.clientes.find((c) => c.codigo === numero)?.nombre ?? null;
const vigentes = () => otorgamientos.filter((o) => !o.vigenteHasta);
/** El vínculo vigente de un cupo de MacroGest con un pedido, por su clave. */
const vinculoDe = (c: ClaveCupo) => vigentes().find((o) => mismaClave(o, c)) ?? null;
const conCliente = (o: Otorgamiento): Otorgamiento => ({
  ...o,
  clienteNombre: nombreCliente(o.clienteNumero),
});
/** Nombre de la planta del plan, como sale de `sectores_plantas`. */
const nombrePlanta = (planta: number | null) =>
  planta === 15
    ? "LA CLEMENTINA S.A."
    : planta === 10
      ? "DIRECTA"
      : `PLANTA ${planta ?? ""}`.trim();
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
    registradoPorNombre: "Operador de demostración",
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
    .reduce((total, o) => {
      const erp = macro.find((c) => mismaClave(c, o));
      return total + (erp?.tieneDescarga ? Number(erp.kgDescargaErp ?? 0) : 0);
    }, 0);
  // Como el servicio: cada pedido descuenta su total de la preventa (cupos × 30.000 kg).
  const deLaPreventa = (r: { numero: string; operacion: string } | null) =>
    r?.numero === p.numero && r.operacion === p.operacion;
  const cuposPedidos = pedidos
    .filter((x) => deLaPreventa(x.preventa))
    .reduce((t, x) => t + x.cantidadCupos, 0);
  const kgSaldo = (p.kgContratados ?? 0) - cuposPedidos * 30000;
  return {
    ...p,
    kgDescargados,
    cumplida: (p.kgContratados ?? 0) > 0 && kgDescargados >= (p.kgContratados ?? 0),
    cuposPedidos,
    cuposOtorgados: vigentes().filter((o) => deLaPreventa(o.preventa)).length,
    kgSaldo,
    cuposFaltan: kgSaldo > 0 ? Math.ceil(kgSaldo / 30000) : 0,
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
  // Cupos: los de los planes de carga de MacroGest simulados, del día de carga más nuevo al más
  // viejo, con el pedido vinculado en la app.
  http.get(`${API}/cupos`, ({ request }) => {
    const url = new URL(request.url);
    const desde = url.searchParams.get("desde") ?? "";
    const hasta = url.searchParams.get("hastaExclusivo") ?? "9999";
    const producto = url.searchParams.get("producto");
    const campania = url.searchParams.get("campania");
    const contrato = url.searchParams.get("contrato");
    const todos = macro
      .filter(
        (c) =>
          c.tieneCabecera &&
          diaCarga(c) >= desde &&
          diaCarga(c) < hasta &&
          (!producto || c.producto === Number(producto)) &&
          (!campania || campaniaTexto(c.campania) === campania) &&
          (!contrato || c.contrato === contrato),
      )
      .sort(
        (a, b) =>
          diaCarga(b).localeCompare(diaCarga(a)) ||
          a.contrato.localeCompare(b.contrato) ||
          a.plan - b.plan ||
          a.cupo - b.cupo,
      );
    const despues = url.searchParams.get("despuesFecha");
    const cursor = despues
      ? `${url.searchParams.get("despuesContrato")}|${url.searchParams.get("despuesPlan")}|${url.searchParams.get("despuesCupo")}`
      : null;
    const desdeIndice = cursor
      ? todos.findIndex((c) => diaCarga(c) === despues && claveTexto(c) === cursor) + 1
      : 0;
    const filas = todos.slice(desdeIndice).map(
      (c): CupoPlan => ({
        contrato: c.contrato,
        plan: c.plan,
        cupo: c.cupo,
        codigo: c.codigoTerminal?.trim() || null,
        fechaCarga: diaCarga(c),
        producto: c.producto,
        productoNombre: c.productoNombre,
        campania: campaniaTexto(c.campania),
        destinoCodigo: c.destinoCodigo,
        destinoNombre: c.destinoNombre,
        planta: c.planta,
        productorNumero: c.productorPlan,
        productorNombre: nombreCliente(c.productorPlan),
        otorgamiento: vinculoDe(c) ? conCliente(vinculoDe(c)!) : null,
      }),
    );
    const n = Math.min(200, Number(url.searchParams.get("tamano") ?? 50));
    return pagina(filas.slice(0, n), filas.length > n);
  }),
  // Plan de Carga ficticio con las mismas reglas que el servicio: sale del plan de carga de
  // MacroGest; titular La Clementina si se carga en planta; los cupos son los de ese plan vinculados
  // al mismo cliente.
  http.get(`${API}/otorgamientos/:id/plan-carga`, ({ params }) => {
    const o = otorgamientos.find((f) => f.id === params.id);
    if (!o) return error(404, "El vínculo no existe.");
    if (o.vigenteHasta)
      return error(409, "El cupo ya no está vinculado a este pedido: no tiene Plan de Carga.");
    const delPlan = macro.filter((c) => c.contrato === o.contrato && c.plan === o.plan);
    const propio = delPlan[0];
    if (!propio) return error(404, "El plan de carga ya no está en MacroGest.");
    const enPlanta = pedidos.find((p) => p.id === o.pedidoId)?.seCargaEnPlanta === true;
    const cupos = vigentes()
      .filter(
        (x) =>
          x.contrato === o.contrato && x.plan === o.plan && x.clienteNumero === o.clienteNumero,
      )
      .map((x) => macro.find((c) => mismaClave(c, x)))
      .filter((x): x is CupoErp => !!x)
      .sort((a, b) => a.cupo - b.cupo);
    const ref = (codigo: number, nombre: string, cuit = "30000000001") => ({
      codigo,
      nombre,
      cuit,
    });
    const plan: PlanCarga = {
      contrato: o.contrato,
      plan: propio.plan,
      viajes: delPlan.length,
      toneladas: 30 * delPlan.length,
      fecha: cupos[0] ? diaCarga(cupos[0]) : null,
      cereal: { codigo: venta.producto, nombre: venta.productoNombre },
      campania: venta.campania,
      titular: enPlanta
        ? { codigo: 1, nombre: "La Clementina (ejemplo)" }
        : { codigo: o.clienteNumero, nombre: nombreCliente(o.clienteNumero) },
      numeroEstablecimiento: 12345,
      destino: ref(101, "Terminal de ejemplo"),
      destinoDomicilio: "Calle de ejemplo 100 - (2000) - Localidad de ejemplo - Santa Fe",
      planta: { codigo: propio.planta, nombre: nombrePlanta(propio.planta) },
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
      destinatarioApp: nombreCliente(o.clienteNumero) ?? "",
      datosAl: new Date().toISOString(),
    };
    return HttpResponse.json(plan);
  }),
  // Cargas a puerto: cada cupo de MacroGest en planta 10 o 15, con lo propio por cupo.
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
    const producto = url.searchParams.get("producto");
    const campania = url.searchParams.get("campania");
    const contrato = url.searchParams.get("contrato");
    const productor = url.searchParams.get("productorNumero");
    const planta = url.searchParams.get("planta");
    const filas = macro
      .filter(
        (c) =>
          (c.planta === 10 || c.planta === 15) &&
          diaCarga(c) >= desde &&
          diaCarga(c) < hasta &&
          (!planta || c.planta === Number(planta)) &&
          (!producto || c.producto === Number(producto)) &&
          (!campania || campaniaTexto(c.campania) === campania) &&
          (!contrato || c.contrato === contrato) &&
          (!productor || c.productorPlan === Number(productor)),
      )
      .map((c): CargaLogistica => {
        const propio = cargas.get(claveTexto(c)) ?? null;
        const sugerido = c.tieneDescarga
          ? "DESCARGADO"
          : c.tieneCartaPorte
            ? "EN VIAJE"
            : "DISPONIBLE";
        const kgCarga = c.tieneCartaPorte && c.kgCargaErp != null ? Number(c.kgCargaErp) : null;
        const kgDescarga =
          c.tieneDescarga && c.kgDescargaErp != null ? Number(c.kgDescargaErp) : null;
        const enPlanta = c.planta === 15;
        return {
          contrato: c.contrato,
          plan: c.plan,
          cupo: c.cupo,
          fechaCarga: diaCarga(c),
          producto: c.producto,
          productoNombre: c.productoNombre,
          campania: campaniaTexto(c.campania),
          planta: c.planta,
          cargaEn: enPlanta ? "PLANTA" : "DIRECTO",
          productorNumero: c.productorPlan,
          cargo: enPlanta
            ? "SE CARGÓ EN PLANTA"
            : (nombreCliente(c.productorPlan) ??
              (c.productorPlan ? `Cliente ${c.productorPlan}` : null)),
          codigoOtorgado: c.codigoTerminal,
          destinoCodigo: c.destinoCodigo,
          puerto: c.destinoNombre,
          cartaPorte: c.tieneCartaPorte ? `0101-3574000${c.cupo}` : null,
          ctg: c.tieneCartaPorte ? (c.ctg ?? null) : null,
          patente: c.tieneCartaPorte ? (c.patenteChasis ?? null) : null,
          kgCarga,
          kgDescarga,
          difKilos: kgCarga != null && kgDescarga != null ? kgDescarga - kgCarga : null,
          fechaDescarga: null,
          estadoSugerido: sugerido,
          estado: estadoEfectivo(propio?.estado ?? null, sugerido),
          propio,
          otorgamientoId: vinculoDe(c)?.id ?? null,
        };
      })
      .sort(
        (a, b) =>
          (b.fechaCarga ?? "").localeCompare(a.fechaCarga ?? "") ||
          claveTexto(a).localeCompare(claveTexto(b)),
      );
    const n = Math.min(200, Number(url.searchParams.get("tamano") ?? 50));
    return pagina(filas.slice(0, n), filas.length > n);
  }),
  http.put(`${API}/cargas`, async ({ request }) => {
    const body = (await request.json()) as GuardarCargaBody;
    const c = macro.find((m) => mismaClave(m, body));
    if (!c) return error(404, "El cupo no está en MacroGest.");
    return comando(request, body, () => {
      if (c.planta !== 10 && c.planta !== 15)
        return error(409, `El cupo está en planta ${c.planta}: todavía no se otorgó.`);
      const anterior = cargas.get(claveTexto(c));
      if ((anterior?.revision ?? null) !== body.revision)
        return error(409, "La carga cambió. Actualizá los datos.");
      if ((body.fichaId == null) !== (body.versionId == null))
        return error(400, "Indicá la ficha y su versión, o ninguna.");
      if (body.estado && !ESTADOS.includes(body.estado)) return error(400, "Estado inválido.");
      if (body.humedad != null && (body.humedad < 0 || body.humedad > 100))
        return error(400, "La humedad va de 0 a 100.");
      let camion = null;
      if (body.versionId) {
        if (anterior?.camion?.versionId === body.versionId) camion = anterior?.camion ?? null;
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
            importeReferencia: version.ficha.importeReferencia
              ? Number(version.ficha.importeReferencia)
              : null,
            moneda: version.ficha.moneda,
          };
        }
      }
      const dato: CargaPropia = {
        id: anterior?.id ?? crypto.randomUUID(),
        revision: (anterior?.revision ?? 0) + 1,
        camion,
        estado: body.estado ?? null,
        humedad: body.humedad ?? null,
        obsCalidad: body.obsCalidad?.trim() || null,
        observacion: body.observacion?.trim() || null,
      };
      cargas.set(claveTexto(c), dato);
      registrar("cargas", dato.id, dato.revision, "carga_guardada", { anterior, nuevo: dato });
      return dato;
    });
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
  // Los conseguidos son los cupos cargados en MacroGest para el contrato y la fecha pedida.
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
  // Seguimiento de contratos de venta, con las reglas del servicio: entregado = kilos cargados del
  // MacroGest simulado; primero los vencidos con saldo, después los vigentes, al final el resto.
  http.get(`${API}/contratos/seguimiento`, ({ request }) => {
    const url = new URL(request.url);
    const desde = url.searchParams.get("desde") ?? "";
    const hasta = url.searchParams.get("hastaExclusivo") ?? "9999";
    const producto = url.searchParams.get("producto");
    const campania = url.searchParams.get("campania");
    const buscar = (url.searchParams.get("buscar") ?? "").toLowerCase();
    const despues = Number(url.searchParams.get("despues") ?? 0);
    const cargado = (numero: string) =>
      macro.filter((c) => c.contrato === numero && c.tieneCartaPorte && c.kgCargaErp != null);
    const contratos = [
      {
        numero: venta.numero,
        comprador: venta.compradorNombre,
        contratado: 300000,
        desde: venta.fechaEntrega,
        hasta: venta.fechaEntrega1,
      },
      // Un contrato ficticio vencido con saldo, para ver el orden.
      {
        numero: "V-DEMO/2",
        comprador: "Otro comprador de ejemplo",
        contratado: 150000,
        desde: sumarDias(hoy(), -40),
        hasta: sumarDias(hoy(), -10),
      },
    ];
    const filas = contratos
      .filter(
        (c) =>
          (c.hasta ?? "") >= desde &&
          (c.hasta ?? "") < hasta &&
          (!producto || Number(producto) === venta.producto) &&
          (!campania || campania === campaniaTexto(venta.campania)) &&
          `${c.numero} ${c.comprador}`.toLowerCase().includes(buscar),
      )
      .map((c) => {
        const cargas = cargado(c.numero);
        const entregado = cargas.reduce((t, x) => t + Number(x.kgCargaErp), 0);
        const saldo = c.contratado - entregado;
        const vencido = !!c.hasta && c.hasta < hoy();
        const [grupo, estado]: [number, ContratoVentaSeguimiento["estado"]] =
          saldo > 0
            ? vencido
              ? [0, "Vencido, falta entregar"]
              : [1, "Vigente"]
            : saldo < 0
              ? [2, vencido ? "Vencido, entregado de más" : "Entregado de más"]
              : [2, "Cumplido"];
        const fila: ContratoVentaSeguimiento = {
          posicion: 0,
          numero: c.numero,
          compradorNumero: null,
          compradorNombre: c.comprador,
          producto: venta.producto,
          productoNombre: venta.productoNombre,
          campania: campaniaTexto(venta.campania),
          entregaDesde: c.desde,
          entregaHasta: c.hasta,
          contratado: c.contratado,
          entregado,
          camiones: cargas.length,
          saldo,
          cuposFaltan: saldo > 0 ? Math.ceil(saldo / 30000) : 0,
          estado,
        };
        return { grupo, fila };
      })
      .sort(
        (a, b) =>
          a.grupo - b.grupo ||
          (a.fila.entregaHasta ?? "").localeCompare(b.fila.entregaHasta ?? "") ||
          a.fila.numero.localeCompare(b.fila.numero),
      )
      .map((x, i) => ({ ...x.fila, posicion: i + 1 }))
      .filter((x) => x.posicion > despues);
    const n = Math.min(200, Number(url.searchParams.get("tamano") ?? 50));
    return pagina(filas.slice(0, n), filas.length > n);
  }),
  http.get(`${API}/solicitudes-terminal/:id`, ({ params }) => {
    const dato = solicitudes.find((s) => s.id === params.id);
    return dato
      ? HttpResponse.json({ dato, datosAl: new Date().toISOString() })
      : error(404, "La solicitud no existe.");
  }),
  http.get(`${API}/pedidos`, ({ request }) => {
    const url = new URL(request.url);
    const filas = filtrosComerciales(pedidos, url)
      .map(pedidoConNombres)
      .map((p) => ({
        ...p,
        preventaEntregaHasta:
          p.preventa?.numero === preventa.numero ? preventa.fechaEntregaFin : null,
      }));
    // Por prioridad: una sola página, primero lo que se debe hace más tiempo (como el servicio).
    if (url.searchParams.get("orden") === "prioridad") {
      const desde = url.searchParams.get("desde") ?? "";
      const hasta = url.searchParams.get("hastaExclusivo") ?? "";
      const todos = filas
        .filter(
          (p) =>
            // Los pendientes se piden sin período al vincular cupos, como en el servicio.
            (!hasta || (p.fechaSolicitada >= desde && p.fechaSolicitada < hasta)) &&
            (url.searchParams.get("soloPendientes") !== "true" || p.pendientes > 0) &&
            (url.searchParams.get("cumplidos") !== "true" || p.pendientes === 0),
        )
        .sort(
          (a, b) =>
            Number(!a.preventaEntregaHasta) - Number(!b.preventaEntregaHasta) ||
            (a.preventaEntregaHasta ?? "").localeCompare(b.preventaEntregaHasta ?? "") ||
            a.fechaSolicitada.localeCompare(b.fechaSolicitada) ||
            a.id.localeCompare(b.id),
        );
      return pagina(todos.slice(0, 200), todos.length > 200);
    }
    return listado(
      filas.filter(
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
        creadoAl: new Date().toISOString(),
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
  // Eliminar se bloquea con otorgamientos vigentes y dice cuántos; los deshechos se van con él.
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
          `El pedido tiene ${otorgados} ${otorgados === 1 ? "cupo otorgado" : "cupos otorgados"}. Desvinculá esos cupos en Cupos antes de eliminarlo.`,
        );
      otorgamientos = otorgamientos.filter((o) => o.pedidoId !== pedido.id);
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
  // Vincular cupos de MacroGest con un pedido, con las reglas del servicio.
  http.post(`${API}/otorgamientos`, async ({ request }) => {
    const body = (await request.json()) as OtorgarBody;
    return comando(request, body, () => {
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const claves = Array.isArray(body.cupos) ? body.cupos.map(claveTexto) : [];
      if (
        !uuid.test(request.headers.get("Idempotency-Key") ?? "") ||
        claves.length < 1 ||
        claves.length > 200 ||
        new Set(claves).size !== claves.length
      )
        return error(400, "Revisá los campos obligatorios, formatos y límites de la operación.");
      if (!body.pedidoId || !(body.pedidoRevision > 0))
        return error(400, "Elegí el pedido al que van los cupos.");
      const filas = body.cupos.map((c) => macro.find((m) => mismaClave(m, c) && m.tieneCabecera));
      const falta = body.cupos.find((_, i) => !filas[i]);
      if (falta)
        return error(
          404,
          `El cupo ${falta.contrato} plan ${falta.plan} cupo ${falta.cupo} no está en un plan de carga de MacroGest. Actualizá los datos.`,
        );
      const cupos = filas as CupoErp[];
      const primero = cupos[0];
      if (cupos.some((c) => c.producto !== primero.producto || c.campania !== primero.campania))
        return error(400, "Elegí cupos del mismo cereal y campaña.");
      const pedido = pedidos.find((p) => p.id === body.pedidoId);
      if (!pedido) return error(404, "El pedido no existe.");
      if (pedido.revision !== body.pedidoRevision)
        return error(409, "El pedido cambió. Actualizá los datos y elegí de nuevo.");
      const campania = campaniaTexto(primero.campania);
      if (pedido.producto !== primero.producto || pedido.campania !== campania)
        return error(
          400,
          `El cupo no coincide con el pedido: cupo ${primero.productoNombre} ${campania} · pedido ${pedido.productoNombre ?? pedido.producto} ${pedido.campania}.`,
        );
      if (cupos.length > pedido.pendientes)
        return error(
          409,
          `Elegiste ${cupos.length} cupos y al pedido le faltan ${pedido.pendientes}.`,
        );
      const ref = pedido.preventa;
      if (ref && (ref.numero !== preventa.numero || ref.operacion !== preventa.operacion))
        return error(404, "La preventa no existe en MacroGest.");
      const ocupados = cupos.filter((c) => vinculoDe(c));
      if (ocupados.length)
        return error(
          409,
          `Ya está vinculado a un pedido: ${ocupados.map((c) => c.codigoTerminal ?? `${c.contrato} plan ${c.plan} cupo ${c.cupo}`).join(", ")}. Actualizá los datos.`,
        );
      const vigenteDesde = new Date().toISOString();
      const nuevos: Otorgamiento[] = cupos.map((c) => ({
        id: crypto.randomUUID(),
        revision: 1,
        contrato: c.contrato,
        plan: c.plan,
        cupo: c.cupo,
        pedidoId: pedido.id,
        clienteNumero: pedido.clienteNumero,
        preventa: ref,
        vigenteDesde,
        vigenteHasta: null,
        motivoDeshecho: null,
      }));
      otorgamientos.push(...nuevos);
      nuevos.forEach((o) =>
        registrar("otorgamientos", o.id, 1, "otorgamiento_creado", { otorgamiento: o }),
      );
      pedido.revision++;
      pedido.otorgados += nuevos.length;
      pedido.pendientes = pedido.cantidadCupos - pedido.otorgados;
      pedido.estado = pedido.pendientes === 0 ? "atendido" : "parcial";
      registrar("pedidos", pedido.id, pedido.revision, "cupos_otorgados", {
        pedidoId: pedido.id,
        otorgamientos: nuevos.map(({ id, contrato, plan, cupo }) => ({ id, contrato, plan, cupo })),
        otorgados: pedido.otorgados,
        pendientes: pedido.pendientes,
      });
      return { otorgamientos: nuevos, pedido: { ...pedido } } satisfies OtorgarResultado;
    });
  }),
  http.post(`${API}/otorgamientos/:id/deshacer`, async ({ request, params }) => {
    const body = (await request.json()) as { revision: number; motivo: string };
    const o = otorgamientos.find((f) => f.id === params.id);
    if (!o) return error(404, "El vínculo no existe.");
    if (!body.motivo?.trim()) return error(400, "Indicá la revisión actual y el motivo.");
    return comando(request, body, () => {
      if (o.revision !== body.revision)
        return error(409, "El vínculo cambió. Actualizá los datos.");
      if (o.vigenteHasta) return error(409, "El cupo ya estaba desvinculado.");
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
      const pedido = pedidos.find((p) => p.id === o.pedidoId) ?? null;
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
      return {
        otorgamiento: { ...o },
        pedido: pedido ? { ...pedido } : null,
      } satisfies DeshacerResultado;
    });
  }),
];
