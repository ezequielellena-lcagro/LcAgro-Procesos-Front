export const CULTIVOS = ["soja", "maiz", "trigo", "otro"] as const;
export type Cultivo = (typeof CULTIVOS)[number];

export interface HectareasPlan {
  soja: number | null;
  maiz: number | null;
  trigo: number | null;
  otro: number | null;
}

export interface MarketShareCultivoGrilla {
  costoUsdHa: number;
  rindeTnHa: number;
}

export interface MarketShareGrilla {
  soja: MarketShareCultivoGrilla;
  maiz: MarketShareCultivoGrilla;
  trigo: MarketShareCultivoGrilla;
}

export interface VendedorGrilla {
  id: number;
  nombre: string;
}

export interface PlanSiembraFila {
  cuit: string;
  razonSocial: string;
  cuentas: number[];
  vendedor: VendedorGrilla | null;
  sucursal: string | null;
  conMovimiento: boolean;
  plan: HectareasPlan | null;
  revision: number;
  anterior: HectareasPlan | null;
  modificadoPor: string | null;
  modificadoEl: string | null;
}

export interface PlanSiembraGrilla {
  campania: string;
  editable: boolean;
  datosMacroGestAl: string | null;
  marketShare: MarketShareGrilla | null;
  filas: PlanSiembraFila[];
  sinVendedor: boolean;
}

export interface CampaniaPlanificacion {
  codigo: string;
  editable: boolean;
}

export interface ContextoPlanificacion {
  campaniaVigente: string;
  campanias: CampaniaPlanificacion[];
  alcance: {
    veTodo: boolean;
    vendedor: { id: number; nombre: string; sucursal: string } | null;
  };
}

export interface VendedorComercial {
  id: number;
  nombre: string;
  sucursalId: number | null;
  sucursal: string;
  viajantes: number[];
  usuarioId: number | null;
  usuarioNombre: string | null;
  activo: boolean;
}

export interface PlanSiembraItem extends HectareasPlan {
  cuit: string;
  revisionEsperada: number;
}

export interface GuardarPlanRequest {
  items: PlanSiembraItem[];
  vendedorId?: number;
}

export interface GuardarPlanResponse {
  guardados: { cuit: string; revision: number }[];
}

export interface HectareasConsolidado {
  soja: number | null;
  maiz: number | null;
  trigo: number | null;
  otro: number | null;
  total: number;
}

export interface OriginacionConsolidado {
  anterior: number;
  campania: number;
  total: number;
  sorgo: number;
  girasol: number;
}

export interface TotalesConsolidado {
  hectareas: HectareasConsolidado;
  mercadoUsd: number | null;
  facturacionLcUsd: number;
  facturacionLcAnteriorUsd: number;
  variacionLc: number | null;
  participacionLc: number | null;
  originacionTn: OriginacionConsolidado;
  potencialTn: number | null;
}

export interface FilaConsolidado extends Omit<TotalesConsolidado, "hectareas"> {
  cuit: string;
  razonSocial: string;
  vendedorId: number | null;
  vendedor: string | null;
  sucursalId: number | null;
  sucursal: string | null;
  hectareas: HectareasConsolidado | null;
  compraInsumos: "si" | "no" | "sin_originacion";
}

export interface SubtotalConsolidado {
  id: number;
  nombre: string;
  totales: TotalesConsolidado;
}

export interface FueraDeCarteras {
  facturacionLcUsd: number;
  facturacionLcAnteriorUsd: number;
  originacionTn: OriginacionConsolidado;
  cuits: number;
  cuentasSinCuit: number;
}

export interface ConsolidadoResponse {
  campania: string;
  datosMacroGestAl: string | null;
  filas: FilaConsolidado[];
  subtotalesSucursales: SubtotalConsolidado[];
  subtotalesVendedores: SubtotalConsolidado[];
  total: TotalesConsolidado;
  totalGeneral: TotalesConsolidado;
  fueraDeCarteras: FueraDeCarteras | null;
  ajusteRedondeo: { campaniaUsd: number; anteriorUsd: number };
  sinVendedor: boolean;
}

export const CULTIVOS_MARKET = ["soja", "maiz", "trigo"] as const;
export type CultivoMarket = (typeof CULTIVOS_MARKET)[number];

export interface MarketShareCultivoResponse {
  cultivo: CultivoMarket;
  qqInsumoHa: number | null;
  precioUsdTn: number | null;
  costoUsdHa: number | null;
  rindeTnHa: number | null;
  revision: number;
  modificadoPor: string | null;
  modificadoEl: string | null;
}

export interface MercadoCultivoResumen {
  hectareas: number;
  costoUsdHa: number | null;
  mercadoUsd: number | null;
  rindeTnHa: number | null;
  potencialTn: number | null;
}

export interface MarketShareResumen {
  soja: MercadoCultivoResumen;
  maiz: MercadoCultivoResumen;
  trigo: MercadoCultivoResumen;
  hectareasOtro: number;
  mercadoUsd: number | null;
  potencialTn: number | null;
  facturacionLcUsd: number;
  participacionLc: number | null;
  originacionTn: number;
  participacionOriginacion: number | null;
}

