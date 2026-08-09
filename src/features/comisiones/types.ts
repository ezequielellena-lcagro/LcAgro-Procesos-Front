/** Fila de detalle de una venta con su comisión calculada (espeja ComisionDetalleDto del backend). */
export interface ComisionDetalleDto {
  fecha: string;
  comprobante: string;
  codigoCliente: number;
  razonSocial: string | null;
  cuit: string | null;
  codigoArticulo: number;
  producto: string;
  rubro: number;
  vendedorNro: number;
  vendedor: string;
  cantidad: number;
  precioUnitario: number;
  /** Costo EFECTIVO usado en el cálculo: el de MacroGest, o el corregido a mano si el artículo tiene uno. */
  costoUnitario: number;
  factNeta: number;
  rentabilidad: number;
  margenBrutoPct: number | null;
  porcentajeComision: number;
  /** articulo | rubro | base | sin_tasa */
  origenPorcentaje: string;
  comision: number;
  alertaMargenNegativo: boolean;
  alertaCostoCero: boolean;
  alertaComisionCero: boolean;
  /** La tasa en MacroGest tiene un monto fijo que este informe NO aplica (sigue siendo % × FactNeta). */
  alertaMontoFijo: boolean;
  /** `costoUnitario` viene de una corrección manual nuestra, no del precio_costo de MacroGest. */
  costoCorregido: boolean;
  sinVendedor: boolean;
}

/** Totales de un vendedor en el período (espeja ComisionVendedorResumenDto). */
export interface ComisionVendedorResumenDto {
  vendedorNro: number;
  vendedor: string;
  factNeta: number;
  rentabilidad: number;
  margenBrutoPct: number | null;
  comision: number;
  cantComprobantes: number;
}

/** Resumen del período por vendedor + totales generales (espeja ComisionResumenDto). */
export interface ComisionResumenDto {
  generado: boolean;
  fechaGeneracion: string | null;
  vendedores: ComisionVendedorResumenDto[];
  totalFactNeta: number;
  totalRentabilidad: number;
  totalMargenBrutoPct: number | null;
  totalComision: number;
  totalComprobantes: number;
  sinVendedorFactNeta: number;
  sinVendedorComprobantes: number;
}

/** Resultado de POST /comisiones/generar (espeja ComisionGeneracionDto). */
export interface ComisionGeneracionDto {
  anio: number;
  mes: number;
  fechaGeneracion: string;
  vendedoresCongelados: number;
}

/** Estado de los filtros que arma la página y consumen los hooks de listado/resumen/export. */
export interface ComisionesFiltros {
  anio: number;
  mes: number;
  vendNro?: number;
  q?: string;
  page: number;
  pageSize: number;
}

/**
 * Corrección manual del costo de un artículo (espeja CostoArticuloDto). MacroGest es solo lectura y
 * trae `precio_costo = 0` en muchos renglones; la corrección vive en nuestra BD y es **por artículo**
 * (no por comprobante ni por período), así que pisa el costo en todos los meses.
 */
export interface CostoArticuloDto {
  codigoArticulo: number;
  costoUsd: number;
  nota: string | null;
  fechaActualizacion: string;
}

/** Payload del upsert de costo corregido: PUT /comisiones/costos/{codigoArticulo}. */
export interface CostoArticuloInput {
  codigoArticulo: number;
  costoUsd: number;
  nota: string | null;
}
