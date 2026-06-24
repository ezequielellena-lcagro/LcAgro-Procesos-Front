/** Cultivo de semilla fiscalizada (deriva del rubro de MacroGest: 100 trigo / 101 soja). */
export type CultivoSemilla = "Trigo" | "Soja";

export const CULTIVOS: readonly CultivoSemilla[] = ["Trigo", "Soja"];

/**
 * Categorías válidas de la planilla de Sembra Evolución. `value` es el nombre del enum del backend
 * (lo que viaja en el PUT); `label` es el texto EXACTO que exige Sembra (lo que se muestra y exporta).
 */
export const CATEGORIAS = [
  { value: "PreBasica", label: "Pre Básica" },
  { value: "Original", label: "Original" },
  { value: "Fundadora", label: "Fundadora" },
  { value: "PrimeraMultiplicacion", label: "Primera Multiplicación" },
  { value: "SegundaMultiplicacion", label: "Segunda Multiplicación" },
  { value: "TerceraMultiplicacion", label: "Tercera Multiplicación" },
] as const;

export type CategoriaValue = (typeof CATEGORIAS)[number]["value"];

/** Texto Sembra → nombre del enum (para preseleccionar el desplegable desde una sugerencia). */
export function categoriaValueDesdeLabel(label: string): CategoriaValue | "" {
  return CATEGORIAS.find((c) => c.label === label)?.value ?? "";
}

export const MESES = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
] as const;

/** Filtros de la pantalla (mes/cultivo). */
export interface SemillaFiltros {
  anio: number;
  mes: number; // 1-12
  cultivo: CultivoSemilla;
}

/** Venta de semilla ya normalizada al formato Sembra (espeja VentaSemillaDto del backend). */
export interface VentaSemillaDto {
  // 10 columnas de la planilla "CARGA"
  campanaAgricola: string;
  kilosTotales: number;
  categoria: string;
  cuitDestinatario: string;
  razonSocialDestinatario: string;
  fechaComprobante: string;
  lineaComprobante: number;
  numeroComprobante: string;
  tipoComprobante: string;
  variedad: string;
  // metadatos (no van al Excel; sirven a la grilla / validación)
  codigoArticulo: number;
  nombreArticuloMacroGest: string;
  requiereMapeo: boolean;
}

/** Artículo de semilla con su estado de mapeo (espeja ArticuloMapeoDto). */
export interface ArticuloMapeoDto {
  codigoArticulo: number;
  nombreArticulo: string;
  cultivo: CultivoSemilla;
  mapeado: boolean;
  cultivarInase: string; // confirmado o sugerido ("" si no hubo match)
  categoria: string; // texto Sembra; "" si indeterminada
  esSugerencia: boolean;
}

/** Payload del upsert de la equivalencia de un artículo (el código va en la ruta). */
export interface MapeoVariedadInput {
  cultivo: CultivoSemilla;
  nombreArticulo: string;
  cultivarInase: string;
  categoria: CategoriaValue;
}

/** Equivalencia ya guardada (respuesta del upsert; espeja MapeoVariedadDto). */
export interface MapeoVariedadDto {
  codigoArticulo: number;
  nombreArticulo: string;
  cultivo: string;
  cultivarInase: string;
  categoria: string;
  fechaActualizacion: string;
}
