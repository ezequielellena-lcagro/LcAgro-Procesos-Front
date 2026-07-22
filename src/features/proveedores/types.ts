/**
 * Definición de una ventana de vencimiento (espeja TramoDto del backend). El front NO calcula
 * fechas ni etiquetas: las recibe armadas y las usa como encabezados, así los cortes ruedan con
 * el mes base sin tocar código de UI.
 * `desde` es null en el primer tramo (absorbe toda la deuda anterior) y `hasta` es null en el
 * último ("posterior"), que es el que hace cerrar la suma. Ambos bordes son inclusive.
 */
export interface TramoDto {
  etiqueta: string;
  desde: string | null; // yyyy-MM-dd
  hasta: string | null; // yyyy-MM-dd
}

/**
 * Fila del listado (espeja ProveedorDto). `montos` son 5 valores POSICIONALES, alineados índice a
 * índice con `tramos` de la respuesta. Invariante garantizada por el backend: Σ montos = saldoTotal.
 * `yaVencido` es un memo informativo (está contenido en montos[0]): NO suma.
 * `denominacion` es PII: nunca versionar exports ni usar razones sociales reales en los mocks.
 */
export interface ProveedorDto {
  numero: number;
  denominacion: string;
  montos: number[];
  saldoTotal: number;
  yaVencido: number;
}

/** Totales USD del set filtrado COMPLETO (no la página). Alimentan los KPIs y el pie de la tabla. */
export interface TotalesProveedores {
  montos: number[];
  saldoTotal: number;
  yaVencido: number;
  proveedores: number;
}

/** Respuesta del listado (espeja ProveedoresListadoDto): página + definición de tramos + totales. */
export interface ProveedoresListado {
  items: ProveedorDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  /** Último día del mes base (yyyy-MM-dd): es el corte del memo "ya vencido". */
  fechaBase: string;
  tramos: TramoDto[];
  totales: TotalesProveedores;
}

/** Opción del combo de proveedor (espeja ProveedorCatalogoDto): zona 20 y activos. */
export interface ProveedorCatalogoDto {
  numero: number;
  denominacion: string;
}

/**
 * Estado de los filtros de la pantalla. El mes base es UN solo parámetro (anio + mes): de ahí el
 * backend deriva la fecha base y los 4 horizontes, por eso el front nunca manda fechas sueltas.
 */
export interface ProveedoresFiltros {
  anio: number;
  mes: number;
  proveedor?: number;
  q?: string;
  page: number;
  pageSize: number;
}
