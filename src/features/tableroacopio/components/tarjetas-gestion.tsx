import { cn } from "@/lib/utils";
import { dos, entero, formatoIndicador, formatoObjetivo, usd0 } from "../lib/formato";
import { estadoIndicador, INDICADORES, valorIndicador, type IndicadorClave } from "../lib/semaforo";
import type { AcopiadoExcluido, CampaniaTablero } from "../types";
import { EstadoBadge } from "./estado-badge";

/**
 * El dato de apoyo de cada tarjeta: de dónde sale el número. Corto, porque las seis van en una fila;
 * lo que no entra queda en el tooltip (`completo`).
 */
function detalle(
  c: CampaniaTablero,
  clave: IndicadorClave,
  excluido: AcopiadoExcluido | undefined,
): { corto: string; completo?: string } {
  switch (clave) {
    case "gananciaPosicionPct":
      return {
        corto:
          c.resultadoUsd == null
            ? "sin compra y venta con precio"
            : `${usd0(c.resultadoUsd)} · ${entero(c.tnCalzadas ?? 0)} tn calzadas · ${
                c.posicionConArrastre ? "con arrastre" : "sin arrastre"
              }`,
      };
    case "comisionPct": {
      if (c.comisionPct == null) return { corto: "sin liquidaciones" };
      const deducciones = (c.pagadasPp ?? 0) + (c.iibbPp ?? 0) + (c.impuestoDcPp ?? 0);
      const desglose = `bruta ${dos(c.comisionPct)} − corredores ${dos(c.pagadasPp ?? 0)} − IIBB ${dos(
        c.iibbPp ?? 0,
      )} − impuesto a los débitos y créditos ${dos(c.impuestoDcPp ?? 0)}`;
      // Con el impuesto incompleto el neto todavía va a bajar: eso es lo que hay que ver en la tarjeta.
      return c.netoCompleto
        ? {
            corto: `bruta ${dos(c.comisionPct)} − ${dos(deducciones)} de deducciones`,
            completo: desglose,
          }
        : {
            corto: `⚠ impuesto cargado ${c.impuestoDcMeses}/12 meses`,
            completo: `Impuesto a los débitos y créditos con ${c.impuestoDcMeses} de 12 meses: el neto puede bajar. ${desglose}`,
          };
    }
    case "rotacion":
      return { corto: `${entero(c.tnP15 ?? 0)} tn en planta 15` };
    case "tnPreventas":
      return { corto: `${entero(c.contratosPreventa ?? 0)} contratos` };
    case "tnAcopiadas": {
      if (!excluido || !c.tnAcopiadas)
        return { corto: `${entero(c.productores ?? 0)} productores` };
      const pct = (excluido.exclCorte / c.tnAcopiadas) * 100;
      return { corto: `${entero(pct)} % vinculadas: no mide logro comercial` };
    }
    case "nuevosClientes":
      return { corto: `${entero(c.tnDeNuevos ?? 0)} tn aportadas` };
  }
}

/** Las seis tarjetas de la campaña, en una sola fila en pantalla ancha. */
export function TarjetasGestion({
  campania,
  excluido,
}: {
  campania: CampaniaTablero;
  excluido: AcopiadoExcluido | undefined;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6 print:grid-cols-3">
      {INDICADORES.map(({ clave, nombre }) => {
        const estado = estadoIndicador(campania, clave);
        const apoyo = detalle(campania, clave, excluido);
        return (
          <div
            key={clave}
            className={cn(
              "flex flex-col rounded-card border border-t-4 border-line bg-panel px-3 py-2.5 shadow-card",
              estado === "cumple" && "border-t-verde",
              estado === "no-cumple" && "border-t-rojo",
              estado === "en-curso" && "border-t-clementina",
            )}
          >
            <div
              className="line-clamp-2 min-h-[2.5em] text-[11px] font-medium uppercase leading-tight tracking-wide text-ink-soft"
              title={nombre}
            >
              {nombre}
            </div>
            <div className="mt-0.5 font-display text-2xl font-semibold leading-tight tabular text-ink">
              {formatoIndicador(clave, valorIndicador(campania, clave))}
            </div>
            <div className="mt-1 flex items-center justify-between gap-1 text-[11px] text-ink-soft">
              <span className="truncate">{formatoObjetivo(clave, campania.objetivos[clave])}</span>
              <EstadoBadge estado={estado} />
            </div>
            <div
              className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-soft"
              title={apoyo.completo ?? apoyo.corto}
            >
              {apoyo.corto}
            </div>
          </div>
        );
      })}
    </div>
  );
}
