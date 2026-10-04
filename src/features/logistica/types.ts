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
  destinoNombre?: string | null;
  destinoCodigo: number;
  fechaSolicitada: string;
  cantidadCupos: number;
  canal: string;
  observacion: string | null;
  cerradaAl: string | null;
  motivoCierre: string | null;
  ultimaRespuesta: number | null;
  recibidos: number;
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
}
export interface Cupo {
  id: string;
  revision: number;
  tandaId: string;
  contratoVenta: string;
  productoNombre?: string | null;
  producto: number;
  campania: string;
  ordinal: number;
  fechaCarga: string;
  destinoNombre?: string | null;
  destinoCodigo: number;
  codigoTerminal: string | null;
  circuito: "directa" | "propia";
  lugarTipo: "campo" | "planta" | "otro";
  lugarReferencia: string | null;
  estadoObservado: string;
  otorgamientoVigente: Otorgamiento | null;
  seguimientoAnulado: boolean;
  tieneVinculoErpVigente: boolean;
  disponibleParaOtorgar: boolean;
}
export interface Otorgamiento {
  id: string;
  revision: number;
  cupoId: string;
  pedidoId: string | null;
  destinatarioTipo: "cliente" | "propio";
  clienteNumero: number | null;
  clienteNombre: string | null;
  preventa: PreventaRef | null;
  kgEstimados: number;
  vigenteDesde: string;
}
export interface OtorgarBody {
  destinatarioTipo: "cliente" | "propio";
  clienteNumero?: number;
  pedidoId?: string;
  pedidoRevision?: number;
  preventa?: PreventaRef;
  cupos: { id: string; revision: number }[];
}
export interface OtorgarResultado {
  otorgamientos: Otorgamiento[];
  cupos: Cupo[];
  pedido: Pedido | null;
  advertencias: string[];
}
export interface Recepcion {
  id: string;
  revision: number;
  contratoVenta: string;
  solicitudId: string | null;
  referencia: string;
  recibidoAl: string;
  cupos: Cupo[];
  advertencias: string[];
}
export interface CupoErp {
  contrato: string;
  grupo: number;
  cupo: number;
  codigoTerminal: string | null;
  fechaCarga: string | null;
  fechaAltaErp: string | null;
  destinoNombre: string | null;
  destinoCodigo: number | null;
  plantaTrabajo: number | null;
  plantaDetalle: number | null;
  productorPlan: number | null;
  cargadorPlan: number | null;
  codigoCp: number | null;
  sucursalCp: number | null;
  numeroCp: number | null;
  ordenCp: number | null;
  tieneCabecera: boolean;
  tieneCartaPorte: boolean;
  tieneDescarga: boolean;
  ctg: string | null;
  patenteChasis: string | null;
  // API devuelve texto exacto; number admite sólo fixtures administrativos pequeños previos.
  kgCargaErp: string | number | null;
  kgDescargaErp: string | number | null;
  patenteAcoplado: string | null;
  fechaDescarga: string | null;
}
export interface Evento {
  id: string;
  revision: number;
  tipo: string;
  datos: string;
  registradoAl: string;
  registradoPorId: number;
  motivo: string | null;
}
export const ESTADOS_SEGUIMIENTO = [
  "por_iniciar",
  "cargando",
  "en_viaje",
  "en_puerto",
  "calado",
  "descargado",
] as const;
export const FUENTES_OPERATIVAS = [
  "operador",
  "cliente",
  "balanza",
  "agroentregas",
  "terminal",
  "otro",
] as const;
export type EstadoSeguimiento = (typeof ESTADOS_SEGUIMIENTO)[number];
export type FuenteOperativa = (typeof FUENTES_OPERATIVAS)[number];
export type TipoDatoOperativo = "kg_carga" | "kg_descarga" | "patente";
export interface DatoOperativo {
  id: string;
  cupoId: string;
  tipo: TipoDatoOperativo;
  kilogramos: string | null;
  texto: string | null;
  fuente: FuenteOperativa;
  observadoAl: string;
  referencia: string;
  registradoAl: string;
  registradoPorId: number;
  reemplazaId: string | null;
  motivoCorreccion: string | null;
}
export interface VinculoErpSeguimiento {
  id: string;
  contrato: string;
  grupo: number;
  cupo: number;
  vigenteDesde: string;
  evidencia: string;
  registradoPorId: number;
}
export interface Seguimiento {
  cupoId: string;
  revision: number;
  cupo: Cupo;
  referenciaRecepcion: string;
  estadoObservado: EstadoSeguimiento;
  estadoObservadoAl: string | null;
  estadoFuente: FuenteOperativa | null;
  estadoReferencia: string | null;
  observacion: string | null;
  anuladoAl: string | null;
  anuladoPorId: number | null;
  motivoAnulacion: string | null;
  datosVigentes: DatoOperativo[];
  vinculoErpVigente: VinculoErpSeguimiento | null;
  flotaVigente?: FlotaSeguimientoDto | null;
}
export interface EstadoSeguimientoBody {
  revision: number;
  estadoObservado: EstadoSeguimiento;
  observadoAl: string;
  fuente: FuenteOperativa;
  referencia: string;
  motivoCorreccion?: string;
}
export interface DatoOperativoBody {
  revision: number;
  tipo: TipoDatoOperativo;
  kilogramos?: string;
  texto?: string;
  fuente: FuenteOperativa;
  observadoAl: string;
  referencia: string;
  reemplazaId?: string;
  motivoCorreccion?: string;
}
export interface AnularSeguimientoBody {
  revision: number;
  motivo: string;
}
export type Recurso = "pedidos" | "solicitudes-terminal" | "cupos" | "seguimientos" | "flota";
export const ROLES_LECTURA = [
  "logistica-lectura",
  "logistica-pedidos",
  "logistica-cupos",
  "logistica-cargas",
] as const;
export const ROLES_CUPOS = ["logistica-lectura", "logistica-cupos", "logistica-cargas"] as const;

