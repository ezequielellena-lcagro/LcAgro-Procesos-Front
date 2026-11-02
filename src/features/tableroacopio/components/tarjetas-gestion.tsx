import { cn } from "@/lib/utils";
import { conSigno, dos, entero, formatoIndicador, formatoObjetivo, usd0 } from "../lib/formato";
import { estadoIndicador, INDICADORES, valorIndicador, type IndicadorClave } from "../lib/semaforo";
import type { AcopiadoExcluido, CampaniaTablero } from "../types";
import { EstadoBadge } from "./estado-badge";

/** El dato de apoyo de cada tarjeta: de dónde sale el número. */
function detalle(
  c: CampaniaTablero,
  clave: IndicadorClave,
  excluido: AcopiadoExcluido | undefined,
): string {
  switch (clave) {
    case "gananciaPosicionPct":
      return c.resultadoUsd == null
        ? "sin compra y venta con precio"
        : `${usd0(c.resultadoUsd)} sobre ${entero(c.tnCalzadas ?? 0)} tn calzadas · ${
            c.posicionConArrastre ? "con arrastre" : "sin arrastre"
          }`;
    case "comisionPct": {
      if (c.comisionPct == null) return "sin liquidaciones";
      const partes = `bruta ${conSigno(c.comisionPct)} − pagadas ${dos(c.pagadasPp ?? 0)} − IIBB ${dos(
        c.iibbPp ?? 0,
      )} − imp. DC ${dos(c.impuestoDcPp ?? 0)}`;
      return c.netoCompleto ? partes : `${partes} · ⚠ impuesto ${c.impuestoDcMeses}/12 meses`;
    }
    case "rotacion":
      return `${entero(c.tnP15 ?? 0)} tn en planta 15`;
    case "tnPreventas":
      return `${entero(c.contratosPreventa ?? 0)} contratos`;
    case "tnAcopiadas": {
      if (!excluido || !c.tnAcopiadas) return `${entero(c.productores ?? 0)} productores`;
      const pct = (excluido.exclCorte / c.tnAcopiadas) * 100;
      return `${entero(pct)} % son vinculadas: no mide logro comercial`;
    }
    case "nuevosClientes":
      return `${entero(c.tnDeNuevos ?? 0)} tn aportadas`;
  }
}

export function TarjetasGestion({
  campania,
  excluido,
}: {
  campania: CampaniaTablero;
  excluido: AcopiadoExcluido | undefined;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {INDICADORES.map(({ clave, nombre }) => {
        const estado = estadoIndicador(campania, clave);
        return (
          <div
            key={clave}
            className={cn(
              "rounded-card border border-line bg-panel p-4 shadow-card",
              estado === "cumple" && "border-t-4 border-t-verde",
              estado === "no-cumple" && "border-t-4 border-t-rojo",
              estado === "en-curso" && "border-t-4 border-t-clementina",
            )}
          >
            <div className="text-xs font-medium uppercase tracking-wide text-ink-soft">
              {nombre}
            </div>
            <div className="mt-1 font-display text-3xl font-semibold tabular text-ink">
              {formatoIndicador(clave, valorIndicador(campania, clave))}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-ink-soft">
              <span>{formatoObjetivo(clave, campania.objetivos[clave])}</span>
              <EstadoBadge estado={estado} />
            </div>
            <div className="mt-2 text-xs text-ink-soft">{detalle(campania, clave, excluido)}</div>
          </div>
        );
      })}
    </div>
  );
}
