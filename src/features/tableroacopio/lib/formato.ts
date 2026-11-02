import type { IndicadorClave } from "./semaforo";

const num0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const num2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signo2 = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

export const entero = (n: number) => num0.format(n);
export const dos = (n: number) => num2.format(n);
export const conSigno = (n: number) => signo2.format(n);
export const usd0 = (n: number) => `US$ ${num0.format(n)}`;

/** El valor de un indicador como se lee en la tarjeta. */
export function formatoIndicador(clave: IndicadorClave, valor: number | null): string {
  if (valor == null) return "—";
  switch (clave) {
    case "gananciaPosicionPct":
    case "comisionPct":
      return `${conSigno(valor)} %`;
    case "rotacion":
      return dos(valor);
    case "tnPreventas":
    case "tnAcopiadas":
      return `${entero(valor)} tn`;
    case "nuevosClientes":
      return entero(valor);
  }
}

/** "≥ 1,50 %" · "≥ 100.000 tn" · "sin objetivo". */
export function formatoObjetivo(clave: IndicadorClave, objetivo: number | null): string {
  if (objetivo == null) return "sin objetivo";
  switch (clave) {
    case "gananciaPosicionPct":
    case "comisionPct":
      return `≥ ${dos(objetivo)} %`;
    case "rotacion":
      return `≥ ${dos(objetivo)}`;
    case "tnPreventas":
    case "tnAcopiadas":
      return `≥ ${entero(objetivo)} tn`;
    case "nuevosClientes":
      return `≥ ${entero(objetivo)}`;
  }
}
