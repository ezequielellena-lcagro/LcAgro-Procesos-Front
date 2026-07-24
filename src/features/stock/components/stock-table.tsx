import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fecha, numero, usd } from "@/shared/format/format";
import { EstadoBadge } from "./estado-badge";
import { TipoBadge } from "./tipo-badge";
import { MinimoBadge } from "./minimo-badge";
import { VencimientoBadge } from "./vencimiento-badge";
import {
  ComprometidoCelda,
  CoberturaCelda,
  DisponibleCelda,
  PorLlegarCelda,
} from "./celdas-disponibilidad";
import { StockLotes } from "./stock-lotes";
import { COLUMNAS, ENCABEZADOS, STICKY_CODIGO, STICKY_PRODUCTO } from "./stock-table-columnas";
import type { StockItem, TipoDeposito } from "../types";

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

function Encabezados() {
  return (
    <thead>
      <tr className="border-b border-line bg-panel-soft text-xs uppercase tracking-wide text-ink-soft">
        {ENCABEZADOS.map((h) => (
          <th
            key={h.label}
            title={h.title}
            className={cn("px-3 py-2 font-semibold", h.className, h.className?.includes("sticky") && "bg-panel-soft")}
          >
            {h.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** Renglón de depósito: colapsa/expande sus artículos y muestra el subtotal en USD. */
function EncabezadoGrupo({
  grupo,
  colapsado,
  onToggle,
}: {
  grupo: Grupo;
  colapsado: boolean;
  onToggle: () => void;
}) {
  return (
    <tr className="border-b border-line bg-panel-soft/70">
      <td colSpan={COLUMNAS} className="px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!colapsado}
          className="flex w-full items-center gap-2 text-left font-semibold text-ink"
        >
          {colapsado ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
          Depósito {grupo.deposito} — {grupo.nombre}
          <TipoBadge tipo={grupo.tipo} />
          <span className="ml-2 text-xs font-normal text-ink-soft">
            {grupo.items.length} art. · {usd(grupo.valorUsd)}
          </span>
        </button>
      </td>
    </tr>
  );
}

/** Un artículo en un depósito. Las 13 celdas de la fila, en el orden de `ENCABEZADOS`. */
function FilaArticulo({
  fila,
  expandido,
  onToggle,
}: {
  fila: StockItem;
  expandido: boolean;
  onToggle: () => void;
}) {
  return (
    <tr className="border-b border-line-soft hover:bg-panel-soft/60">
      <td className={cn("whitespace-nowrap bg-panel px-3 py-2 tabular", STICKY_CODIGO)}>
        {fila.lotes.length > 0 ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expandido}
            className="inline-flex items-center gap-1 text-ink"
          >
            {expandido ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            {fila.codigoArticulo}
          </button>
        ) : (
          fila.codigoArticulo
        )}
      </td>
      <td className={cn("bg-panel px-3 py-2", STICKY_PRODUCTO)}>
        <span className="block truncate font-medium text-ink" title={fila.nombreProducto}>
          {fila.nombreProducto}
        </span>
      </td>
      <td className="px-3 py-2">{fila.rubroDesc}</td>
      <td className="px-3 py-2">{fila.unidad}</td>
      <td className="px-3 py-2 text-right tabular">{numero(fila.stockActual)}</td>
      <td className="px-3 py-2 text-right">
        <PorLlegarCelda item={fila} />
      </td>
      <td className="px-3 py-2 text-right">
        <ComprometidoCelda item={fila} />
      </td>
      <td className="bg-panel-soft/40 px-3 py-2 text-right">
        <DisponibleCelda item={fila} />
      </td>
      <td className="px-3 py-2 text-right tabular">{usd(fila.valorUsd)}</td>
      <td className="px-3 py-2 text-right">
        <CoberturaCelda item={fila} />
      </td>
      <td className="px-3 py-2 text-right tabular">
        {fila.bajoMinimo ? <MinimoBadge /> : fila.nivelMinimo > 0 ? numero(fila.nivelMinimo) : null}
      </td>
      <td className="px-3 py-2 text-center">
        <div className="flex flex-col items-center gap-0.5">
          <VencimientoBadge estado={fila.estadoVenc} />
          {fila.proximoVencimiento && (
            <span className="text-xs text-ink-soft">{fecha(fila.proximoVencimiento)}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-center">
        <EstadoBadge estado={fila.estado} />
      </td>
    </tr>
  );
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
    // `print:overflow-visible`: al imprimir/guardar como PDF el scroll no existe y el recorte se
    // comería la cola de columnas sin ningún aviso.
    <div className="overflow-x-auto rounded-card border border-line bg-panel shadow-card print:overflow-visible">
      <table className="w-full border-collapse text-sm">
        <Encabezados />
        <tbody>
          {grupos.map((g) => {
            const colapsado = colapsados.has(g.deposito);
            return (
              <Fragment key={g.deposito}>
                <EncabezadoGrupo grupo={g} colapsado={colapsado} onToggle={() => toggle(g.deposito)} />
                {!colapsado &&
                  g.items.map((r) => {
                    const key = `${g.deposito}-${r.codigoArticulo}`;
                    const expandido = expandidos.has(key);
                    return (
                      <Fragment key={key}>
                        <FilaArticulo fila={r} expandido={expandido} onToggle={() => toggleFila(key)} />
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
