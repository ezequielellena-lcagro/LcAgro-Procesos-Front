import { http, HttpResponse } from "msw";
import { normalizarComprobante } from "@/features/semillero/lib/comprobante";
import type {
  AjusteInput,
  AnularOrdenInput,
  CatalogosSemilleroDto,
  ClientesCopiaDto,
  DespacharOrdenInput,
  DestinoActualizarInput,
  DestinoAltaInput,
  DestinoDto,
  DuenioLote,
  EnvaseSemillero,
  EspecieSemillero,
  EstadoCopiaClientesDto,
  IngresoInput,
  LoteAltaInput,
  LoteDatosInput,
  LoteDto,
  MotivoAjusteSemillero,
  MovimientoDto,
  OrdenCargaDto,
  OrdenCargaInput,
  OrdenCargaItemDto,
  ReubicacionInput,
  StockFilaDto,
  StockSemilleroDto,
  StockTotalesDto,
  StockTotalesParciales,
  TipoMovimientoSemillero,
  UbicacionDto,
  UbicacionInput,
  VariedadDto,
  VariedadInput,
} from "@/features/semillero/types";
import { env } from "@/lib/env";

const API = env.apiUrl;

const haceHoras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

// ── Catálogos: variedades y ubicaciones ───────────────────────────────────

let seqVariedad = 3;
const VARIEDADES: VariedadDto[] = [
  { id: 1, especie: "Soja", nombre: "DM 53i54", activo: true, enUso: 0 },
  { id: 2, especie: "Soja", nombre: "NS 4309", activo: true, enUso: 0 },
  { id: 3, especie: "Trigo", nombre: "BAGUETTE 620", activo: false, enUso: 0 },
];

let seqUbicacion = 3;
const UBICACIONES: UbicacionDto[] = [
  { id: 1, codigo: "G1-1", descripcion: "Galpón 1, módulo 1", activo: true, enUso: 0 },
  { id: 2, codigo: "G1-2", descripcion: "Galpón 1, módulo 2", activo: true, enUso: 0 },
  { id: 3, codigo: "PLANTA", descripcion: "Planta de semillas", activo: true, enUso: 0 },
];

const variedadNombre = (id: number) => VARIEDADES.find((v) => v.id === id)?.nombre ?? "?";
const ubicacionCodigo = (id: number) => UBICACIONES.find((u) => u.id === id)?.codigo ?? "?";

/** Sugerida con corte en julio (ADR-09): antes de julio sigue en la campaña que arrancó el año anterior. */
function campaniaSugerida(fecha: Date = new Date()): string {
  const anio = fecha.getFullYear();
  const desde = fecha.getMonth() >= 6 ? anio : anio - 1;
  return `${desde}-${desde + 1}`;
}

function campaniaVecina(campania: string, delta: number): string {
  const desde = Number(campania.split("-")[0]) + delta;
  return `${desde}-${desde + 1}`;
}

function opcionesCampania(): string[] {
  const sugerida = campaniaSugerida();
  const opciones = new Set([campaniaVecina(sugerida, -1), sugerida, campaniaVecina(sugerida, 1)]);
  LOTES.forEach((l) => opciones.add(l.campania));
  return [...opciones].sort();
}

const enUsoVariedad = (id: number) => LOTES.filter((l) => l.variedadId === id).length;
const enUsoUbicacion = (id: number) => STOCK.filter((r) => r.ubicacionId === id).length;
const enUsoDestino = (id: number) => ORDENES.filter((o) => o.destinoId === id).length;

// ── Clientes de MacroGest (copia local, R2.1-R2.5) — SIEMPRE ficticios ────

interface ClienteFicticio {
  numero: number;
  denominacion: string;
  cuit: string | null;
  activo: boolean;
}

/**
 * Nunca datos reales de La Clementina: números fuera de rango real y sufijo "DEMO", igual que el
 * resto de los mocks del repo (ver `volumenacopiado.ts`). El 900004 está inactivo a propósito para
 * probar que la copia nunca lo ofrece (decisión #3), aunque tenga un nombre parecido a los demás.
 */
const CLIENTES: ClienteFicticio[] = [
  { numero: 900001, denominacion: "VIVERO DEMO SANTA ROSA SA", cuit: "30712345678", activo: true },
  { numero: 900002, denominacion: "SEMILLERO DEMO EL CEIBO SRL", cuit: null, activo: true },
  {
    numero: 900003,
    denominacion: "COOPERATIVA DEMO CAMPO VERDE",
    cuit: "30798765432",
    activo: true,
  },
  { numero: 900004, denominacion: "ESTANCIA DEMO LA BAJADA (BAJA)", cuit: null, activo: false },
];

const nombreCliente = (numero: number | null) =>
  numero === null ? null : (CLIENTES.find((c) => c.numero === numero)?.denominacion ?? null);

// Arranca con una copia "vieja" (>24 h) a propósito: es el estado más interesante para mostrar el
// aviso de R2.3 apenas se abre la demo, sin depender de que alguien dispare una sincronización antes.
let ultimaSincronizacion: string | null = haceHoras(30);
let ultimoIntentoFallido: string | null = null;
let ultimoError: string | null = null;
let intentosSincronizacion = 0;

