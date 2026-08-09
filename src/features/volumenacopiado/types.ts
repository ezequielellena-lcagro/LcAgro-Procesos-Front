// Espeja los DTOs de LcAgro.Application.VolumenAcopiado.Dtos.

/** Situación de un cliente en la cartera de su vendedor. */
export type EstadoCliente = "Creciente" | "Declinante" | "Dormido";

/** Una fila del ranking: el vendedor con su volumen, su cartera y su objetivo. */
export interface VendedorResumen {
  vendedor: string;
  tn: number;
  /** Sociedad vinculada o canal de baja: suma al volumen pero no lleva objetivo. */
  excluido: boolean;
  activos: number;
  universo: number;
  dormidos: number;
  /** Activos ÷ universo (0 a 1). */
  penetracion: number;
  tnPorActivo: number;
  /** Objetivo que propone el sistema para la campaña siguiente. */
  objetivoSugerido: number;
  /** Objetivo acordado; null si todavía no se cargó. */
  objetivoAcordado: number | null;
  /** Avance sobre el objetivo acordado (%); null sin objetivo. */
  cumplimiento: number | null;
}

export interface SerieCampania {
  campania: string;
  productores: number;
  tn: number;
}

/** Peso de la planta alquilada. Sale de balanza: NO reconcilia con el 1116 A. */
export interface EfectoPlanta {
  campania: string;
  prodTotal: number;
  prodSinPlanta: number;
  tnTotal: number;
  tnSinPlanta: number;
}

export interface TotalesAcopio {
  tn: number;
  productores: number;
  vendedorLider: string;
  tnLider: number;
  shareLider: number;
  /** Mejor año de los clientes que hoy no entregan: lo que hay para recuperar. */
  tnDormidas: number;
}

export interface VolumenAcopiadoDto {
  campania: string;
  campanias: string[];
  vendedores: VendedorResumen[];
  serie: SerieCampania[];
  efectoPlanta: EfectoPlanta[];
  totales: TotalesAcopio;
}

export interface ClienteCartera {
  numero: number;
  cliente: string;
  tn: number;
  tnPico: number;
  campaniaPico: string;
  estado: EstadoCliente;
  historia: Record<string, number>;
}

export interface AnalisisVendedorDto {
  vendedor: string;
  campania: string;
  resumen: VendedorResumen;
  evolucion: SerieCampania[];
  clientes: ClienteCartera[];
  palanca: string;
  explicacionObjetivo: string;
  notaObjetivo: string | null;
}

/** El mail de seguimiento ya armado, antes de enviarlo. */
export interface SeguimientoVendedorDto {
  vendedor: string;
  campania: string;
  /** Destinatario resuelto; null si el vendedor no tiene email en ningún lado. */
  email: string | null;
  /** "propia" (cargado en la app), "macrogest" o "sin". */
  origenEmail: string;
  asunto: string;
  cuerpoHtml: string;
  cuerpoTexto: string;
  dormidosListados: number;
  enviable: boolean;
}

export interface ObjetivoRequest {
  campania: string;
  vendedor: string;
  tnObjetivo: number;
  nota?: string;
}
