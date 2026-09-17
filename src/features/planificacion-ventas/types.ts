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
  sucursalId: number;
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
