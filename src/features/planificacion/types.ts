/** Contratos productivos de Planificación de Ventas; espejan los DTOs del backend. */

export type Cultivo = "soja" | "maiz" | "trigo" | "otro";
export type Segmento = "A" | "B" | "C" | "D";
export type ModoReparto = "plano" | "oportunidad";

export type OrigenPlanificacion = "manual" | "excel";

export interface ProductorDto {
  id: number;
  cuentaMacroGest: number | null;
  cuit: string | null;
  razonSocial: string;
  vendedorCodigo: number | null;
  vendedorNombre: string | null;
  sucursal: string | null;
  codigoPostal: string | null;
  localidad: string | null;
  esAltaPropia: boolean;
  habilitado: boolean;
  activoMacroGest: boolean | null;
  fechaActualizacion: string;
}

export interface PlanSiembraLineaDto {
  cultivo: Cultivo;
  hectareas: number;
  costoUsdHa: number | null;
  rindeTnHa: number | null;
  toneladasPotenciales: number | null;
  mercadoUsd: number | null;
  vigenteDesde: string;
  origen: OrigenPlanificacion;
}

export interface ProductorPlanSiembraDto {
  productorId: number;
  cuentaMacroGest: number | null;
  razonSocial: string;
  vendedorCodigo: number | null;
  vendedorNombre: string | null;
  sucursal: string | null;
  habilitado: boolean;
  campania: string;
  planCargado: boolean;
  revision: number;
  vigenteDesde: string | null;
  lineas: PlanSiembraLineaDto[];
  hectareasTotales: number;
  mercadoUsd: number | null;
  mercadoCompleto: boolean;
  hectareasSinCosto: number;
  cultivosSinCosto: Cultivo[];
}

export type CriterioSegmentacion =
  | "facturacion_lc"
  | "rentabilidad_lc"
  | "facturacion_bayer"
  | "mix_subrubros"
  | "hectareas_trabajadas"
  | "originacion_cerealera";

export type BandaSegmentacion = "sin_dato" | "baja" | "media_baja" | "media" | "alta";

export interface CriterioMatrizSegmentacionDto {
  criterio: CriterioSegmentacion;
  nombre: string;
  unidad: string;
  aclaracion: string | null;
  peso: number;
  umbralAlto: number;
  umbralMedio: number;
  umbralMedioBajo: number;
  umbralBajo: number;
}

export interface MatrizSegmentacionDto {
  campania: string;
  revision: number;
  configurada: boolean;
  vigenteDesde: string | null;
  pesoActivo: number;
  criterios: CriterioMatrizSegmentacionDto[];
}

export interface CriterioMatrizSegmentacionRequest {
  criterio: CriterioSegmentacion;
  peso: number;
  umbralAlto: number;
  umbralMedio: number;
  umbralMedioBajo: number;
  umbralBajo: number;
}

export interface MatrizSegmentacionRequest {
  campania: string;
  revisionEsperada: number;
  criterios: CriterioMatrizSegmentacionRequest[];
}

export interface DesgloseCriterioSegmentacionDto {
  criterio: CriterioSegmentacion;
  nombre: string;
  unidad: string;
  activo: boolean;
  peso: number;
  valor: number | null;
  datoDisponible: boolean;
  banda: BandaSegmentacion;
  fraccion: number;
  puntos: number;
}

export interface ProductorSegmentacionDto {
  productorId: number;
  cuentaMacroGest: number | null;
  razonSocial: string;
  vendedorCodigo: number | null;
  vendedorNombre: string | null;
  score: number;
  segmento: Segmento;
  desglose: DesgloseCriterioSegmentacionDto[];
}

export interface DistribucionSegmentacionDto {
  a: number;
  b: number;
  c: number;
  d: number;
  sinScore: number;
  total: number;
}

export interface ReferenciaHistoricaSegmentacionDto {
  disponible: boolean;
  campania: string | null;
  productoresEvaluados: number;
  productoresSinScore: number;
  distribucion: DistribucionSegmentacionDto;
  estado: string;
}