export interface MarketShareResponse {
  campania: string;
  editable: boolean;
  copiarDe: string | null;
  datosMacroGestAl: string | null;
  cultivos: MarketShareCultivoResponse[];
  resumen: MarketShareResumen;
  sinVendedor: boolean;
}

export interface GuardarMarketShareCultivoRequest {
  cultivo: CultivoMarket;
  qqInsumoHa: number;
  precioUsdTn: number;
  rindeTnHa: number;
  revisionEsperada: number;
}

export interface GuardarMarketShareRequest {
  cultivos: GuardarMarketShareCultivoRequest[];
}

export interface GuardarMarketShareResponse {
  cultivos: { cultivo: CultivoMarket; revision: number }[];
}


export interface SucursalComercial {
  id: number;
  nombre: string;
  activa: boolean;
}

export interface ViajanteAsignable {
  codigo: number;
  nombre: string;
  vendedorId: number | null;
  vendedorNombre: string | null;
}

export interface UsuarioAsignable {
  id: number;
  nombre: string;
  email: string;
}

export interface VendedorRequest {
  nombre: string;
  sucursalId: number;
  viajantes: number[];
  usuarioId: number | null;
  activo: boolean;
}

export interface ControlPadron {
  campania: string;
  datosMacroGestAl: string;
  codigosSinVendedorConMovimiento: { codigo: number; cuentas: number }[];
  cuitsAmbiguos: number;
  productoresPorVendedor: { vendedorId: number; productores: number }[];
  cuentasSinCuitValidoPorVendedor: { vendedorId: number; cuentas: number }[];
  cuentasSinClienteConMovimiento: number;
  facturacionSinCuitUsd: { cuentas: number; total: number };
  originacionSinCuitTn: { cuentas: number; total: number };
}

/**
 * Indicadores de la base de objetivos. `margenBruto` y `marketShare` son fracciones (0,085 = 8,5 %);
 * el market share queda en null sin plan de siembra o sin parámetros de Market Share.
 */
export interface IndicadoresBase {
  facturacionUsd: number;
  fertilizantesUsd: number;
  semillaTrigoFiscalizadaBolsas: number;
  semillaSojaFiscalizadaBolsas: number;
  rentabilidadUsd: number;
  margenBruto: number | null;
  mercadoUsd: number | null;
  marketShare: number | null;
}

export type IndicadorObjetivo =
  | "facturacion"
  | "fertilizantes"
  | "semilla_trigo_fiscalizada"
  | "semilla_soja_fiscalizada"
  | "margen_bruto"
  | "market_share";

/** `crecimiento` multiplica lo real por (1 + %); `nivel` fija el valor (sólo margen y market share). */
export type TipoObjetivo = "crecimiento" | "nivel";

/** Objetivo de la campaña siguiente. Null donde no hay porcentaje cargado o no hay base. */
export interface IndicadoresObjetivo {
  facturacionUsd: number | null;
  fertilizantesUsd: number | null;
  semillaTrigoFiscalizadaBolsas: number | null;
  semillaSojaFiscalizadaBolsas: number | null;
  rentabilidadUsd: number | null;
  margenBruto: number | null;
  marketShare: number | null;
}

/** Porcentaje cargado por gestión, en puntos (13 = 13 %). */
export interface PorcentajeObjetivo {
  indicador: IndicadorObjetivo;
  tipo: TipoObjetivo;
  porcentaje: number;
  revision: number;
  modificadoPor: string | null;
  modificadoEl: string | null;
}

export interface BaseObjetivosVendedor {
  vendedorId: number;
  vendedor: string;
  sucursal: string | null;
  indicadores: IndicadoresBase;
  objetivo: IndicadoresObjetivo;
}

/** Lo real de `campania`, base de los objetivos de `campaniaObjetivo`. Sólo gestión. */
export interface BaseObjetivosResponse {
  campania: string;
  campaniaObjetivo: string;
  datosMacroGestAl: string | null;
  vendedores: BaseObjetivosVendedor[];
  fueraDeCarteras: IndicadoresBase | null;
  objetivoFueraDeCarteras: IndicadoresObjetivo | null;
  ajusteRedondeoUsd: number;
  total: IndicadoresBase;
  objetivoTotal: IndicadoresObjetivo;
  porcentajes: PorcentajeObjetivo[];
  porcentajesEditables: boolean;
}

/** Sin `porcentaje` (y sin `tipo`) se borra el objetivo de ese indicador. */
export interface GuardarPorcentajeObjetivoRequest {
  indicador: IndicadorObjetivo;
  tipo: TipoObjetivo | null;
  porcentaje: number | null;
  revisionEsperada: number;
}

export interface GuardarPorcentajesObjetivoRequest {
  indicadores: GuardarPorcentajeObjetivoRequest[];
}
