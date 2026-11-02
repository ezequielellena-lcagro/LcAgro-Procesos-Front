import { cn } from "@/lib/utils";
import { entero, formatoIndicador, formatoObjetivo } from "../lib/formato";
import { CLASE_ESTADO, estadoIndicador, INDICADORES, valorIndicador } from "../lib/semaforo";
import type { CampaniaTablero } from "../types";

/** Cómo viene cada campaña: la titular, si está provisoria o definitiva, o si no llegó al corte. */
function rotulo(c: CampaniaTablero): string {
  if (c.preCorte) return "todavía no llegó al corte";
  const estado = c.definitiva
    ? "definitiva"
    : `provisoria · faltan ${entero(c.tnSinPrecio ?? 0)} tn por fijar`;
  return c.titular ? `titular · ${estado}` : estado;
}

/**
 * Cada indicador contra su objetivo, campaña por campaña, al mismo corte. La campaña elegida va
 * resaltada; las anteriores al inicio del arrastre muestran la posición sola.
 */
export function SerieCampanias({
  campanias,
  seleccionada,
  corte,
}: {
  campanias: CampaniaTablero[];
  seleccionada: string;
  corte: string;
}) {
  const columnas = [...campanias].reverse();
  return (
    <div className="rounded-card border border-line bg-panel shadow-card">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-display text-lg font-semibold text-ink">Serie por campaña</h2>
        <p className="text-xs text-ink-soft">
          Cada indicador contra su objetivo. Los volúmenes se miden al <b>{corte}</b> de cada
          campaña: así la campaña en curso se compara contra el mismo punto de las anteriores y no
          contra su cierre.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-soft">
              <th className="px-4 py-2 font-medium">Indicador</th>
              {columnas.map((c) => (
                <th
                  key={c.campania}
                  className={cn(
                    "px-3 py-2 text-right font-medium",
                    c.campania === seleccionada && "bg-panel-soft",
                  )}
                >
                  <div className="text-ink">{c.campania}</div>
                  <div className="text-[11px] font-normal">{rotulo(c)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {INDICADORES.map(({ clave, nombre }) => (
              <tr key={clave} className="border-b border-line-soft last:border-0">
                <td className="px-4 py-2 font-medium text-ink">{nombre}</td>
                {columnas.map((c) => {
                  const estado = estadoIndicador(c, clave);
                  const sinArrastre =
                    clave === "gananciaPosicionPct" &&
                    !c.posicionConArrastre &&
                    c.gananciaPosicionPct != null;
                  return (
                    <td
                      key={c.campania}
                      className={cn(
                        "px-3 py-2 text-right tabular",
                        c.campania === seleccionada && "bg-panel-soft",
                      )}
                    >
                      <div className={cn("font-semibold", CLASE_ESTADO[estado])}>
                        {formatoIndicador(clave, valorIndicador(c, clave))}
                      </div>
                      <div className="text-[11px] text-ink-soft">
                        {formatoObjetivo(clave, c.objetivos[clave])}
                        {sinArrastre && " · sin arrastre"}
                        {clave === "comisionPct" &&
                          c.comisionPctNeta != null &&
                          !c.netoCompleto &&
                          " · incompleto"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
