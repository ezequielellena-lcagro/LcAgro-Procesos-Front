/**
 * Semillero · Stock y Órdenes de Carga. Espeja los DTOs de `LcAgro.Application.Semillero` y
 * `LcAgro.Application.ClientesMacroGest`. Los enums viajan como string (`JsonStringEnumConverter`).
 *
 * El dueño de un lote (`DuenioLote`) es `Propio` (La Clementina) o `Cliente`: la semilla de un
 * cliente se guarda y se despacha, pero no es stock vendible propio (ADR-13).
 */

export type EspecieSemillero = "Soja" | "Trigo";
export type EnvaseSemillero = "BigBag" | "Bolsa";
export type TipoMovimientoSemillero =
  | "Ingreso"
  | "AjustePositivo"
  | "AjusteNegativo"
  | "ReubicacionSalida"
  | "ReubicacionEntrada"
  | "Despacho";
export type EstadoOrdenCarga = "Pendiente" | "Despachada" | "Anulada";
export type DuenioLote = "Propio" | "Cliente";
export type MotivoAjusteSemillero =
  | "RoturaPerdida"
  | "RecuentoFisico"
  | "ErrorCarga"
  | "MuestraAnalisis"
  | "DescarteAcopio"
  | "Otro";
export type MotivoAnulacionOrdenCarga = "ClienteNoRetiro" | "ErrorArmado" | "CambioPedido" | "Duplicada" | "Otro";

export const ESPECIES: { valor: EspecieSemillero; etiqueta: string }[] = [
  { valor: "Soja", etiqueta: "Soja" },
  { valor: "Trigo", etiqueta: "Trigo" },
];

export const ENVASES: { valor: EnvaseSemillero; etiqueta: string; pesoPorDefecto: number }[] = [
  { valor: "BigBag", etiqueta: "BigBag", pesoPorDefecto: 800 },
  { valor: "Bolsa", etiqueta: "Bolsa", pesoPorDefecto: 40 },
];

export const TIPOS_MOVIMIENTO: Record<TipoMovimientoSemillero, string> = {
  Ingreso: "Ingreso",
  AjustePositivo: "Ajuste +",
  AjusteNegativo: "Ajuste −",
  ReubicacionSalida: "Reubicación (sale)",
  ReubicacionEntrada: "Reubicación (entra)",
  Despacho: "Despacho",
};

export const ESTADOS_ORDEN: Record<EstadoOrdenCarga, string> = {
  Pendiente: "Pendiente",
  Despachada: "Despachada",
  Anulada: "Anulada",
};

export const DUENIOS: { valor: DuenioLote; etiqueta: string }[] = [
  { valor: "Propio", etiqueta: "Propio" },
  { valor: "Cliente", etiqueta: "Cliente" },
];

/** Lista cerrada (R1.4). El orden es el que se muestra en el selector. */
export const MOTIVOS_AJUSTE: { valor: MotivoAjusteSemillero; etiqueta: string }[] = [
  { valor: "RoturaPerdida", etiqueta: "Rotura/pérdida" },
  { valor: "RecuentoFisico", etiqueta: "Recuento físico" },
  { valor: "ErrorCarga", etiqueta: "Error de carga" },
  { valor: "MuestraAnalisis", etiqueta: "Muestra/análisis" },
  { valor: "DescarteAcopio", etiqueta: "Descarte a acopio" },
  { valor: "Otro", etiqueta: "Otro" },
];

/** Lista cerrada (R1.5). El orden es el que se muestra en el selector. */
export const MOTIVOS_ANULACION: { valor: MotivoAnulacionOrdenCarga; etiqueta: string }[] = [
  { valor: "ClienteNoRetiro", etiqueta: "Cliente no retiró" },
  { valor: "ErrorArmado", etiqueta: "Error al armar la orden" },
  { valor: "CambioPedido", etiqueta: "Cambio de pedido" },
  { valor: "Duplicada", etiqueta: "Duplicada" },
  { valor: "Otro", etiqueta: "Otro" },
];

// ---------- Catálogos ----------