export interface ClaveCupoErp {
  contrato: string;
  grupo: number;
  cupo: number;
}
export interface CandidatoErp {
  erp: CupoErp;
  ocupado: boolean;
}
export interface VinculoErpBody {
  revision: number;
  clave: ClaveCupoErp;
  evidencia: string;
  confirmado: boolean;
  motivoCambio?: null;
}
export interface RetirarVinculoErpBody {
  revision: number;
  vinculoActualId: string;
  evidencia: string;
  motivo: string;
  confirmado: boolean;
}
export interface ReemplazarVinculoErpBody extends RetirarVinculoErpBody {
  claveNueva: ClaveCupoErp;
}
export interface RetiroVinculoErpResultado {
  seguimiento: Seguimiento;
  retiradoAl: string;
}
export interface VinculoErpResultado {
  seguimiento: Seguimiento;
  verificadoAl: string;
}
export type EstadoConsultaErp = "sin_vinculo" | "verificado" | "no_encontrado" | "no_disponible";
export interface ConciliacionFila {
  seguimiento: Seguimiento;
  estadoConsulta: EstadoConsultaErp;
  erp: CupoErp | null;
  incidencias: string[];
}
export interface MetricasResumen {
  solicitudes: number;
  cerradas: number;
  solicitados: number;
  respuestaVigente: number | null;
  sinRespuesta: number;
  respuestaCero: number;
  recibidos: number;
  otorgados: number;
  porRecibir: number | null;
  porOtorgar: number;
  otrosSinOtorgar: number;
  anulados: number;
  fechaCargaDistinta: number;
  destinoDistinto: number;
}
export interface GrupoResumen {
  fechaSolicitada: string;
  destinoCodigo: number;
  contrato: string;
  producto: number;
  campania: string;
  metricas: MetricasResumen;
  productoNombre?: string | null;
  destinoNombre?: string | null;
}
export interface ResumenLogistica {
  filas: GrupoResumen[];
  totales: MetricasResumen;
  hayMas: boolean;
  propiosAl: string;
  datosAl: string;
  baseFecha: "fecha_solicitada";
  fuente: "logistica";
}
export interface CursorResumen {
  despuesFecha: string;
  despuesDestinoCodigo: number;
  despuesContrato: string;
  despuesProducto: number;
  despuesCampania: string;
}

export interface FlotaSeguimientoDto {
  fichaId: string;
  versionId: string;
  revision: number;
  patenteChasis: string;
  patenteAcoplado: string | null;
  conductor: string | null;
  transportista: string | null;
  importeReferencia: string | null;
  moneda: MonedaFlota | null;
  vigenteDesde: string | null;
}
export interface SeleccionarFlotaSeguimientoBody {
  revision: number;
  fichaId: string;
  versionId: string;
  motivo: string | null;
}
export interface RetirarFlotaSeguimientoBody {
  revision: number;
  motivo: string;
}
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
