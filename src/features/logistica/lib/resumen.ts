import type { CursorResumen, GrupoResumen, Periodo } from "../types";
export interface FiltrosResumen {
  contrato: string;
  producto: number;
  campania: string;
  destinoCodigo: number;
}
export const filtrosResumenVacios: FiltrosResumen = {
  contrato: "",
  producto: 0,
  campania: "",
  destinoCodigo: 0,
};
export function campaniaResumenValida(value: string) {
  const inicio = Number(value.slice(0, 4));
  return (
    /^[0-9]{4}-[0-9]{4}$/.test(value) &&
    inicio >= 1900 &&
    inicio < 9999 &&
    Number(value.slice(5)) === inicio + 1
  );
}
export function filtrosResumenValidos(f: FiltrosResumen) {
  return (
    (!f.contrato ||
      (f.contrato.trim().length > 0 && f.contrato.length <= 15 && !/\p{Cc}/u.test(f.contrato))) &&
    (!f.campania || campaniaResumenValida(f.campania)) &&
    (f.producto === 0 ||
      (Number.isInteger(f.producto) && f.producto >= 1 && f.producto <= 999999)) &&
    (f.destinoCodigo === 0 ||
      (Number.isInteger(f.destinoCodigo) && f.destinoCodigo >= 1 && f.destinoCodigo <= 99999999))
  );
}
export function paramsResumen(periodo: Periodo, f: FiltrosResumen) {
  return {
    ...periodo,
    contrato: f.contrato || undefined,
    producto: f.producto || undefined,
    campania: f.campania || undefined,
    destinoCodigo: f.destinoCodigo || undefined,
  };
}
export function cursorResumen(f: GrupoResumen): CursorResumen {
  return {
    despuesFecha: f.fechaSolicitada,
    despuesDestinoCodigo: f.destinoCodigo,
    despuesContrato: f.contrato,
    despuesProducto: f.producto,
    despuesCampania: f.campania,
  };
}
export function claveResumen(f: GrupoResumen) {
  return JSON.stringify([f.fechaSolicitada, f.destinoCodigo, f.contrato, f.producto, f.campania]);
}
