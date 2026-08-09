import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  /**
   * Si se pasa, la columna se puede ordenar clickeando su encabezado. Devolvé el valor CRUDO
   * (número, fecha ISO, texto) y no lo ya formateado: "1.174.463,69" ordena mal como texto.
   * `null` es "sin dato" y siempre queda al final.
   */
  sortBy?: (row: T) => string | number | null | undefined;
}

/** Cómo se parten las filas en grupos, y qué dice el encabezado de cada uno. */
export interface GroupBy<T> {
  /** Filas con la misma clave van al mismo grupo, en el orden en que aparece cada clave. */
  clave: (row: T) => string;
  titulo: (primera: T, filas: T[]) => ReactNode;
  /** Fila de subtotal del grupo: una celda por columna, como `footer`. */
  subtotal?: (filas: T[]) => ReactNode[];
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string | number;
  empty?: ReactNode;
  /** Celdas de la fila de totales (una por columna). Se muestra solo si hay filas. */
  footer?: ReactNode[];
  /** Si se pasa, cada fila es clickeable (cursor + rol de botón) y dispara este callback. */
  onRowClick?: (row: T) => void;
  /** Clases extra por fila (p. ej. para resaltar la fila seleccionada). */
  rowClassName?: (row: T, index: number) => string;
  /** Si se pasa, las filas se muestran agrupadas. El orden por columna actúa dentro del grupo. */
  groupBy?: GroupBy<T>;
}

type Sentido = "asc" | "desc";

function alignCls(a?: "left" | "right" | "center") {
  return a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";
}

// Una sola instancia: crear un Intl.Collator por comparación es caro y acá se llama en bucle.
const colador = new Intl.Collator("es-AR", { numeric: true, sensitivity: "base" });

/**
 * Compara dos valores de celda. Los vacíos van al final SIEMPRE — también al invertir: "sin dato"
 * no es un valor chico, es la ausencia de uno, y arrastrarlo al principio esconde las filas útiles.
 */
function comparar(a: unknown, b: unknown, sentido: Sentido): number {
  const vacioA = a === null || a === undefined || a === "";
  const vacioB = b === null || b === undefined || b === "";
  if (vacioA || vacioB) return vacioA && vacioB ? 0 : vacioA ? 1 : -1;

  const signo = sentido === "asc" ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * signo;
  return colador.compare(String(a), String(b)) * signo;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  empty,
  footer,
  onRowClick,
  rowClassName,
  groupBy,
}: DataTableProps<T>) {
  const [orden, setOrden] = useState<{ key: string; sentido: Sentido } | null>(null);

  // Tres estados por columna: ascendente → descendente → como vino. El tercer clic devuelve el
  // orden natural (el calendario, en la tabla de vencimientos) sin tener que recargar.
  const alternar = (key: string) =>
    setOrden((previo) => {
      if (previo?.key !== key) return { key, sentido: "asc" };
      return previo.sentido === "asc" ? { key, sentido: "desc" } : null;
    });

  const ordenadas = useMemo(() => {
    if (!orden) return rows;
    const columna = columns.find((c) => c.key === orden.key);
    if (!columna?.sortBy) return rows;
    // toSorted: no muta el array que nos pasaron.
    return rows.toSorted((a, b) => comparar(columna.sortBy!(a), columna.sortBy!(b), orden.sentido));
  }, [rows, orden, columns]);

  // Grupos en el orden en que aparece cada clave: agrupar no reordena por su cuenta, sólo junta.
  const grupos = useMemo(() => {
    if (!groupBy) return null;
    const mapa = new Map<string, T[]>();
    for (const row of ordenadas) {
      const clave = groupBy.clave(row);
      const actual = mapa.get(clave);
      if (actual) actual.push(row);
      else mapa.set(clave, [row]);
    }
    return [...mapa.entries()];
  }, [ordenadas, groupBy]);

  const celdas = (row: T) =>
    columns.map((c) => (
      <td key={c.key} className={cn("px-3 py-2 tabular", alignCls(c.align), c.className)}>
        {c.cell(row)}
      </td>
    ));

  const fila = (row: T, i: number) => (
    <tr
      key={getRowKey(row, i)}
      className={cn(
        "border-b border-line-soft last:border-0 hover:bg-panel-soft/60",
        onRowClick && "cursor-pointer",
        rowClassName?.(row, i),
      )}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
    >
      {celdas(row)}
    </tr>
  );

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-panel shadow-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-panel-soft text-xs uppercase tracking-wide text-ink-soft">
            {columns.map((c) => {
              const activa = orden?.key === c.key;
              return (
                <th
                  key={c.key}
                  aria-sort={
                    !c.sortBy
                      ? undefined
                      : !activa
                        ? "none"
                        : orden.sentido === "asc"
                          ? "ascending"
                          : "descending"
                  }
                  className={cn("px-3 py-2 font-semibold", alignCls(c.align), c.className)}
                >
                  {c.sortBy ? (
                    <button
                      type="button"
                      onClick={() => alternar(c.key)}
                      className={cn(
                        "group inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink",
                        activa && "text-ink",
                        c.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {c.header}
                      {activa ? (
                        orden.sentido === "asc" ? (
                          <ArrowUp className="size-3" aria-hidden />
                        ) : (
                          <ArrowDown className="size-3" aria-hidden />
                        )
                      ) : (
                        // Sólo al pasar el mouse: la flecha en cada encabezado sería ruido.
                        <ChevronsUpDown
                          className="size-3 opacity-0 transition-opacity group-hover:opacity-60"
                          aria-hidden
                        />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {ordenadas.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3.5 py-10 text-center text-ink-soft">
                {empty ?? "Sin datos."}
              </td>
            </tr>
          ) : grupos ? (
            grupos.map(([clave, filas]) => (
              <Grupo
                key={clave}
                titulo={groupBy!.titulo(filas[0], filas)}
                subtotal={groupBy!.subtotal?.(filas)}
                columns={columns}
              >
                {filas.map(fila)}
              </Grupo>
            ))
          ) : (
            ordenadas.map(fila)
          )}
        </tbody>

        {footer && ordenadas.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-line bg-panel-soft font-semibold text-ink">
              {columns.map((c, i) => (
                <td key={c.key} className={cn("px-3 py-2 tabular", alignCls(c.align), c.className)}>
                  {footer[i]}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Un grupo: su encabezado, sus filas y, si corresponde, su subtotal. */
function Grupo<T>({
  titulo,
  subtotal,
  columns,
  children,
}: {
  titulo: ReactNode;
  subtotal?: ReactNode[];
  columns: Column<T>[];
  children: ReactNode;
}) {
  return (
    <>
      <tr className="border-b border-line bg-panel-soft/80">
        <th
          scope="colgroup"
          colSpan={columns.length}
          className="px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-ink"
        >
          {titulo}
        </th>
      </tr>
      {children}
      {subtotal && (
        <tr className="border-b border-line bg-panel-soft/40 text-ink">
          {columns.map((c, i) => (
            <td
              key={c.key}
              className={cn("px-3 py-1.5 tabular font-semibold", alignCls(c.align), c.className)}
            >
              {subtotal[i]}
            </td>
          ))}
        </tr>
      )}
    </>
  );
}