function estadoCopia(): EstadoCopiaClientesDto {
  const desactualizada =
    !ultimaSincronizacion || Date.now() - new Date(ultimaSincronizacion).getTime() > 24 * 3_600_000;
  return {
    ultimaSincronizacion,
    ultimoIntentoFallido,
    ultimoError,
    desactualizada,
    sinCopia: !ultimaSincronizacion,
    cantidad: CLIENTES.filter((c) => c.activo).length,
  };
}

// ── Destinos por cliente (R1.3) ────────────────────────────────────────────

let seqDestino = 3;
const DESTINOS: DestinoDto[] = [
  { id: 1, clienteNumero: 900001, nombre: "Campo Norte", activo: true, enUso: 0 },
  { id: 2, clienteNumero: 900001, nombre: "Acopio Central", activo: true, enUso: 0 },
  { id: 3, clienteNumero: 900002, nombre: "Establecimiento La Loma", activo: true, enUso: 0 },
];

// ── Lotes y stock (R3.x/R4.x) ──────────────────────────────────────────────

interface LoteFicticio {
  id: number;
  codigo: string;
  campania: string;
  especie: EspecieSemillero;
  variedadId: number;
  envase: EnvaseSemillero;
  pesoUnitarioKg: number;
  tratada: boolean;
  pg: number | null;
  pmil: number | null;
  observaciones: string | null;
  duenio: DuenioLote;
  clienteNumero: number | null;
  /** Controla `duenioEditable`/`envaseYPesoEditables` (decisión #4): sólo mientras no tuvo más que el ingreso inicial. */
  soloIngresoInicial: boolean;
}

let seqLote = 4;
const LOTES: LoteFicticio[] = [
  {
    id: 1,
    codigo: "26S-001",
    campania: "2026-2027",
    especie: "Soja",
    variedadId: 1,
    envase: "BigBag",
    pesoUnitarioKg: 800,
    tratada: true,
    pg: 92,
    pmil: 165,
    observaciones: null,
    duenio: "Propio",
    clienteNumero: null,
    soloIngresoInicial: false,
  },
  {
    id: 2,
    codigo: "26S-002",
    campania: "2026-2027",
    especie: "Soja",
    variedadId: 2,
    envase: "Bolsa",
    pesoUnitarioKg: 40,
    tratada: false,
    pg: null,
    pmil: null,
    observaciones: null,
    duenio: "Propio",
    clienteNumero: null,
    soloIngresoInicial: true,
  },
  {
    id: 3,
    codigo: "26S-C01",
    campania: "2026-2027",
    especie: "Soja",
    variedadId: 1,
    envase: "BigBag",
    pesoUnitarioKg: 800,
    tratada: true,
    pg: 90,
    pmil: 160,
    observaciones: "Semilla del cliente, para multiplicación.",
    duenio: "Cliente",
    clienteNumero: 900001,
    soloIngresoInicial: true,
  },
  {
    id: 4,
    codigo: "25S-050",
    campania: "2025-2026",
    especie: "Soja",
    variedadId: 2,
    envase: "BigBag",
    pesoUnitarioKg: 800,
    tratada: false,
    pg: null,
    pmil: null,
    observaciones: null,
    duenio: "Propio",
    clienteNumero: null,
    soloIngresoInicial: false,
  },
];

interface StockRow {
  loteId: number;
  ubicacionId: number;
  fisico: number;
}

const STOCK: StockRow[] = [
  { loteId: 1, ubicacionId: 1, fisico: 40 },
  { loteId: 2, ubicacionId: 2, fisico: 500 },
  { loteId: 3, ubicacionId: 3, fisico: 10 },
  { loteId: 4, ubicacionId: 1, fisico: 3 },
];

function stockRow(loteId: number, ubicacionId: number): StockRow {
  const existente = STOCK.find((r) => r.loteId === loteId && r.ubicacionId === ubicacionId);
  if (existente) return existente;
  const nueva: StockRow = { loteId, ubicacionId, fisico: 0 };
  STOCK.push(nueva);
  return nueva;
}

/** Reservado = suma de renglones de órdenes Pendientes sobre ese lote × ubicación (R4.1). */
function comprometido(loteId: number, ubicacionId: number, excluirOrdenId?: number): number {
  return ORDENES.filter((o) => o.estado === "Pendiente" && o.id !== excluirOrdenId)
    .flatMap((o) => o.items)
    .filter((it) => it.loteId === loteId && it.ubicacionId === ubicacionId)
    .reduce((suma, it) => suma + it.cantidad, 0);
}

/** Ningún renglón de una orden Pendiente reserva stock de este lote, en ninguna ubicación. */
function sinReservas(loteId: number): boolean {
  return STOCK.filter((r) => r.loteId === loteId).every(
    (r) => comprometido(r.loteId, r.ubicacionId) === 0,
  );
}

/**
 * Envase, peso unitario y dueño quedan bloqueados una vez que el lote tuvo movimientos más allá del
 * ingreso inicial (decisión #4): ajustes, reubicaciones, despachos, o estar reservado por una orden
 * Pendiente, aunque el ingreso siga siendo el único movimiento registrado.
 */
function atributosSensiblesEditables(l: LoteFicticio): boolean {
  return l.soloIngresoInicial && sinReservas(l.id);
}