export interface SegmentacionListadoDto {
  campania: string;
  generadoEn: string;
  matriz: MatrizSegmentacionDto;
  distribucionOperativa: DistribucionSegmentacionDto;
  referenciaHistorica: ReferenciaHistoricaSegmentacionDto;
  fuenteOriginacion: string;
  items: ProductorSegmentacionDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ImpactoMatrizSegmentacionDto {
  distribucionAntes: DistribucionSegmentacionDto;
  distribucionDespues: DistribucionSegmentacionDto;
  suben: number;
  bajan: number;
  cambian: number;
  sinCambio: number;
}

export interface PrevisualizacionMatrizSegmentacionDto {
  campania: string;
  revisionBase: number;
  pesoActivoPropuesto: number;
  impacto: ImpactoMatrizSegmentacionDto;
}

export interface GuardadoMatrizSegmentacionDto {
  matriz: MatrizSegmentacionDto;
  loteCalculo: string | null;
  calculadoEn: string | null;
  sinCambios: boolean;
  impacto: ImpactoMatrizSegmentacionDto;
}

export interface SegmentacionFiltros {
  campania: string;
  q?: string;
  vendedorCodigo?: number;
  segmento?: Segmento;
  page?: number;
  pageSize?: number;
}

export type CanalVentaPlanificacion = "SinCompras" | "SoloLc" | "SoloBayer" | "Ambos";
export type OrdenConsolidadoVentas =
  | "Oportunidad"
  | "Mercado"
  | "Vendido"
  | "Participacion"
  | "Nombre";

export interface TableroFiltros {
  campania: string;
  q?: string;
  vendedorCodigo?: number;
  segmento?: Segmento;
  canal?: CanalVentaPlanificacion;
  orden?: OrdenConsolidadoVentas;
  page?: number;
  pageSize?: number;
}

export interface VendedorHistoricoVentaDto {
  codigo: number;
  nombre: string | null;
  facturacionUsd: number;
}

export interface ConsolidadoVentasItemDto {
  productorId: number;
  cuentaMacroGest: number | null;
  razonSocial: string;
  vendedorCodigo: number | null;
  vendedorNombre: string | null;
  sucursal: string | null;
  planCargado: boolean;
  hectareasTotales: number;
  mercadoConocidoUsd: number | null;
  mercadoCompleto: boolean;
  hectareasSinCosto: number;
  cultivosSinCosto: Cultivo[];
  facturacionLcUsd: number;
  rentabilidadLcUsd: number;
  /** Porcentaje en escala 0–100. */
  margenLcPct: number | null;
  mixSubrubrosLc: number;
  facturacionLcSinVendedorUsd: number;
  tieneDesvioVendedorLc: boolean;
  vendedoresHistoricosLc: VendedorHistoricoVentaDto[];
  facturacionBayerUsd: number | null;
  facturacionBayerSinVendedorUsd: number | null;
  tieneDesvioVendedorBayer: boolean | null;
  vendedoresHistoricosBayer: VendedorHistoricoVentaDto[];
  facturacionTotalUsd: number | null;
  canal: CanalVentaPlanificacion | null;
  /** Porcentaje en escala 0–100. */
  participacionPct: number | null;
  oportunidadUsd: number | null;
  tieneActividadLc: boolean;
  tieneActividadBayer: boolean | null;
  tieneActividad: boolean | null;
}

export interface ResumenConsolidadoVentasDto {
  productores: number;
  productoresConPlan: number;
  productoresMercadoIncompleto: number;
  hectareasTotales: number;
  mercadoConocidoUsd: number;
  facturacionLcUsd: number;
  facturacionBayerUsd: number | null;
  facturacionTotalUsd: number | null;
  ventaComparableUsd: number | null;
  ventaSinMercadoUsd: number | null;
  /** Porcentaje en escala 0–100. */
  participacionComparablePct: number | null;
  oportunidadUsd: number | null;
}

export interface BayerControlDepositoDto {
  deposito: number;
  renglonesTodosEstados: number;
  renglonesVigentes: number;
  pedidos: number;
  cuentas: number;
  articulos: number;
  renglonesPrecioCero: number;
  renglonesMonedaNoUsd: number;
  fechaMin: string | null;
  fechaMax: string | null;
  cantidad: number;
  importeNominalUsd: number;
  importeNominalMonedaNoUsd: number;
}

export interface BayerControlDto {
  campania: string;
  desde: string;
  hastaExclusiva: string;
  depositosConsultados: number[];
  depositos: BayerControlDepositoDto[];
  renglonesTodosEstados: number;
  renglonesVigentes: number;
  pedidos: number;
  cantidad: number;
  importeNominalUsd: number;
  importeNominalMonedaNoUsd: number;
}

export interface ConciliacionFuenteLcDto {
  renglones: number;
  totalVivoUsd: number;
  totalCruzadoPadronUsd: number;
  totalCarteraHabilitadaUsd: number;
  fueraPadronUsd: number;
  fueraCarteraUsd: number;
  sinVendedorUsd: number;
}

export interface ConteoEstadoCruceBayerDto {
  estado: string;
  filas: number;
  totalUsd: number;
}

export interface ConciliacionFuenteBayerDto {
  disponible: boolean;
  importacionId: number | null;
  fechaImportacion: string | null;
  nombreArchivo: string | null;
  formato: string | null;
  filas: number;
  filasVendedorPendienteImportacion: number;
  filasSinVendedorPorDefinicionImportacion: number;
  filasVendedorDiferenteImportacion: number;
  totalArchivoUsd: number | null;
  totalCruzadoPadronUsd: number | null;
  totalCarteraHabilitadaUsd: number | null;
  fueraPadronUsd: number | null;
  fueraCarteraUsd: number | null;
  estadosCruce: ConteoEstadoCruceBayerDto[];
}

export interface ReferenciaHistoricaVentasDto {
  disponible: boolean;
  campania: string | null;
  facturacionLcUsd: number | null;
  facturacionBayerUsd: number | null;
  facturacionTotalUsd: number | null;
  mercadoUsd: number | null;
  participacionPct: number | null;
  diferenciaLcVivoUsd: number | null;
  diferenciaBayerArchivoUsd: number | null;
  totalActualFuentesUsd: number | null;
  diferenciaTotalFuentesUsd: number | null;
  participacionActualSobreMercadoReferenciaPct: number | null;
  estado: string;
}

export interface ConciliacionControlBayerDto {
  disponible: boolean;
  motivoNoDisponible: string | null;
  datos: BayerControlDto | null;
  diferenciaArchivoVsPedidoNominalUsd: number | null;
}

export interface ConciliacionConsolidadoVentasDto {
  lc: ConciliacionFuenteLcDto;
  bayer: ConciliacionFuenteBayerDto;
  totalOperativoCarteraUsd: number | null;
  controlBayer: ConciliacionControlBayerDto;
  referenciaHistorica: ReferenciaHistoricaVentasDto;
}

export interface VendedorTableroDto {
  codigo: number;
  nombre: string;
  productores: number;
}

export interface ResumenSegmentoTableroDto {
  segmento: Segmento;
  productores: number;
  mercadoConocidoUsd: number;
  facturacionTotalUsd: number | null;
  participacionPct: number | null;
  oportunidadUsd: number | null;
  participacionOportunidadPct: number | null;
}

export interface ResumenCanalTableroDto {
  canal: CanalVentaPlanificacion;
  productores: number;
  mercadoConocidoUsd: number;
  facturacionTotalUsd: number | null;
  participacionPct: number | null;
  oportunidadUsd: number | null;
  participacionOportunidadPct: number | null;
}

export interface ProductorTableroDto {
  productor: ConsolidadoVentasItemDto;
  score: number | null;
  segmento: Segmento | null;
  desglose: DesgloseCriterioSegmentacionDto[];
}

export type LineaObjetivoPlanificacion =
  | "facturacion_lc"
  | "facturacion_general"
  | "semilla_maiz"
  | "adengo";

export type TipoObjetivoPlanificacion = "crecimiento_porcentual" | "valor_absoluto";
export type BaseObjetivoPlanificacion = "lc" | "bayer" | "total";

export interface LineaObjetivoRequest {
  linea: LineaObjetivoPlanificacion;
  tipo: TipoObjetivoPlanificacion;
  /** Fracción cuando el tipo es crecimiento_porcentual: 0,13 representa +13 %. */
  valor: number;
  base: BaseObjetivoPlanificacion;
  proporcionBase: number | null;
  fuenteProporcion?: string | null;
  esAgregada: boolean;
}

export interface ObjetivosRequest {
  campania: string;
  revisionEsperada: number;
  modoReparto: ModoReparto;
  lineas: LineaObjetivoRequest[];
}

export interface AcuerdoObjetivoVendedorRequest {
  campania: string;
  linea: LineaObjetivoPlanificacion;
  vendedorCodigo: number | null;
  revisionEsperada: number;
  valorAcordado: number | null;
  nota?: string | null;
}

export interface FuenteObjetivosDto {
  tipo: string;
  campaniaBase: string;
  campaniaAvance: string;
  desdeBase: string;
  hastaBaseExclusivo: string;
  desdeAvance: string;
  hastaAvanceExclusivo: string;
  consultadoEn: string;
  bayerBaseDisponible: boolean | null;
  bayerAvanceDisponible: boolean | null;
  bayerBaseImportacionId: number | null;
  bayerBaseImportadoEn: string | null;
  bayerBaseArchivo: string | null;
  bayerAvanceImportacionId: number | null;
  bayerAvanceImportadoEn: string | null;
  bayerAvanceArchivo: string | null;
  facturacionLcBaseUsd: number | null;
  facturacionBayerBaseUsd: number | null;
  facturacionTotalBaseUsd: number | null;
  mercadoAvanceConocidoUsd: number | null;
  mercadoAvanceCompleto: boolean | null;
  productoresAvance: number | null;
  productoresConPlanAvance: number | null;
  productoresMercadoIncompletoAvance: number | null;
  descripcion: string;
}

export interface ReferenciaHistoricaObjetivosDto {
  disponible: boolean;
  campaniaBase: string | null;
  facturacionLcUsd: number | null;
  facturacionBayerUsd: number | null;
  facturacionTotalUsd: number | null;
  mercadoUsd: number | null;
  objetivoLcMasTreceUsd: number | null;
  estado: string;
}

export interface ObjetivoVendedorDto {
  vendedorCodigo: number | null;
  vendedor: string;
  fueraDeReparto: boolean;
  productores: number | null;
  mercadoCarteraUsd: number;
  baseAnteriorUsd: number;
  realAcumuladoUsd: number | null;
  /** Fracción 0–1; no usarla con el formateador de porcentajes en escala 0–100. */
  participacionFraccion: number | null;
  crecimientoAplicadoFraccion: number;
  objetivoPlanoUsd: number;
  objetivoDerivadoUsd: number;
  objetivoAcordadoUsd: number | null;
  objetivoEfectivoUsd: number;
  avanceFraccion: number | null;
  nota: string | null;
  acordadoPorUsuarioId: number | null;
  acordadoPor: string | null;
  acordadoEn: string | null;
  vigenteDesde: string | null;
  vigenteHasta: string | null;
}

export interface CoherenciaObjetivosDto {
  evaluable: boolean;
  hayContradiccion: boolean;
  toleranciaFraccion: number;
  baseGeneralUsd: number | null;
  objetivoGeneralUsd: number | null;
  baseLcUsd: number | null;
  objetivoLcUsd: number | null;
  baseBayerImplicitaUsd: number | null;
  objetivoBayerImplicitoUsd: number | null;
  crecimientoBayerImplicitoFraccion: number | null;
  crecimientoBayerDeclaradoFraccion: number | null;
  motivoNoEvaluable: string | null;
}

export interface ObjetivoLineaDto extends LineaObjetivoRequest {
  nombre: string;
  unidad: string;
  medible: boolean;
  motivoNoMedible: string | null;
  baseCompaniaUsd: number | null;
  realCompaniaUsd: number | null;
  objetivoCompaniaUsd: number | null;
  objetivoEfectivoUsd: number | null;
  diferenciaAcordadaUsd: number | null;
  vendedores: ObjetivoVendedorDto[];
}

export interface ObjetivosDto {
  campania: string;
  campaniaBase: string;
  revision: number;
  configurado: boolean;
  modoReparto: ModoReparto;
  factorOportunidadFraccion: number;
  avanceEsperadoFraccion: number;
  vigenteDesde: string | null;
  vigenteHasta: string | null;
  fuenteOperativa: FuenteObjetivosDto;
  referenciaHistorica: ReferenciaHistoricaObjetivosDto;
  coherencia: CoherenciaObjetivosDto;
  avisos: string[];
  lineas: ObjetivoLineaDto[];
}

export interface GuardadoObjetivosDto {
  objetivos: ObjetivosDto;
  sinCambios: boolean;
}

export interface ObjetivosConsulta {
  campania: string;
  linea?: LineaObjetivoPlanificacion;
  vigenteEn?: string;
}

export interface TableroPlanificacionDto {
  campania: string;
  campaniasDisponibles: string[];
  desde: string;
  hastaExclusivo: string;
  generadoEn: string;
  bayerDisponible: boolean;
  segmentacionDisponible: boolean;
  motivoSegmentacionNoDisponible: string | null;
  vendedores: VendedorTableroDto[];
  items: ProductorTableroDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  resumenSeleccion: ResumenConsolidadoVentasDto;
  resumenCampania: ResumenConsolidadoVentasDto;
  resumenPorSegmento: ResumenSegmentoTableroDto[];
  resumenPorCanal: ResumenCanalTableroDto[];
  matriz: MatrizSegmentacionDto;
  referenciaSegmentacion: ReferenciaHistoricaSegmentacionDto;
  conciliacion: ConciliacionConsolidadoVentasDto;
  objetivos: ObjetivosDto;
}

export interface ProductorTableroDetalleDto {
  campania: string;
  generadoEn: string;
  item: ProductorTableroDto;
  plan: ProductorPlanSiembraDto;
}
