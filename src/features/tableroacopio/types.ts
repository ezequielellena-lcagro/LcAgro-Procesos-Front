// Espejo de LcAgro.Application.TableroAcopio.Dtos (camelCase). Ver 02-desarrollo/14-tablero-acopio.md §3.

export interface ObjetivosIndicadores {
  gananciaPosicionPct: number | null;
  comisionPct: number | null;
  rotacion: number | null;
  tnPreventas: number | null;
  tnAcopiadas: number | null;
  nuevosClientes: number | null;
}

export interface ObjetivoCereal {
  cereal: string;
  tn: number;
}

export interface CampaniaTablero {
  campania: string;

  tnCalzadas: number | null;
  valorCompraUsd: number | null;
  resultadoUsd: number | null;
  gananciaPosicionPct: number | null;
  posicionConArrastre: boolean;

  liquidacionesLpg: number | null;
  tnLiquidadas: number | null;
  comprasLpgArs: number | null;
  comisionArs: number | null;
  almacenajeArs: number | null;
  selladoArs: number | null;
  comisGanadasArs: number | null;
  comisionPct: number | null;
  pagadasPp: number | null;
  iibbPp: number | null;
  impuestoDcArs: number | null;
  impuestoDcPp: number | null;
  impuestoDcMeses: number;
  comisionPctNeta: number | null;
  netoCompleto: boolean;

  tnVtaDeduce: number | null;
  tnVtaEnPrecio: number | null;
  tnVtaNoCobra: number | null;
  tnVtaSinClasif: number | null;
  tnVtaTotal: number | null;
  pctSinClasificar: number | null;

  tnP15: number | null;
  tnP15Completa: number | null;
  tnBalanzaTotal: number | null;
  rotacion: number | null;
  rotacionCompleta: number | null;

  contratosPreventa: number | null;
  tnPreventas: number | null;
  tnPreventasCompleta: number | null;

  tnAcopiadas: number | null;
  tnAcopiadasCompleta: number | null;
  productores: number | null;
  productoresCompleta: number | null;
  nuevosClientes: number | null;
  nuevosCompleta: number | null;
  tnDeNuevos: number | null;

  tnSinPrecio: number | null;
  preCorte: boolean;
  titular: boolean;
  enCurso: boolean;
  definitiva: boolean;

  objetivos: ObjetivosIndicadores;
  objetivosPropios: boolean;
  objetivosCereal: ObjetivoCereal[];
}

export interface AcopiadoCereal {
  campania: string;
  cereal: string;
  tnCompleta: number;
  tnCorte: number;
}

export interface AcopiadoExcluido {
  campania: string;
  exclCorte: number;
  exclTotal: number;
  comercialCorte: number;
}

/** Incremento de un mes (no acumulado). `apertura` = arrastre y ajustes de Posición. */
export interface EvolucionMes {
  campania: string;
  cereal: string;
  mes: string;
  tnC: number;
  tnCP: number;
  usdC: number;
  tnV: number;
  tnVP: number;
  usdV: number;
  apertura: boolean;
}

export interface VendedorTablero {
  campania: string;
  vendedor: string;
  tnCorte: number;
  tnCompleta: number;
  clientes: number;
  tnAnteriorCorte: number | null;
  baseObjetivoTn: number | null;
  objetivoPct: number | null;
  objetivoTn: number | null;
  objetivoAcordado: boolean;
  avancePct: number | null;
}

export interface ParametrosTablero {
  capacidadAcopioTn: number;
  alicuotaIibb: number;
  tasaCorredorA: number;
  tasaCorredorD: number;
  cuentasReducidas: number[];
  minTnCampania: number;
  umbralDefinitivaTn: number;
  objetivoVendedorPct: number;
}

export interface TableroAcopioDto {
  generado: string;
  corte: string;
  corteFijo: boolean;
  campaniaInicioArrastre: string | null;
  parametros: ParametrosTablero;
  objetivosPorDefecto: ObjetivosIndicadores;
  campanias: CampaniaTablero[];
  acopiadoCereal: AcopiadoCereal[];
  acopiadoExcluido: AcopiadoExcluido[];
  evolucion: EvolucionMes[];
  vendedores: VendedorTablero[];
}

export interface GuardarObjetivosRequest {
  indicadores: ObjetivosIndicadores;
  cereales: ObjetivoCereal[];
}

export interface GuardarObjetivosVendedoresRequest {
  vendedores: { vendedor: string; porcentaje: number }[];
}
