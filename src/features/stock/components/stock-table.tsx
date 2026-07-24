import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { fecha, numero, usd } from "@/shared/format/format";
import { EstadoBadge } from "./estado-badge";
import { TipoBadge } from "./tipo-badge";
import { MinimoBadge } from "./minimo-badge";
import { VencimientoBadge } from "./vencimiento-badge";
import { ComprometidoCelda, DisponibleCelda, PorLlegarCelda } from "./celdas-disponibilidad";
import { StockLotes } from "./stock-lotes";
import type { StockItem, TipoDeposito } from "../types";

/**
 * Columnas de la tabla (para los `colSpan` de encabezado de grupo y detalle de lotes).
 *
 * Decisión de legibilidad: la disponibilidad son CUATRO números (stock, por llegar, facturado,
 * sin facturar) y la tabla ya venía cargada. Se muestran tres columnas — "Por llegar",
 * "Comprometido" (facturado + sin facturar, con el desglose en el `title`) y "Disponible" — en vez
 * de cuatro: facturado y sin facturar se leen siempre juntos (ambos restan y ninguno se puede
 * vender), mientras que "por llegar" suma y hay que verlo aparte para no confundir un cero de
 * stock con un quiebre. "Disponible" es la columna estrella y va destacada.
 */
const COLUMNAS = 13;

interface Grupo {
  deposito: number;
  nombre: string;
  tipo: TipoDeposito;
  items: StockItem[];
  valorUsd: number;
}

/** Agrupa por depósito conservando el orden de llegada (el backend ordena dep→rubro→codigo). */
function agruparPorDeposito(filas: StockItem[]): Grupo[] {
  const grupos: Grupo[] = [];
  for (const fila of filas) {
    let grupo = grupos.at(-1);
    if (!grupo || grupo.deposito !== fila.deposito) {
      // Nombre y tipo son por depósito: se toman del primer item del grupo.
      grupo = {
        deposito: fila.deposito,
        nombre: fila.depositoNombre,
        tipo: fila.tipoDeposito,
        items: [],
        valorUsd: 0,
      };
      grupos.push(grupo);
    }
    grupo.items.push(fila);
    grupo.valorUsd += fila.valorUsd;
  }
  return grupos;
}

export function StockTable({ filas }: { filas: StockItem[] }) {
  const [colapsados, setColapsados] = useState<Set<number>>(new Set());
  const toggle = (deposito: number) =>
    setColapsados((prev) => {
      const next = new Set(prev);
      if (next.has(deposito)) next.delete(deposito);
      else next.add(deposito);
      return next;
    });

  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const toggleFila = (key: string) =>
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const grupos = agruparPorDeposito(filas);

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-panel shadow-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-panel-soft text-xs uppercase tracking-wide text-ink-soft">
            <th className="px-3 py-2 text-left font-semibold">Código</th>
            <th className="px-3 py-2 text-left font-semibold">Producto</th>
            <th className="px-3 py-2 text-left font-semibold">Rubro</th>
            <th className="px-3 py-2 text-left font-semibold">Un.</th>
            <th className="px-3 py-2 text-right font-semibold">Stock</th>
            <th className="px-3 py-2 text-right font-semibold" title="Pedidos de compra pendientes de ingreso.">
              Por llegar
            </th>
            <th className="px-3 py-2 text-right font-semibold" title="Vendido y todavía en el galpón: facturado + sin facturar.">
              Comprom.
            </th>
            <th
              className="whitespace-nowrap bg-panel px-3 py-2 text-right font-semibold text-ink"
              title="Stock + por llegar − comprometido. En rojo cuando es negativo (sobreventa)."
            >
              Disponible
            </th>
            <th className="px-3 py-2 text-right font-semibold">Valor USD</th>
            <th className="px-3 py-2 text-right font-semibold">Días cob.</th>
            <th className="px-3 py-2 text-right font-semibold">Mínimo</th>
            <th className="px-3 py-2 text-center font-semibold">Vence</th>
            <th className="px-3 py-2 text-center font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => {
            const colapsado = colapsados.has(g.deposito);
            return (
              <Fragment key={g.deposito}>
                <tr className="border-b border-line bg-panel-soft/70">
                  <td colSpan={COLUMNAS} className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggle(g.deposito)}
                      aria-expanded={!colapsado}
                      className="flex w-full items-center gap-2 text-left font-semibold text-ink"
                    >
                      {colapsado ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                      Depósito {g.deposito} — {g.nombre}
                      <TipoBadge tipo={g.tipo} />
                      <span className="ml-2 text-xs font-normal text-ink-soft">
                        {g.items.length} art. · {usd(g.valorUsd)}
                      </span>
                    </button>
                  </td>
                </tr>
                {!colapsado &&
                  g.items.map((r) => {
                    const key = `${g.deposito}-${r.codigoArticulo}`;
                    const expandido = expandidos.has(key);
                    return (
                      <Fragment key={key}>
                        <tr className="border-b border-line-soft hover:bg-panel-soft/60">
                          <td className="whitespace-nowrap px-3 py-2 tabular">
                            {r.lotes.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => toggleFila(key)}
                                aria-expanded={expandido}
                                className="inline-flex items-center gap-1 text-ink"
                              >
                                {expandido ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                                {r.codigoArticulo}
                              </button>
                            ) : (
                              r.codigoArticulo
                            )}
                          </td>
                          <td className="max-w-[18rem] px-3 py-2">
                            <span className="block truncate font-medium text-ink" title={r.nombreProducto}>
                              {r.nombreProducto}
                            </span>
                          </td>
                          <td className="px-3 py-2">{r.rubroDesc}</td>
                          <td className="px-3 py-2">{r.unidad}</td>
                          <td className="px-3 py-2 text-right tabular">{numero(r.stockActual)}</td>
                          <td className="px-3 py-2 text-right">
                            <PorLlegarCelda item={r} />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <ComprometidoCelda item={r} />
                          </td>
                          <td className="bg-panel-soft/40 px-3 py-2 text-right">
                            <DisponibleCelda item={r} />
                          </td>
                          <td className="px-3 py-2 text-right tabular">{usd(r.valorUsd)}</td>
                          <td className="px-3 py-2 text-right tabular">{r.diasCobertura ?? "—"}</td>
                          <td className="px-3 py-2 text-right tabular">
                            {r.bajoMinimo ? <MinimoBadge /> : r.nivelMinimo > 0 ? numero(r.nivelMinimo) : null}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <VencimientoBadge estado={r.estadoVenc} />
                              {r.proximoVencimiento && (
                                <span className="text-xs text-ink-soft">{fecha(r.proximoVencimiento)}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <EstadoBadge estado={r.estado} />
                          </td>
                        </tr>
                        {expandido && r.lotes.length > 0 && (
                          <tr className="bg-panel-soft/40">
                            <td colSpan={COLUMNAS} className="px-3 pb-3 pt-1">
                              <StockLotes lotes={r.lotes} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
