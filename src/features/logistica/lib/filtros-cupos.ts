export const filtrosCuposVacios = {
  contrato: "",
  producto: "",
  campania: "",
  destinoCodigo: "",
  circuito: "",
};
export type FiltrosCupos = typeof filtrosCuposVacios;
/**
 * Campaña vacía o bien formada (`2025-2026`, años consecutivos).
 *
 * Vive acá y no en el componente porque ahora el submit lo dispara la barra de filtros que lo
 * contiene: quien decide si aplicar es el padre, no el campo.
 *
 * <p>Pide sólo el campo `campania` y no los `FiltrosCupos` enteros porque la comparten pantallas
 * con filtros distintos — Cupos y Cargas a puerto —, y en todas la campaña se escribe igual.</p>
 */
export function campaniaValida({ campania }: { campania: string }) {
  return (
    !campania ||
    (/^[0-9]{4}-[0-9]{4}$/.test(campania) &&
      Number(campania.slice(5)) === Number(campania.slice(0, 4)) + 1)
  );
}
export function paramsCupos(filtros: FiltrosCupos) {
  return Object.fromEntries(Object.entries(filtros).filter(([, valor]) => valor !== ""));
}
/**
 * Igual, para el listado de MacroGest: ahí la campaña es un entero (`20252026`) y no hay circuito,
 * que es una clasificación propia y no un dato del ERP.
 */
export function paramsCuposErp({ campania, contrato, producto, destinoCodigo }: FiltrosCupos) {
  return {
    ...Object.fromEntries(
      Object.entries({ contrato, producto, destinoCodigo }).filter(([, valor]) => valor !== ""),
    ),
    ...(campania ? { campania: Number(campania.replace("-", "")) } : {}),
  };
}