export interface VariedadDto {
  id: number;
  especie: EspecieSemillero;
  nombre: string;
  activo: boolean;
  enUso: number;
}
export interface UbicacionDto {
  id: number;
  codigo: string;
  descripcion: string | null;
  activo: boolean;
  enUso: number;
}
/** Catálogo de destinos/campos, propio de cada cliente (R1.3): no es visible para otro cliente. */
export interface DestinoDto {
  id: number;
  clienteNumero: number;
  nombre: string;
  activo: boolean;
  enUso: number;
}
export interface CatalogosSemilleroDto {
  variedades: VariedadDto[];
  ubicaciones: UbicacionDto[];
  /** Opciones ya calculadas por el backend (ADR-09): sugerida ± 1 más las campañas de lotes existentes. */
  campanias: string[];
  campaniaSugerida: string;
}
export interface VariedadInput {
  especie: EspecieSemillero;
  nombre: string;
  activo: boolean;
}
export interface UbicacionInput {
  codigo: string;
  descripcion: string | null;
  activo: boolean;
}
export interface DestinoAltaInput {
  nombre: string;
}
export interface DestinoActualizarInput {
  nombre: string;
  activo: boolean;
}

// ---------- Clientes de MacroGest (copia local) ----------

/** Un cliente activo de la copia local (R2.1/R2.2). Nunca se consulta a MacroGest en vivo. */
export interface ClienteCopiaDto {
  numero: number;
  denominacion: string;
  cuit: string | null;
}
/** Estado de la copia: cuándo se sincronizó, si hay que avisar que está vieja, si nunca hubo datos. */
export interface EstadoCopiaClientesDto {
  ultimaSincronizacion: string | null;
  ultimoIntentoFallido: string | null;
  ultimoError: string | null;
  /** > 24 h desde la última sincronización exitosa, o nunca sincronizada. */
  desactualizada: boolean;
  /** Nunca hubo una sincronización exitosa: el selector queda vacío. */
  sinCopia: boolean;
  cantidad: number;
}
export interface ClientesCopiaDto {
  clientes: ClienteCopiaDto[];
  copia: EstadoCopiaClientesDto;
}

// ---------- Stock ----------

export interface StockFilaDto {
  loteId: number;
  loteCodigo: string;
  campania: string;
  especie: EspecieSemillero;
  variedadId: number;
  variedad: string;
  envase: EnvaseSemillero;
  pesoUnitarioKg: number;
  tratada: boolean;
  pg: number | null;
  pmil: number | null;
  observaciones: string | null;
  duenio: DuenioLote;
  clienteNumero: number | null;
  clienteDenominacion: string | null;
  ubicacionId: number;
  ubicacion: string;
  fisico: number;
  comprometido: number;
  disponible: number;
  kgDisponibles: number;
}
/** Los totales de semilla de cliente NUNCA se suman a los propios (ADR-13): no es stock vendible. */
export interface StockTotalesParciales {
  bigBagsDisponibles: number;
  bolsasDisponibles: number;
  kgDisponibles: number;
}
export interface StockTotalesDto {
  propio: StockTotalesParciales;
  clientes: StockTotalesParciales;
  kgComprometidos: number;
  ordenesPendientes: number;
}
export interface StockSemilleroDto {
  filas: StockFilaDto[];
  totales: StockTotalesDto;
}
export interface StockFiltros {
  especie?: EspecieSemillero;
  variedadId?: number;
  envase?: EnvaseSemillero;
  tratada?: boolean;
  campania?: string;
  duenio?: DuenioLote;
  clienteNumero?: number;
  soloConStock?: boolean;
}

// ---------- Lotes ----------

export interface LoteDto {
  id: number;
  codigo: string;
  campania: string;
  especie: EspecieSemillero;
  variedadId: number;
  variedad: string;
  envase: EnvaseSemillero;
  pesoUnitarioKg: number;
  tratada: boolean;
  pg: number | null;
  pmil: number | null;
  observaciones: string | null;
  duenio: DuenioLote;
  clienteNumero: number | null;
  clienteDenominacion: string | null;
  /** El dueño sólo se puede cambiar mientras el lote tiene únicamente su ingreso inicial (ADR-07). */
  duenioEditable: boolean;
  /** Envase y peso unitario se bloquean bajo la misma condición que el dueño (decisión #4 de la fase). */
  envaseYPesoEditables: boolean;
}
export interface LoteDatosInput {
  codigo: string;
  campania: string;
  variedadId: number;
  envase: EnvaseSemillero;
  pesoUnitarioKg: number;
  tratada: boolean;
  pg: number | null;
  pmil: number | null;
  observaciones: string | null;
  duenio: DuenioLote;
  clienteNumero: number | null;
}
export interface LoteAltaInput extends LoteDatosInput {
  ubicacionId: number;
  cantidad: number;
}

