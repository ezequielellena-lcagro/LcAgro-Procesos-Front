export interface Pagina<T> {
  filas: T[];
  hayMas: boolean;
  datosAl: string;
}
export interface Detalle<T> {
  dato: T;
  datosAl: string;
}
export interface Periodo {
  desde: string;
  hastaExclusivo: string;
}
export interface Referencia {
  codigo: number;
  nombre: string | null;
  estado: string | null;
}
export interface PreventaRef {
  operacion: string;
  numero: string;
}
export interface Preventa extends PreventaRef {
  clienteNumero: number | null;
  clienteNombre: string | null;
  productoNombre: string | null;
  producto: number | null;
  campania: number | null;
  fechaEntregaInicio: string | null;
  fechaEntregaFin: string | null;
  kgContratados: number | null;
  estado: string | null;
  /** «P» = entrega pendiente en MacroGest; ordena el listado por prioridad de entrega. */
  estadoEntrega?: string | null;
  /** Kg de descarga en MacroGest de los cupos otorgados en la app a esta preventa. */
  kgDescargados?: number;
  /** Descargado ≥ contratado: deja de estar pendiente (vuelve sola si el puerto rechaza). */
  cumplida?: boolean;
}
export interface Venta {
  numero: string;
  compradorNombre: string | null;
  productoNombre: string | null;
  producto: number | null;
  campania: number | null;
  destinoCodigo: number | null;
  destinoNombre: string | null;
  fechaEntrega: string | null;
  fechaEntrega1: string | null;
  estado: string | null;
}
export interface Solicitud {
  id: string;
  revision: number;
  contratoVenta: string;
  productoNombre?: string | null;
  producto: number;
  campania: string;
  fechaSolicitada: string;
  cantidadCupos: number;
  canal: string;
  observacion: string | null;
  cerradaAl: string | null;
  motivoCierre: string | null;
  /** Cupos que entraron a MacroGest para ese contrato y esa fecha; `null` = MacroGest no respondió. */
  conseguidos: number | null;
}
export interface Pedido {
  id: string;
  revision: number;
  clienteNumero: number;
  clienteNombre: string | null;
  productoNombre?: string | null;
  producto: number;
  campania: string;
  fechaSolicitada: string;
  cantidadCupos: number;
  preventa: PreventaRef | null;
  observacion: string | null;
  otorgados: number;
  pendientes: number;
  estado: string;
  /** El camión se carga en la planta propia; el productor sigue siendo el dueño del cereal. */
  seCargaEnPlanta: boolean;
  /** Inicio del período de entrega de la preventa, leído de MacroGest: desde cuándo se le debe. */
  preventaEntregaDesde?: string | null;
}
/** Clave de un cupo en MacroGest: contrato de venta, plan de carga y cupo. */
export interface ClaveCupo {
  contrato: string;
  plan: number;
  cupo: number;
}
/** Otorgamiento registrado en la app contra un cupo de MacroGest. */
export interface Otorgamiento extends ClaveCupo {
  id: string;
  revision: number;
  /** Siempre sale de un pedido: el cliente y la preventa son los del pedido al otorgar. */
  pedidoId: string;
  clienteNumero: number;
  clienteNombre?: string | null;
  preventa: PreventaRef | null;
  vigenteDesde: string;
  vigenteHasta?: string | null;
  motivoDeshecho?: string | null;
}
/**
 * Un cupo de planta 0 de MacroGest. Cereal y campaña son los del contrato leídos ahora; si ya se
 * otorgó en la app y falta pasarlo en MacroGest, trae ese otorgamiento.
 */
export interface CupoPlanta0 extends ClaveCupo {
  codigoTerminal: string | null;
  fechaCarga: string | null;
  producto: number | null;
  productoNombre: string | null;
  campania: string | null;
  destinoCodigo: number | null;
  destinoNombre: string | null;
  otorgamientoVigente: Otorgamiento | null;
}
/** Un cupo de MacroGest con su plan: la planta del plan ES el estado del cupo. */
export interface CupoErp extends ClaveCupo {
  codigoTerminal: string | null;
  fechaCarga: string | null;
  planta: number | null;
  productorPlan: number | null;
  cargadorPlan: number | null;
  producto: number | null;
  productoNombre: string | null;
  campania: number | null;
  destinoNombre: string | null;
  destinoCodigo: number | null;
  tieneCabecera: boolean;
  tieneCartaPorte: boolean;
  tieneDescarga: boolean;
  ctg: string | null;
  patenteChasis: string | null;
  // API devuelve texto exacto para no perder decimales.
  kgCargaErp: string | number | null;
  kgDescargaErp: string | number | null;
  fechaDescarga: string | null;
}
export type EstadoOtorgamiento =
  | "pendiente"
  | "confirmado"
  | "otro_productor"
  | "otra_planta"
  | "no_esta"
  | "deshecho"
  | "sin_verificar";
