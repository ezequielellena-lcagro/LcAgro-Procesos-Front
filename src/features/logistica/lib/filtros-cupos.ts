export const filtrosCuposVacios = {
  contrato: "",
  producto: "",
  campania: "",
  destinoCodigo: "",
  circuito: "",
};
export type FiltrosCupos = typeof filtrosCuposVacios;
export function paramsCupos(filtros: FiltrosCupos) {
  return Object.fromEntries(Object.entries(filtros).filter(([, valor]) => valor !== ""));
}