// ---------- Movimientos ----------

/** Alta y ajuste comparten forma; el ingreso no lleva motivo (no es un ajuste). */
export interface IngresoInput {
  loteId: number;
  ubicacionId: number;
  cantidad: number;
  observacion: string | null;
}
/** `cantidad` va con signo: positiva suma, negativa resta (siempre contra el físico, R5.2). */
export interface AjusteInput {
  loteId: number;
  ubicacionId: number;
  cantidad: number;
  motivo: MotivoAjusteSemillero;
  observacion: string | null;
}
/** Se valida contra el disponible de origen, no contra el físico (R5.3). */
export interface ReubicacionInput {
  loteId: number;
  ubicacionOrigenId: number;
  ubicacionDestinoId: number;
  cantidad: number;
  observacion: string | null;
}
export interface MovimientoFiltros {
  desde?: string;
  hasta?: string;
  tipo?: TipoMovimientoSemillero;
  loteId?: number;
  duenio?: DuenioLote;
}
export interface MovimientoDto {
  id: number;
  /** ISO con zona (UTC). */
  fecha: string;
  tipo: TipoMovimientoSemillero;
  loteId: number;
  loteCodigo: string;
  campania: string;
  especie: EspecieSemillero;
  variedad: string;
  envase: EnvaseSemillero;
  ubicacionId: number;
  ubicacion: string;
  /** Con signo: + entra, − sale. */
  cantidad: number;
  kg: number;
  motivoAjuste: MotivoAjusteSemillero | null;
  observacion: string | null;
  duenio: DuenioLote;
  clienteDenominacion: string | null;
  ordenCargaNumero: number | null;
  usuario: string;
}

// ---------- Órdenes de carga ----------

export interface OrdenCargaItemInput {
  loteId: number;
  ubicacionId: number;
  cantidad: number;
}
export interface OrdenCargaInput {
  clienteNumero: number;
  destinoId: number;
  numeroPedidoVenta: string | null;
  observaciones: string | null;
  items: OrdenCargaItemInput[];
}
export interface OrdenCargaItemDto {
  id: number;
  loteId: number;
  loteCodigo: string;
  campania: string;
  especie: EspecieSemillero;
  variedad: string;
  envase: EnvaseSemillero;
  pesoUnitarioKg: number;
  tratada: boolean;
  pg: number | null;
  pmil: number | null;
  duenio: DuenioLote;
  clienteNumero: number | null;
  ubicacionId: number;
  ubicacion: string;
  cantidad: number;
  kg: number;
}
export interface OrdenCargaDto {
  id: number;
  numero: number;
  fechaAlta: string;
  clienteNumero: number;
  /** Snapshot tomado al alta/edición (R2.5): no cambia si el cliente se renombra o se da de baja después. */
  clienteDenominacion: string;
  destinoId: number;
  destinoNombre: string;
  numeroPedidoVenta: string | null;
  numeroRemito: string | null;
  observaciones: string | null;
  estado: EstadoOrdenCarga;
  fechaDespacho: string | null;
  fechaAnulacion: string | null;
  motivoAnulacion: MotivoAnulacionOrdenCarga | null;
  motivoAnulacionDetalle: string | null;
  creadoPor: string;
  despachadoPor: string | null;
  anuladoPor: string | null;
  items: OrdenCargaItemDto[];
  totalUnidades: number;
  /** Suma de `totalKgPropio` + `totalKgCliente`, ya calculada por el backend (`OrdenCargaDtos.cs`):
   * para el total de la orden (impresión, columna Kg del listado) usar este campo, no recalcularlo. */
  totalKg: number;
  /** Partidos (ADR-13): la semilla del cliente no es stock vendible, así que no se suman entre sí. */
  totalKgPropio: number;
  totalKgCliente: number;
}
export interface OrdenCargaFiltros {
  estado?: EstadoOrdenCarga;
  desde?: string;
  hasta?: string;
  clienteNumero?: number;
  texto?: string;
}
export interface DespacharOrdenInput {
  numeroRemito: string;
  numeroPedidoVenta: string | null;
}
export interface AnularOrdenInput {
  motivo: MotivoAnulacionOrdenCarga;
  detalle: string | null;
}