function loteDto(l: LoteFicticio): LoteDto {
  return {
    id: l.id,
    codigo: l.codigo,
    campania: l.campania,
    especie: l.especie,
    variedadId: l.variedadId,
    variedad: variedadNombre(l.variedadId),
    envase: l.envase,
    pesoUnitarioKg: l.pesoUnitarioKg,
    tratada: l.tratada,
    pg: l.pg,
    pmil: l.pmil,
    observaciones: l.observaciones,
    duenio: l.duenio,
    clienteNumero: l.clienteNumero,
    clienteDenominacion: nombreCliente(l.clienteNumero),
    duenioEditable: atributosSensiblesEditables(l),
    envaseYPesoEditables: atributosSensiblesEditables(l),
  };
}

function stockFilaDto(row: StockRow, excluirOrdenId?: number): StockFilaDto {
  const lote = LOTES.find((l) => l.id === row.loteId)!;
  const reservado = comprometido(row.loteId, row.ubicacionId, excluirOrdenId);
  const disponible = row.fisico - reservado;
  return {
    loteId: lote.id,
    loteCodigo: lote.codigo,
    campania: lote.campania,
    especie: lote.especie,
    variedadId: lote.variedadId,
    variedad: variedadNombre(lote.variedadId),
    envase: lote.envase,
    pesoUnitarioKg: lote.pesoUnitarioKg,
    tratada: lote.tratada,
    pg: lote.pg,
    pmil: lote.pmil,
    observaciones: lote.observaciones,
    duenio: lote.duenio,
    clienteNumero: lote.clienteNumero,
    clienteDenominacion: nombreCliente(lote.clienteNumero),
    ubicacionId: row.ubicacionId,
    ubicacion: ubicacionCodigo(row.ubicacionId),
    fisico: row.fisico,
    comprometido: reservado,
    disponible,
    kgDisponibles: disponible * lote.pesoUnitarioKg,
  };
}

function totalesParciales(filas: StockFilaDto[], duenio: DuenioLote): StockTotalesParciales {
  const propias = filas.filter((f) => f.duenio === duenio);
  return {
    bigBagsDisponibles: propias
      .filter((f) => f.envase === "BigBag")
      .reduce((s, f) => s + f.disponible, 0),
    bolsasDisponibles: propias
      .filter((f) => f.envase === "Bolsa")
      .reduce((s, f) => s + f.disponible, 0),
    kgDisponibles: propias.reduce((s, f) => s + f.kgDisponibles, 0),
  };
}

function stockTotales(filas: StockFilaDto[]): StockTotalesDto {
  return {
    propio: totalesParciales(filas, "Propio"),
    clientes: totalesParciales(filas, "Cliente"),
    kgComprometidos: filas.reduce((s, f) => s + f.comprometido * f.pesoUnitarioKg, 0),
    ordenesPendientes: ORDENES.filter((o) => o.estado === "Pendiente").length,
  };
}

// ── Movimientos (R5.x) ──────────────────────────────────────────────────────

let seqMovimiento = 100;
const MOVIMIENTOS: MovimientoDto[] = [];

function nuevoMovimiento(
  tipo: TipoMovimientoSemillero,
  loteId: number,
  ubicacionId: number,
  cantidad: number,
  opts: {
    motivoAjuste?: MotivoAjusteSemillero | null;
    observacion?: string | null;
    ordenCargaNumero?: number | null;
  } = {},
): MovimientoDto {
  const lote = LOTES.find((l) => l.id === loteId)!;
  const mov: MovimientoDto = {
    id: ++seqMovimiento,
    fecha: new Date().toISOString(),
    tipo,
    loteId,
    loteCodigo: lote.codigo,
    campania: lote.campania,
    especie: lote.especie,
    variedad: variedadNombre(lote.variedadId),
    envase: lote.envase,
    ubicacionId,
    ubicacion: ubicacionCodigo(ubicacionId),
    cantidad,
    kg: cantidad * lote.pesoUnitarioKg,
    motivoAjuste: opts.motivoAjuste ?? null,
    observacion: opts.observacion ?? null,
    duenio: lote.duenio,
    clienteDenominacion: nombreCliente(lote.clienteNumero),
    ordenCargaNumero: opts.ordenCargaNumero ?? null,
    usuario: "Admin Demo",
  };
  MOVIMIENTOS.unshift(mov);
  return mov;
}

// Historial inicial: los ingresos que originaron los lotes sembrados arriba.
nuevoMovimiento("Ingreso", 1, 1, 40, { observacion: "Ingreso de cosecha propia." });
nuevoMovimiento("Ingreso", 2, 2, 500);
nuevoMovimiento("Ingreso", 3, 3, 10, { observacion: "Recepción de semilla del cliente." });
nuevoMovimiento("Ingreso", 4, 1, 5);
nuevoMovimiento("AjustePositivo", 4, 1, -2, {
  motivoAjuste: "RecuentoFisico",
  observacion: "Recuento de fin de mes.",
});

// ── Órdenes de carga (R6.x) ─────────────────────────────────────────────────

