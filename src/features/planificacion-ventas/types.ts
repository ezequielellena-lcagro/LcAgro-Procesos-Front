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
