import type { EvolucionMes } from "../types";

export interface CampaniaEnMes {
  /** % de posición acumulado de la campaña a ese mes. null si todavía no tiene compra y venta con precio. */
  pct: number | null;
  resultado: number;
  valor: number;
  /** Puntos porcentuales que cambió contra el mes anterior. */
  deltaPp: number | null;
}

export interface PuntoEvolucion {
  mes: string;
  porCampania: Record<string, CampaniaEnMes>;
  /** Suma de los resultados de todas las campañas (cada una con sus propios precios). */
  resultadoTotal: number;
  pctTotal: number | null;
  /** Lo que sumó o restó el total en el mes. */
  resultadoMes: number;
}

/** "2025-11" → "2025-12"; "2025-12" → "2026-01". */
export function mesSiguiente(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

export function cerealesDe(filas: EvolucionMes[]): string[] {
  return [...new Set(filas.map((f) => f.cereal))].sort((a, b) => a.localeCompare(b, "es"));
}

interface Acumulado {
  tc: number;
  tcp: number;
  usdc: number;
  tv: number;
  tvp: number;
  usdv: number;
}

/**
 * Acumula los incrementos mes a mes y recalcula la fórmula de posición completa en cada mes, campaña
 * por campaña: calzadas = mín(compras, ventas) por cereal, margen por cereal antes de sumar, sobre el
 * valor de las compras. El último mes de cada campaña da igual que su tarjeta (doc 14 §2.4). El total
 * suma resultados; nunca promedia precios de años distintos.
 */
export function acumular(
  filas: EvolucionMes[],
  cereales?: ReadonlySet<string> | null,
): PuntoEvolucion[] {
  const usadas = cereales ? filas.filter((f) => cereales.has(f.cereal)) : filas;
  if (usadas.length === 0) return [];

  const porMes = new Map<string, EvolucionMes[]>();
  for (const f of usadas) porMes.set(f.mes, [...(porMes.get(f.mes) ?? []), f]);
  const ordenados = [...porMes.keys()].sort();
  const ultimo = ordenados.at(-1)!;

  const acc = new Map<string, Map<string, Acumulado>>(); // campaña → cereal → acumulado
  const pctAnterior = new Map<string, number | null>();
  const puntos: PuntoEvolucion[] = [];
  let resultadoAnterior = 0;

  for (let mes = ordenados[0]; ; mes = mesSiguiente(mes)) {
    for (const f of porMes.get(mes) ?? []) {
      const deCampania = acc.get(f.campania) ?? new Map<string, Acumulado>();
      acc.set(f.campania, deCampania);
      const a = deCampania.get(f.cereal) ?? { tc: 0, tcp: 0, usdc: 0, tv: 0, tvp: 0, usdv: 0 };
      deCampania.set(f.cereal, {
        tc: a.tc + f.tnC,
        tcp: a.tcp + f.tnCP,
        usdc: a.usdc + f.usdC,
        tv: a.tv + f.tnV,
        tvp: a.tvp + f.tnVP,
        usdv: a.usdv + f.usdV,
      });
    }

    const porCampania: Record<string, CampaniaEnMes> = {};
    let resultadoTotal = 0;
    let valorTotal = 0;
    for (const [campania, deCampania] of acc) {
      let resultado = 0;
      let valor = 0;
      for (const a of deCampania.values()) {
        if (a.tcp <= 0 || a.tvp <= 0) continue;
        const pc = a.usdc / a.tcp;
        const pv = a.usdv / a.tvp;
        const calz = Math.min(a.tc, a.tv);
        valor += calz * pc;
        resultado += (pv - pc) * calz;
      }
      const pct = valor > 0 ? (resultado / valor) * 100 : null;
      const previo = pctAnterior.get(campania);
      porCampania[campania] = {
        pct,
        resultado,
        valor,
        deltaPp: pct != null && previo != null ? pct - previo : null,
      };
      pctAnterior.set(campania, pct);
      resultadoTotal += resultado;
      valorTotal += valor;
    }

    puntos.push({
      mes,
      porCampania,
      resultadoTotal,
      pctTotal: valorTotal > 0 ? (resultadoTotal / valorTotal) * 100 : null,
      resultadoMes: resultadoTotal - resultadoAnterior,
    });
    resultadoAnterior = resultadoTotal;
    if (mes === ultimo) break;
  }
  return puntos;
}