function itemDto(loteId: number, ubicacionId: number, cantidad: number): OrdenCargaItemDto {
  const lote = LOTES.find((l) => l.id === loteId)!;
  return {
    id: loteId * 1000 + ubicacionId,
    loteId,
    loteCodigo: lote.codigo,
    campania: lote.campania,
    especie: lote.especie,
    variedad: variedadNombre(lote.variedadId),
    envase: lote.envase,
    pesoUnitarioKg: lote.pesoUnitarioKg,
    tratada: lote.tratada,
    pg: lote.pg,
    pmil: lote.pmil,
    duenio: lote.duenio,
    clienteNumero: lote.clienteNumero,
    ubicacionId,
    ubicacion: ubicacionCodigo(ubicacionId),
    cantidad,
    kg: cantidad * lote.pesoUnitarioKg,
  };
}

function totalesDeItems(items: OrdenCargaItemDto[]) {
  return {
    totalUnidades: items.reduce((s, it) => s + it.cantidad, 0),
    totalKgPropio: items.filter((it) => it.duenio === "Propio").reduce((s, it) => s + it.kg, 0),
    totalKgCliente: items.filter((it) => it.duenio === "Cliente").reduce((s, it) => s + it.kg, 0),
  };
}

let seqOrdenId = 100;
let seqOrdenNumero = 2;

const ORDENES: OrdenCargaDto[] = [
  {
    id: 1,
    numero: 1,
    fechaAlta: haceHoras(20),
    clienteNumero: 900001,
    clienteDenominacion: "VIVERO DEMO SANTA ROSA SA",
    destinoId: 1,
    destinoNombre: "Campo Norte",
    numeroPedidoVenta: "06-00045",
    numeroRemito: null,
    observaciones: null,
    estado: "Pendiente",
    fechaDespacho: null,
    fechaAnulacion: null,
    motivoAnulacion: null,
    motivoAnulacionDetalle: null,
    creadoPor: "Admin Demo",
    despachadoPor: null,
    anuladoPor: null,
    items: [itemDto(3, 3, 2)],
    ...totalesDeItems([itemDto(3, 3, 2)]),
  },
  {
    id: 2,
    numero: 2,
    fechaAlta: haceHoras(72),
    clienteNumero: 900002,
    clienteDenominacion: "SEMILLERO DEMO EL CEIBO SRL",
    destinoId: 3,
    destinoNombre: "Establecimiento La Loma",
    numeroPedidoVenta: null,
    numeroRemito: "06-00012",
    observaciones: "Retira con camión propio.",
    estado: "Despachada",
    fechaDespacho: haceHoras(48),
    fechaAnulacion: null,
    motivoAnulacion: null,
    motivoAnulacionDetalle: null,
    creadoPor: "Admin Demo",
    despachadoPor: "Admin Demo",
    anuladoPor: null,
    items: [itemDto(1, 1, 4)],
    ...totalesDeItems([itemDto(1, 1, 4)]),
  },
];

interface ErrorNegocio {
  status: 400 | 409;
  detail: string;
}

/** Regla de dueño exclusivo (R4.4), destino del mismo cliente, sin renglones repetidos, y stock disponible. */
function validarOrdenInput(input: OrdenCargaInput, ordenIdEnEdicion?: number): ErrorNegocio | null {
  const cliente = CLIENTES.find((c) => c.numero === input.clienteNumero && c.activo);
  if (!cliente)
    return { status: 400, detail: "El cliente no existe o no está activo en la copia local." };

  const destino = DESTINOS.find((d) => d.id === input.destinoId);
  if (!destino || destino.clienteNumero !== input.clienteNumero) {
    return { status: 400, detail: "El destino no corresponde al cliente elegido." };
  }

  if (input.items.length === 0)
    return { status: 400, detail: "La orden necesita al menos un renglón." };

  const claves = new Set<string>();
  for (const it of input.items) {
    const clave = `${it.loteId}-${it.ubicacionId}`;
    if (claves.has(clave))
      return { status: 400, detail: "Hay renglones repetidos de lote y ubicación." };
    claves.add(clave);
  }

  for (const it of input.items) {
    const lote = LOTES.find((l) => l.id === it.loteId);
    if (!lote) return { status: 400, detail: "Uno de los lotes no existe." };

    if (lote.duenio === "Cliente" && lote.clienteNumero !== input.clienteNumero) {
      return {
        status: 409,
        detail: `Lote ${lote.codigo} es de ${nombreCliente(lote.clienteNumero)}: no se puede usar en una orden de otro cliente.`,
      };
    }

    const row = STOCK.find((r) => r.loteId === it.loteId && r.ubicacionId === it.ubicacionId);
    const disponible =
      (row?.fisico ?? 0) - comprometido(it.loteId, it.ubicacionId, ordenIdEnEdicion);
    if (it.cantidad > disponible) {
      return {
        status: 409,
        detail: `Lote ${lote.codigo} en ${ubicacionCodigo(it.ubicacionId)}: se necesitan ${it.cantidad} y hay ${disponible}.`,
      };
    }
  }

  return null;
}

function errorResponse(error: ErrorNegocio) {
  return HttpResponse.json({ detail: error.detail }, { status: error.status });
}

// ── Handlers ─────────────────────────────────────────────────────────────