/** Otorgamiento con lo que MacroGest dice hoy de su cupo; se recalcula en cada lectura. */
export interface OtorgamientoConEstado {
  otorgamiento: Otorgamiento;
  estado: EstadoOtorgamiento;
  detalle: string;
  erp: CupoErp | null;
  productorPlanNombre: string | null;
}
/** Un maestro de MacroGest tal como sale en el Plan de Carga. */
export interface ReferenciaPlanCarga {
  codigo: number | null;
  nombre: string | null;
  cuit?: string | null;
}
/** Datos del Plan de Carga de un otorgamiento, con el formato del que imprime MacroGest. */
export interface PlanCarga {
  contrato: string;
  plan: number;
  viajes: number | null;
  toneladas: number | null;
  fecha: string | null;
  cereal: ReferenciaPlanCarga;
  campania: number | null;
  titular: ReferenciaPlanCarga;
  numeroEstablecimiento: number | null;
  destino: ReferenciaPlanCarga;
  destinoDomicilio: string | null;
  planta: ReferenciaPlanCarga;
  destinatario: ReferenciaPlanCarga;
  corredorVentaSecundaria: ReferenciaPlanCarga;
  mercadoTermino: number | null;
  corredorVentaPrimaria: ReferenciaPlanCarga;
  entregador: ReferenciaPlanCarga;
  observaciones: string | null;
  cupos: {
    cupo: number;
    fechaCarga: string | null;
    codigoOtorgado: string | null;
    cartaPorte: string | null;
  }[];
  destinatarioApp: string;
  datosAl: string;
}
/** Camión del padrón de Flete, con la versión exacta elegida para la carga. */
export interface CamionCarga {
  fichaId: string;
  versionId: string;
  revision: number;
  patenteChasis: string;
  patenteAcoplado: string | null;
  conductor: string | null;
  transportista: string | null;
}
export interface CargaPropia {
  otorgamientoId: string;
  revision: number;
  camion: CamionCarga | null;
  observacion: string | null;
}
export type EstadoCarga =
  | "falta_pasar"
  | "por_cargar"
  | "en_viaje"
  | "descargado"
  | "revisar"
  | "no_esta"
  | "sin_verificar";
/** Un cupo otorgado con lo que dice MacroGest y lo propio (camión y observación). */
export interface CargaLogistica {
  otorgamiento: OtorgamientoConEstado;
  estado: EstadoCarga;
  cartaPorte: string | null;
  propio: CargaPropia | null;
}
export interface GuardarCargaBody {
  revision: number | null;
  fichaId: string | null;
  versionId: string | null;
  observacion: string | null;
}
export interface OtorgarBody {
  pedidoId: string;
  pedidoRevision: number;
  cupos: ClaveCupo[];
}
export interface OtorgarResultado {
  otorgamientos: Otorgamiento[];
  pedido: Pedido;
  advertencias: string[];
}
export interface DeshacerResultado {
  otorgamiento: Otorgamiento;
  pedido: Pedido | null;
  advertencias: string[];
}
export interface Evento {
  id: string;
  revision: number;
  tipo: string;
  datos: string;
  registradoAl: string;
  registradoPorId: number;
  motivo: string | null;
  /** Nombre del operador; `null` si el usuario ya no existe. */
  registradoPorNombre?: string | null;
}
export type Recurso = "pedidos" | "solicitudes-terminal" | "otorgamientos" | "flota";
export const ROLES_LECTURA = [
  "logistica-lectura",
  "logistica-pedidos",
  "logistica-cupos",
  "logistica-cargas",
] as const;
export const ROLES_CUPOS = ["logistica-lectura", "logistica-cupos", "logistica-cargas"] as const;

export type MonedaFlota = "ARS" | "USD";
export interface FichaFlotaRequest {
  patenteChasis: string;
  patenteAcoplado: string | null;
  conductor: string | null;
  cuitConductor: string | null;
  transportista: string | null;
  cuitTransportista: string | null;
  importeReferencia: string | null;
  moneda: MonedaFlota | null;
  vigenteDesde: string | null;
}
export interface EditarFichaFlotaRequest {
  revision: number;
  ficha: FichaFlotaRequest;
  motivo: string;
}
export interface BajaFichaFlotaRequest {
  revision: number;
  motivo: string;
}
export interface FichaFlotaDto {
  id: string;
  revision: number;
  versionId: string;
  activo: boolean;
  ficha: FichaFlotaRequest;
  patenteChasisRepetida: boolean;
  creadoAl: string;
  creadoPorId: number;
  actualizadoAl: string;
  actualizadoPorId: number;
}
export interface FichaFlotaVersionDto {
  id: string;
  fichaId: string;
  revision: number;
  activo: boolean;
  ficha: FichaFlotaRequest;
  registradoAl: string;
  registradoPorId: number;
}
export interface FiltrosFlota {
  buscar?: string;
  activo?: boolean;
}
export const ROLES_FLETE = ["logistica-lectura", "logistica-flete"] as const;
