import type { BandaSegmentacion, CanalVentaPlanificacion, Cultivo, Segmento } from "../types";

/** Etiquetas y tonos: presentación pura; las clasificaciones llegan calculadas por la API. */
export const TONO_SEGMENTO: Record<Segmento, string> = {
  A: "bg-verde/15 text-verde",
  B: "bg-clementina/20 text-clementina-deep",
  C: "bg-slate-brand/10 text-slate-brand",
  D: "bg-panel-soft text-ink-soft",
};

export const ETIQUETA_CANAL: Record<CanalVentaPlanificacion, string> = {
  SinCompras: "Sin compras",
  SoloLc: "Solo LC",
  SoloBayer: "Solo Bayer",
  Ambos: "Ambos",
};

export const TONO_CANAL: Record<CanalVentaPlanificacion, string> = {
  SinCompras: "bg-panel-soft text-ink-soft",
  SoloLc: "bg-clementina/15 text-clementina-deep",
  SoloBayer: "bg-slate-brand/10 text-slate-brand",
  Ambos: "bg-verde/10 text-verde",
};

export const ETIQUETA_CULTIVO: Record<Cultivo, string> = {
  soja: "Soja",
  maiz: "Maíz",
  trigo: "Trigo",
  otro: "Otro",
};

export const ETIQUETA_BANDA: Record<BandaSegmentacion, string> = {
  sin_dato: "Sin dato",
  baja: "Baja",
  media_baja: "Media baja",
  media: "Media",
  alta: "Alta",
};
