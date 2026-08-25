/**
 * Cómo se reparte el crecimiento entre vendedores.
 *
 * Un porcentaje plano para todos suena justo y no lo es: pedirle +20 % a un vendedor que ya
 * capta el 78 % del bolsillo de su cartera lo obliga a llegar al 94 %, mientras que al que
 * capta el 12 % le alcanza con llegar al 14,4 %. El mismo número es casi imposible para uno
 * y trivial para el otro.
 *
 * El reparto por oportunidad usa la fórmula que **ya está en el backend**
 * (`appsettings.json` → `VolumenAcopiado`), donde se documenta así:
 *
 *   "Objetivo sugerido = base + (1 − penetración) × FactorDormidos:
 *    más exigencia a quien tiene cartera para reactivar."
 */
import type { ModoReparto, ObjetivoLinea, ObjetivoVendedorCalculado, ProductorCalculado } from "../types";

/** `VolumenAcopiado:FactorDormidos` — cuánto se premia tener cartera sin capturar. */
export const FACTOR_OPORTUNIDAD = 0.15;

/** Base de la campaña anterior sobre la que se aplica el crecimiento. */
function baseDe(p: ProductorCalculado, linea: ObjetivoLinea): number {
  const bruto =
    linea.base === "lc" ? p.lcPrev : linea.base === "bayer" ? p.bayerPrev : p.lcPrev + p.bayerPrev;
  return bruto * (linea.proporcionBase ?? 0);
}

/** Real acumulado de la campaña en curso, para la misma línea. */
function realDe(p: ProductorCalculado, linea: ObjetivoLinea): number {
  const bruto = linea.base === "lc" ? p.lc : linea.base === "bayer" ? p.bayer : p.total;
  return bruto * (linea.proporcionBase ?? 0);
}

/**
 * Baja el objetivo de una línea a cada vendedor.
 *
 * En modo "plano" todos reciben el mismo porcentaje. En modo "oportunidad" el porcentaje se
 * ajusta por la participación de su cartera y después **se reescala para que el total de la
 * compañía sea el mismo**: no cambia cuánto se pide, cambia a quién.
 */
export function objetivosPorVendedor(
  productores: ProductorCalculado[],
  linea: ObjetivoLinea,
  modo: ModoReparto,
): ObjetivoVendedorCalculado[] {
  const porVendedor = new Map<string, ProductorCalculado[]>();
  for (const p of productores) {
    const lista = porVendedor.get(p.vendedor) ?? [];
    lista.push(p);
    porVendedor.set(p.vendedor, lista);
  }

  const filas = [...porVendedor.entries()].map(([vendedor, ps]) => {
    const suma = (f: (p: ProductorCalculado) => number) => ps.reduce((t, p) => t + f(p), 0);
    const mercado = suma((p) => p.mercado);
    const previo = suma((p) => baseDe(p, linea));
    const real = suma((p) => realDe(p, linea));
    const participacion = mercado > 0 ? Math.min(suma((p) => p.total) / mercado, 1) : 1;

    return { vendedor, productores: ps.length, mercado, previo, real, participacion };
  });

  const totalPlano = filas.reduce((t, f) => t + f.previo * (1 + linea.crecimiento), 0);

  if (modo === "plano") {
    return filas.map((f) => {
      const objetivo = f.previo * (1 + linea.crecimiento);
      return {
        ...f,
        crecimiento: linea.crecimiento,
        objetivo,
        objetivoPlano: objetivo,
        avance: objetivo > 0 ? f.real / objetivo : 0,
      };
    });
  }

  // Crecimiento ajustado, antes de reescalar.
  const crudos = filas.map((f) => {
    const crecimiento = linea.crecimiento + (1 - f.participacion) * FACTOR_OPORTUNIDAD;
    return { fila: f, crecimiento, objetivo: f.previo * (1 + crecimiento) };
  });

  // Reescala para conservar el total: el objetivo de la compañía no lo decide la fórmula.
  const totalCrudo = crudos.reduce((t, c) => t + c.objetivo, 0);
  const ajuste = totalCrudo > 0 ? totalPlano / totalCrudo : 1;

  return crudos.map(({ fila, objetivo }) => {
    const final = objetivo * ajuste;
    return {
      ...fila,
      crecimiento: fila.previo > 0 ? final / fila.previo - 1 : linea.crecimiento,
      objetivo: final,
      objetivoPlano: fila.previo * (1 + linea.crecimiento),
      avance: final > 0 ? fila.real / final : 0,
    };
  });
}

/**
 * ¿Las líneas se contradicen entre sí?
 *
 * "Facturación general" contiene a "Facturación La Clementina": si a LC se le pide +13 % y al
 * total +20 %, Bayer queda obligado a un crecimiento que nadie escribió y que puede no tener
 * nada que ver con lo que dicen las líneas de Bayer. El Excel no lo detecta.
 */
export function revisarCoherencia(
  productores: ProductorCalculado[],
  lineas: ObjetivoLinea[],
): { implicitoBayer: number; declaradoBayer: number | null } | null {
  const agregada = lineas.find((l) => l.esAgregada);
  const lc = lineas.find((l) => l.base === "lc" && !l.esAgregada);
  if (!agregada || !lc) return null;

  const totalPrev = productores.reduce((t, p) => t + p.lcPrev + p.bayerPrev, 0);
  const lcPrev = productores.reduce((t, p) => t + p.lcPrev, 0);
  const bayerPrev = totalPrev - lcPrev;
  if (bayerPrev <= 0) return null;

  const objTotal = totalPrev * (1 + agregada.crecimiento);
  const objLc = lcPrev * (1 + lc.crecimiento);
  const implicitoBayer = (objTotal - objLc) / bayerPrev - 1;

  // Lo que declaran las líneas de Bayer que sí tienen base medible.
  const medibles = lineas.filter((l) => l.base === "bayer" && l.proporcionBase != null);
  const declaradoBayer = medibles.length
    ? medibles.reduce((t, l) => t + l.crecimiento * (l.proporcionBase ?? 0), 0) /
      medibles.reduce((t, l) => t + (l.proporcionBase ?? 0), 0)
    : null;

  return { implicitoBayer, declaradoBayer };
}
