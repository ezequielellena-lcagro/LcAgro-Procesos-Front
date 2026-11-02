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
  /** Cupos pedidos en la app contra la preventa y cupos otorgados (vigentes). */
  cuposPedidos?: number;
  cuposOtorgados?: number;
  /** Contratado − cupos pedidos × 30.000 kg: cada pedido descuenta su total. Negativo = de más. */
  kgSaldo?: number;
  /** Cupos de 30.000 kg que faltan pedir para cubrir el saldo. */
  cuposFaltan?: number;
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
/**
 * Seguimiento de un contrato de venta: contratado, entregado (kilos cargados: sus cartas de porte) y
 * saldo, con el plazo de entrega. `posicion` es su lugar en el orden (vencidos con saldo primero).
 */
export interface ContratoVentaSeguimiento {
  posicion: number;
  numero: string;
  compradorNumero: number | null;
  compradorNombre: string | null;
  producto: number | null;
  productoNombre: string | null;
  campania: string | null;
  entregaDesde: string | null;
  entregaHasta: string | null;
  contratado: number;
  entregado: number;
  camiones: number;
  /** Contratado − entregado; negativo = se entregó de más. */
  saldo: number;
  cuposFaltan: number;
  estado:
    | "Vencido, falta entregar"
    | "Vencido, entregado de más"
    | "Vigente"
    | "Entregado de más"
    | "Cumplido";
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
  /** Fin del período de entrega de la preventa, leído de MacroGest: desde ahí está vencida. */
  preventaEntregaHasta?: string | null;
  /** Cuándo se cargó el pedido en la app. */
  creadoAl?: string | null;
}
/** Clave de un cupo en MacroGest: contrato de venta, plan de carga y cupo. */
export interface ClaveCupo {
  contrato: string;
  plan: number;
  cupo: number;
}
/**
 * Vínculo de un cupo de MacroGest con un pedido (decidido el 2026-11-02). La clave es la del cupo en
 * MacroGest; el cliente y la preventa son los del pedido al vincular.
 */
export interface Otorgamiento extends ClaveCupo {
  id: string;
  revision: number;
  pedidoId: string;
  clienteNumero: number;
  clienteNombre?: string | null;
  preventa: PreventaRef | null;
  vigenteDesde: string;
  vigenteHasta?: string | null;
  motivoDeshecho?: string | null;
}
/**
 * Un cupo de un plan de carga de MacroGest y el pedido con el que se vinculó en la app. César carga
 * los cupos una sola vez, en MacroGest, al armar el plan; en la app sólo se dice a qué pedido va
 * cada uno. Planta y productor son los del plan.
 */
export interface CupoPlan extends ClaveCupo {
  codigo: string | null;
  fechaCarga: string | null;
  producto: number | null;
  productoNombre: string | null;
  campania: string | null;
  destinoCodigo: number | null;
  destinoNombre: string | null;
  planta: number | null;
  productorNumero: number | null;
  productorNombre: string | null;
  otorgamiento: Otorgamiento | null;
}
/** Un cupo de MacroGest con su plan, como lo lee el servidor (planta y productor son del plan). */
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
/** Un maestro de MacroGest tal como sale en el Plan de Carga. */
export interface ReferenciaPlanCarga {
  codigo: number | null;
  nombre: string | null;
  cuit?: string | null;
}
/** Datos del Plan de Carga de un cupo vinculado, con el formato del que imprime MacroGest. */
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
  /** Valor de flete de referencia del padrón. */
  importeReferencia?: number | null;
  moneda?: string | null;
}
/** Lo propio de una carga: lo que la planilla tiene y MacroGest no. */
export interface CargaPropia {
  id: string;
  revision: number;
  camion: CamionCarga | null;
  /** Estado elegido a mano; nulo = el que sugiere MacroGest. */
  estado: string | null;
  humedad: number | null;
  obsCalidad: string | null;
  observacion: string | null;
}
/**
 * Una fila de Cargas a puerto, con las columnas de la planilla de logística: cada cupo de MacroGest
 * en planta 10 (DIRECTO) o 15 (PLANTA), esté o no vinculado a un pedido en la app.
 */
export interface CargaLogistica extends ClaveCupo {
  fechaCarga: string | null;
  producto: number | null;
  productoNombre: string | null;
  campania: string | null;
  planta: number | null;
  cargaEn: "PLANTA" | "DIRECTO";
  productorNumero: number | null;
  /** Productor del plan, o «SE CARGÓ EN PLANTA». */
  cargo: string | null;
  codigoOtorgado: string | null;
  destinoCodigo: number | null;
  puerto: string | null;
  cartaPorte: string | null;
  ctg: string | null;
  patente: string | null;
  kgCarga: number | null;
  kgDescarga: number | null;
  difKilos: number | null;
  fechaDescarga: string | null;
  /** Lo que dice MacroGest: DISPONIBLE, EN VIAJE o DESCARGADO. */
  estadoSugerido: string;
  /** El que se muestra: el elegido, salvo que MacroGest ya esté más adelante en el ciclo. */
  estado: string;
  propio: CargaPropia | null;
  /** Vínculo vigente del cupo con un pedido, para el Plan de Carga. */
  otorgamientoId: string | null;
}
export interface GuardarCargaBody extends ClaveCupo {
  revision: number | null;
  fichaId: string | null;
  versionId: string | null;
  estado: string | null;
  humedad: number | null;
  obsCalidad: string | null;
  observacion: string | null;
}
/** Vincula cupos de MacroGest con un pedido. */
export interface OtorgarBody {
  pedidoId: string;
  pedidoRevision: number;
  cupos: ClaveCupo[];
}
export interface OtorgarResultado {
  otorgamientos: Otorgamiento[];
  pedido: Pedido;
}
export interface DeshacerResultado {
  otorgamiento: Otorgamiento;
  pedido: Pedido | null;
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
export type Recurso = "pedidos" | "solicitudes-terminal" | "otorgamientos" | "flota" | "cupos";
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