export const semilleroHandlers = [
  // Stock
  http.get(`${API}/semillero/stock`, ({ request }) => {
    const url = new URL(request.url);
    const especie = url.searchParams.get("especie");
    const variedadId = url.searchParams.get("variedadId");
    const envase = url.searchParams.get("envase");
    const tratada = url.searchParams.get("tratada");
    const campania = url.searchParams.get("campania");
    const duenio = url.searchParams.get("duenio");
    const clienteNumero = url.searchParams.get("clienteNumero");
    const soloConStock = url.searchParams.get("soloConStock");

    let filas = STOCK.map((r) => stockFilaDto(r));
    if (especie) filas = filas.filter((f) => f.especie === especie);
    if (variedadId) filas = filas.filter((f) => f.variedadId === Number(variedadId));
    if (envase) filas = filas.filter((f) => f.envase === envase);
    if (tratada) filas = filas.filter((f) => f.tratada === (tratada === "true"));
    if (campania) filas = filas.filter((f) => f.campania === campania);
    if (duenio) filas = filas.filter((f) => f.duenio === duenio);
    if (clienteNumero) filas = filas.filter((f) => f.clienteNumero === Number(clienteNumero));
    if (soloConStock === "true") filas = filas.filter((f) => f.fisico > 0);

    return HttpResponse.json({ filas, totales: stockTotales(filas) } satisfies StockSemilleroDto);
  }),

  // El .xlsx de la demo va vacío, igual que el resto de los módulos (el formato lo cubre el backend).
  http.get(`${API}/semillero/stock/excel`, () => new HttpResponse(new Blob(), { status: 200 })),

  http.get(`${API}/semillero/lotes`, () =>
    HttpResponse.json(LOTES.map(loteDto) satisfies LoteDto[]),
  ),

  http.post(`${API}/semillero/lotes`, async ({ request }) => {
    const input = (await request.json()) as LoteAltaInput;
    const yaExiste = LOTES.some(
      (l) =>
        l.codigo.trim().toLowerCase() === input.codigo.trim().toLowerCase() &&
        l.campania === input.campania,
    );
    if (yaExiste) {
      return errorResponse({
        status: 409,
        detail: `Ya existe el lote ${input.codigo} en la campaña ${input.campania}.`,
      });
    }
    const nuevo: LoteFicticio = {
      id: ++seqLote,
      codigo: input.codigo,
      campania: input.campania,
      especie: VARIEDADES.find((v) => v.id === input.variedadId)?.especie ?? "Soja",
      variedadId: input.variedadId,
      envase: input.envase,
      pesoUnitarioKg: input.pesoUnitarioKg,
      tratada: input.tratada,
      pg: input.pg,
      pmil: input.pmil,
      observaciones: input.observaciones,
      duenio: input.duenio,
      clienteNumero: input.duenio === "Cliente" ? input.clienteNumero : null,
      soloIngresoInicial: true,
    };
    LOTES.push(nuevo);
    stockRow(nuevo.id, input.ubicacionId).fisico += input.cantidad;
    nuevoMovimiento("Ingreso", nuevo.id, input.ubicacionId, input.cantidad);
    return HttpResponse.json(loteDto(nuevo), { status: 201 });
  }),

  http.put(`${API}/semillero/lotes/:id`, async ({ params, request }) => {
    const lote = LOTES.find((l) => l.id === Number(params.id));
    if (!lote) return errorResponse({ status: 400, detail: "Lote no encontrado." });

    const input = (await request.json()) as LoteDatosInput;
    if (!atributosSensiblesEditables(lote)) {
      if (lote.envase !== input.envase || lote.pesoUnitarioKg !== input.pesoUnitarioKg) {
        return errorResponse({
          status: 409,
          detail:
            "El envase y el peso unitario quedan bloqueados una vez que el lote tuvo movimientos además del ingreso inicial.",
        });
      }
      if (lote.duenio !== input.duenio) {
        return errorResponse({
          status: 409,
          detail:
            "El dueño no se puede cambiar: el lote ya tiene movimientos además del ingreso inicial.",
        });
      }
    }

    Object.assign(lote, {
      codigo: input.codigo,
      campania: input.campania,
      variedadId: input.variedadId,
      envase: input.envase,
      pesoUnitarioKg: input.pesoUnitarioKg,
      tratada: input.tratada,
      pg: input.pg,
      pmil: input.pmil,
      observaciones: input.observaciones,
      duenio: input.duenio,
      clienteNumero: input.duenio === "Cliente" ? input.clienteNumero : null,
    });
    return HttpResponse.json(loteDto(lote));
  }),

  // Movimientos
  http.post(`${API}/semillero/movimientos/ingreso`, async ({ request }) => {
    const input = (await request.json()) as IngresoInput;
    stockRow(input.loteId, input.ubicacionId).fisico += input.cantidad;
    nuevoMovimiento("Ingreso", input.loteId, input.ubicacionId, input.cantidad, {
      observacion: input.observacion,
    });
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/semillero/movimientos/ajuste`, async ({ request }) => {
    const input = (await request.json()) as AjusteInput;
    if (input.motivo === "Otro" && !input.observacion?.trim()) {
      return errorResponse({ status: 400, detail: 'El motivo "Otro" exige completar el detalle.' });
    }
    const row = stockRow(input.loteId, input.ubicacionId);
    if (input.cantidad < 0 && row.fisico + input.cantidad < 0) {
      return errorResponse({
        status: 409,
        detail: `No se puede ajustar: el físico (${row.fisico}) quedaría negativo.`,
      });
    }
    row.fisico += input.cantidad;
    const lote = LOTES.find((l) => l.id === input.loteId);
    if (lote) lote.soloIngresoInicial = false;
    nuevoMovimiento(
      input.cantidad >= 0 ? "AjustePositivo" : "AjusteNegativo",
      input.loteId,
      input.ubicacionId,
      input.cantidad,
      {
        motivoAjuste: input.motivo,
        observacion: input.observacion,
      },
    );
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/semillero/movimientos/reubicacion`, async ({ request }) => {
    const input = (await request.json()) as ReubicacionInput;
    const origen = stockRow(input.loteId, input.ubicacionOrigenId);
    const disponibleOrigen = origen.fisico - comprometido(input.loteId, input.ubicacionOrigenId);
    if (input.cantidad > disponibleOrigen) {
      return errorResponse({
        status: 409,
        detail: `Disponible insuficiente en ${ubicacionCodigo(input.ubicacionOrigenId)}: hay ${disponibleOrigen}.`,
      });
    }
    origen.fisico -= input.cantidad;
    stockRow(input.loteId, input.ubicacionDestinoId).fisico += input.cantidad;
    const lote = LOTES.find((l) => l.id === input.loteId);
    if (lote) lote.soloIngresoInicial = false;
    nuevoMovimiento("ReubicacionSalida", input.loteId, input.ubicacionOrigenId, -input.cantidad, {
      observacion: input.observacion,
    });
    nuevoMovimiento("ReubicacionEntrada", input.loteId, input.ubicacionDestinoId, input.cantidad, {
      observacion: input.observacion,
    });
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API}/semillero/movimientos`, ({ request }) => {
    const url = new URL(request.url);
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");
    const tipo = url.searchParams.get("tipo");
    const loteId = url.searchParams.get("loteId");
    const duenio = url.searchParams.get("duenio");

    let items = [...MOVIMIENTOS];
    if (desde) items = items.filter((m) => m.fecha >= desde);
    if (hasta) items = items.filter((m) => m.fecha <= hasta);
    if (tipo) items = items.filter((m) => m.tipo === tipo);
    if (loteId) items = items.filter((m) => m.loteId === Number(loteId));
    if (duenio) items = items.filter((m) => m.duenio === duenio);
    return HttpResponse.json(items satisfies MovimientoDto[]);
  }),

  http.get(
    `${API}/semillero/movimientos/excel`,
    () => new HttpResponse(new Blob(), { status: 200 }),
  ),

  // Órdenes de carga — el orden importa: /excel y /:id/... antes de /:id para no chocar con el param.
  http.get(`${API}/semillero/ordenes/excel`, () => new HttpResponse(new Blob(), { status: 200 })),

  http.get(`${API}/semillero/ordenes`, ({ request }) => {
    const url = new URL(request.url);
    const estado = url.searchParams.get("estado");
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");
    const clienteNumero = url.searchParams.get("clienteNumero");
    const texto = url.searchParams.get("texto")?.trim().toLowerCase();

    let items = [...ORDENES];
    if (estado) items = items.filter((o) => o.estado === estado);
    if (desde) items = items.filter((o) => o.fechaAlta >= desde);
    if (hasta) items = items.filter((o) => o.fechaAlta <= hasta);
    if (clienteNumero) items = items.filter((o) => o.clienteNumero === Number(clienteNumero));
    if (texto) {
      items = items.filter(
        (o) =>
          o.clienteDenominacion.toLowerCase().includes(texto) || String(o.numero).includes(texto),
      );
    }
    return HttpResponse.json(
      [...items].sort((a, b) => b.numero - a.numero) satisfies OrdenCargaDto[],
    );
  }),

  http.post(`${API}/semillero/ordenes`, async ({ request }) => {
    const input = (await request.json()) as OrdenCargaInput;
    const error = validarOrdenInput(input);
    if (error) return errorResponse(error);

    const destino = DESTINOS.find((d) => d.id === input.destinoId)!;
    const items = input.items.map((it) => itemDto(it.loteId, it.ubicacionId, it.cantidad));
    const nueva: OrdenCargaDto = {
      id: ++seqOrdenId,
      numero: ++seqOrdenNumero,
      fechaAlta: new Date().toISOString(),
      clienteNumero: input.clienteNumero,
      clienteDenominacion: nombreCliente(input.clienteNumero) ?? "",
      destinoId: destino.id,
      destinoNombre: destino.nombre,
      numeroPedidoVenta: input.numeroPedidoVenta,
      numeroRemito: null,
      observaciones: input.observaciones,
      estado: "Pendiente",
      fechaDespacho: null,
      fechaAnulacion: null,
      motivoAnulacion: null,
      motivoAnulacionDetalle: null,
      creadoPor: "Admin Demo",
      despachadoPor: null,
      anuladoPor: null,
      items,
      ...totalesDeItems(items),
    };
    ORDENES.push(nueva);
    return HttpResponse.json(nueva, { status: 201 });
  }),

  http.put(`${API}/semillero/ordenes/:id`, async ({ params, request }) => {
    const orden = ORDENES.find((o) => o.id === Number(params.id));
    if (!orden) return errorResponse({ status: 400, detail: "Orden no encontrada." });
    if (orden.estado !== "Pendiente")
      return errorResponse({ status: 409, detail: "Sólo se puede editar una orden Pendiente." });

    const input = (await request.json()) as OrdenCargaInput;
    const error = validarOrdenInput(input, orden.id);
    if (error) return errorResponse(error);

    const destino = DESTINOS.find((d) => d.id === input.destinoId)!;
    const items = input.items.map((it) => itemDto(it.loteId, it.ubicacionId, it.cantidad));
    Object.assign(orden, {
      clienteNumero: input.clienteNumero,
      clienteDenominacion: nombreCliente(input.clienteNumero) ?? "",
      destinoId: destino.id,
      destinoNombre: destino.nombre,
      numeroPedidoVenta: input.numeroPedidoVenta,
      observaciones: input.observaciones,
      items,
      ...totalesDeItems(items),
    });
    return HttpResponse.json(orden);
  }),

  http.post(`${API}/semillero/ordenes/:id/despachar`, async ({ params, request }) => {
    const orden = ORDENES.find((o) => o.id === Number(params.id));
    if (!orden) return errorResponse({ status: 400, detail: "Orden no encontrada." });
    if (orden.estado !== "Pendiente")
      return errorResponse({ status: 409, detail: "Sólo se puede despachar una orden Pendiente." });

    const input = (await request.json()) as DespacharOrdenInput;
    const remito = normalizarComprobante(input.numeroRemito);
    if (!remito)
      return errorResponse({
        status: 400,
        detail: "El remito es obligatorio y debe tener el formato NN-NNNNN.",
      });

    for (const it of orden.items) {
      const row = STOCK.find((r) => r.loteId === it.loteId && r.ubicacionId === it.ubicacionId);
      if (!row || row.fisico < it.cantidad) {
        return errorResponse({
          status: 409,
          detail: `Lote ${it.loteCodigo}: físico insuficiente para despachar.`,
        });
      }
    }
    for (const it of orden.items) {
      stockRow(it.loteId, it.ubicacionId).fisico -= it.cantidad;
      const lote = LOTES.find((l) => l.id === it.loteId);
      if (lote) lote.soloIngresoInicial = false;
      nuevoMovimiento("Despacho", it.loteId, it.ubicacionId, -it.cantidad, {
        ordenCargaNumero: orden.numero,
      });
    }

    orden.numeroRemito = remito;
    orden.numeroPedidoVenta = input.numeroPedidoVenta ?? orden.numeroPedidoVenta;
    orden.estado = "Despachada";
    orden.fechaDespacho = new Date().toISOString();
    orden.despachadoPor = "Admin Demo";
    return HttpResponse.json(orden);
  }),

  http.post(`${API}/semillero/ordenes/:id/anular`, async ({ params, request }) => {
    const orden = ORDENES.find((o) => o.id === Number(params.id));
    if (!orden) return errorResponse({ status: 400, detail: "Orden no encontrada." });
    if (orden.estado !== "Pendiente")
      return errorResponse({ status: 409, detail: "Sólo se puede anular una orden Pendiente." });

    const input = (await request.json()) as AnularOrdenInput;
    if (input.motivo === "Otro" && !input.detalle?.trim()) {
      return errorResponse({ status: 400, detail: 'El motivo "Otro" exige completar el detalle.' });
    }
    orden.estado = "Anulada";
    orden.fechaAnulacion = new Date().toISOString();
    orden.anuladoPor = "Admin Demo";
    orden.motivoAnulacion = input.motivo;
    orden.motivoAnulacionDetalle = input.detalle;
    return HttpResponse.json(orden);
  }),

  http.get(`${API}/semillero/ordenes/:id`, ({ params }) => {
    const orden = ORDENES.find((o) => o.id === Number(params.id));
    return orden
      ? HttpResponse.json(orden)
      : errorResponse({ status: 400, detail: "Orden no encontrada." });
  }),

  // Catálogos
  http.get(`${API}/semillero/catalogos`, () =>
    HttpResponse.json({
      variedades: VARIEDADES.map((v) => ({ ...v, enUso: enUsoVariedad(v.id) })),
      ubicaciones: UBICACIONES.map((u) => ({ ...u, enUso: enUsoUbicacion(u.id) })),
      campanias: opcionesCampania(),
      campaniaSugerida: campaniaSugerida(),
    } satisfies CatalogosSemilleroDto),
  ),

  http.post(`${API}/semillero/catalogos/variedades`, async ({ request }) => {
    const input = (await request.json()) as VariedadInput;
    const clave = input.nombre.trim().toLowerCase();
    const choque = VARIEDADES.find(
      (v) => v.especie === input.especie && v.nombre.trim().toLowerCase() === clave,
    );
    if (choque)
      return errorResponse({
        status: 409,
        detail: `Ya existe la variedad "${choque.nombre}" en ${choque.especie}.`,
      });
    const nueva: VariedadDto = {
      id: ++seqVariedad,
      especie: input.especie,
      nombre: input.nombre,
      activo: input.activo,
      enUso: 0,
    };
    VARIEDADES.push(nueva);
    return HttpResponse.json(nueva, { status: 201 });
  }),

  http.put(`${API}/semillero/catalogos/variedades/:id`, async ({ params, request }) => {
    const variedad = VARIEDADES.find((v) => v.id === Number(params.id));
    if (!variedad) return errorResponse({ status: 400, detail: "Variedad no encontrada." });
    const input = (await request.json()) as VariedadInput;
    const enUso = enUsoVariedad(variedad.id);
    if (enUso > 0 && input.especie !== variedad.especie) {
      return errorResponse({
        status: 409,
        detail: "No se puede cambiar la especie: la variedad está en uso.",
      });
    }
    Object.assign(variedad, input);
    variedad.enUso = enUso;
    return HttpResponse.json(variedad);
  }),

  http.post(`${API}/semillero/catalogos/ubicaciones`, async ({ request }) => {
    const input = (await request.json()) as UbicacionInput;
    const clave = input.codigo.trim().toLowerCase();
    const choque = UBICACIONES.find((u) => u.codigo.trim().toLowerCase() === clave);
    if (choque)
      return errorResponse({ status: 409, detail: `Ya existe la ubicación "${choque.codigo}".` });
    const nueva: UbicacionDto = {
      id: ++seqUbicacion,
      codigo: input.codigo,
      descripcion: input.descripcion,
      activo: input.activo,
      enUso: 0,
    };
    UBICACIONES.push(nueva);
    return HttpResponse.json(nueva, { status: 201 });
  }),

  http.put(`${API}/semillero/catalogos/ubicaciones/:id`, async ({ params, request }) => {
    const ubicacion = UBICACIONES.find((u) => u.id === Number(params.id));
    if (!ubicacion) return errorResponse({ status: 400, detail: "Ubicación no encontrada." });
    const input = (await request.json()) as UbicacionInput;
    Object.assign(ubicacion, input);
    ubicacion.enUso = enUsoUbicacion(ubicacion.id);
    return HttpResponse.json(ubicacion);
  }),

  http.put(`${API}/semillero/catalogos/destinos/:id`, async ({ params, request }) => {
    const destino = DESTINOS.find((d) => d.id === Number(params.id));
    if (!destino) return errorResponse({ status: 400, detail: "Destino no encontrado." });
    const input = (await request.json()) as DestinoActualizarInput;
    Object.assign(destino, input);
    destino.enUso = enUsoDestino(destino.id);
    return HttpResponse.json(destino);
  }),

  // Clientes (copia local) y destinos por cliente
  http.get(`${API}/semillero/clientes`, () =>
    HttpResponse.json({
      clientes: CLIENTES.filter((c) => c.activo).map(({ numero, denominacion, cuit }) => ({
        numero,
        denominacion,
        cuit,
      })),
      copia: estadoCopia(),
    } satisfies ClientesCopiaDto),
  ),

  http.post(`${API}/semillero/clientes/sincronizar`, () => {
    intentosSincronizacion++;
    const ahora = new Date().toISOString();
    // La demo no tiene un MacroGest real detrás: el primer clic muestra la resiliencia ante un
    // origen caído (R2.4, 503, se conserva la copia) y el segundo el refresco normal (R2.3), para
    // poder recorrer las dos caras del flujo con la misma acción de la UI.
    if (intentosSincronizacion % 2 === 1) {
      ultimoIntentoFallido = ahora;
      ultimoError = "MacroGest no respondió.";
      return HttpResponse.json(
        { detail: "MacroGest no respondió. Se conserva la copia anterior." },
        { status: 503 },
      );
    }
    ultimaSincronizacion = ahora;
    ultimoIntentoFallido = null;
    ultimoError = null;
    return HttpResponse.json(estadoCopia() satisfies EstadoCopiaClientesDto);
  }),

  http.get(`${API}/semillero/clientes/:numero/destinos`, ({ params, request }) => {
    const numero = Number(params.numero);
    const incluirInactivos = new URL(request.url).searchParams.get("incluirInactivos") === "true";
    const destinos = DESTINOS.filter(
      (d) => d.clienteNumero === numero && (incluirInactivos || d.activo),
    ).map((d) => ({ ...d, enUso: enUsoDestino(d.id) }));
    return HttpResponse.json(destinos satisfies DestinoDto[]);
  }),

  http.post(`${API}/semillero/clientes/:numero/destinos`, async ({ params, request }) => {
    const clienteNumero = Number(params.numero);
    const input = (await request.json()) as DestinoAltaInput;
    const clave = input.nombre.trim().toLowerCase();
    const existente = DESTINOS.find(
      (d) => d.clienteNumero === clienteNumero && d.nombre.trim().toLowerCase() === clave,
    );
    if (existente) {
      existente.activo = true; // alta rápida idempotente: reactiva si estaba inactivo (ADR-06)
      return HttpResponse.json(existente);
    }
    const nuevo: DestinoDto = {
      id: ++seqDestino,
      clienteNumero,
      nombre: input.nombre,
      activo: true,
      enUso: 0,
    };
    DESTINOS.push(nuevo);
    return HttpResponse.json(nuevo, { status: 201 });
  }),
];
