import type { ReactNode } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/shared/components/error-state";
export interface Columna<T> {
  titulo: string;
  /** `indice` es la posición en la página; lo usa la columna de prioridad de la cola de entrega. */
  celda: (fila: T, indice: number) => ReactNode;
  numero?: boolean;
  /** Si se pasa, el encabezado es un botón que ordena la tabla por esta columna. */
  orden?: { activo: boolean; ordenar: () => void };
}
interface Props<T> {
  titulo: string;
  filas: T[];
  columnas: Columna<T>[];
  clave: (fila: T) => string;
  cargando?: boolean;
  error?: unknown;
  reintentar?: () => void;
  hayMas?: boolean;
  mas?: () => void;
  cargandoMas?: boolean;
  vacio?: string;
  /**
   * Pie propio de la tabla (p. ej. la navegación por páginas). Si se pasa, reemplaza al botón
   * "Cargar más filas": las dos cosas juntas serían dos formas de avanzar el mismo listado.
   */
  pie?: ReactNode;
  /**
   * Qué fila está elegida, para remarcarla.
   *
   * Es la única señal de la elección que hace falta: repetir la fila elegida en una tabla aparte o
   * en una línea de texto decía lo mismo que el casillero marcado.
   */
  elegida?: (fila: T) => boolean;
  /**
   * Un renglón por fila: sin cortes de línea y con menos aire. La tabla toma el ancho de lo que
   * muestra y se desplaza a lo ancho; los textos largos van con `Recortado`.
   */
  densa?: boolean;
}

/** Texto largo en una tabla densa: se corta con «…» y se lee entero al pasar el mouse. */
export function Recortado({
  texto,
  className = "max-w-56",
}: {
  texto: string | null | undefined;
  className?: string;
}) {
  if (!texto) return <>—</>;
  return (
    <span className={`block truncate ${className}`} title={texto}>
      {texto}
    </span>
  );
}
export function TablaLogistica<T>({
  titulo,
  filas,
  columnas,
  clave,
  cargando,
  error,
  reintentar,
  hayMas,
  mas,
  cargandoMas,
  vacio = "No hay registros en este período.",
  pie,
  elegida,
  densa = false,
}: Props<T>) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-panel shadow-card">
      {error != null && <ErrorState error={error} onRetry={reintentar} />}
      <div className="overflow-x-auto">
        <table
          className={`${densa ? "w-max min-w-full" : "w-full min-w-[700px]"} text-left text-sm`}
        >
          <caption className="sr-only">{titulo}</caption>
          <thead className="border-b border-line bg-panel-soft text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              {columnas.map((c) => (
                <th
                  key={c.titulo}
                  scope="col"
                  className={`${densa ? "whitespace-nowrap px-3 py-2" : "px-4 py-2.5"} font-semibold ${
                    c.numero ? "text-right" : ""
                  }`}
                  aria-sort={c.orden?.activo ? "other" : undefined}
                >
                  {c.orden ? (
                    <button
                      type="button"
                      onClick={c.orden.ordenar}
                      title={`Ordenar por ${c.titulo.toLowerCase()}`}
                      className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink ${
                        c.orden.activo ? "text-ink" : ""
                      }`}
                    >
                      {c.titulo}
                      <ArrowDown
                        aria-hidden
                        className={`size-3.5 ${c.orden.activo ? "" : "opacity-30"}`}
                      />
                    </button>
                  ) : (
                    c.titulo
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => {
              const activa = elegida?.(f) ?? false;
              return (
                <tr
                  key={clave(f)}
                  // Franjas alternadas y hover por encima, igual que la `DataTable` del resto de la
                  // app: seguir una fila con la vista es la mitad del trabajo de leer la tabla. La
                  // elegida se lleva el acento, con una guía a la izquierda para ubicarla de un vistazo.
                  className={`border-b border-line-soft last:border-0 hover:bg-line-soft/90 ${
                    activa
                      ? "bg-clementina/20 shadow-[inset_3px_0_0_0_var(--color-clementina-deep)]"
                      : i % 2 === 1
                        ? "bg-line-soft/45"
                        : ""
                  }`}
                >
                  {columnas.map((c) => (
                    <td
                      key={c.titulo}
                      className={`${
                        densa ? "whitespace-nowrap px-3 py-1.5 align-middle" : "px-4 py-3 align-top"
                      } ${c.numero ? "text-right tabular-nums" : ""} ${activa ? "font-medium" : ""}`}
                    >
                      {c.celda(f, i)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {cargando && (
        <p role="status" className="p-5 text-sm text-ink-soft">
          Consultando…
        </p>
      )}
      {!cargando && error == null && !filas.length && (
        <p className="p-6 text-sm text-ink-soft">{vacio}</p>
      )}
      {pie ? (
        <div className="border-t border-line">{pie}</div>
      ) : (
        hayMas && (
          <div className="border-t border-line p-3">
            <Button variant="outline" disabled={cargandoMas} onClick={mas}>
              {cargandoMas ? "Cargando…" : "Cargar más filas"}
            </Button>
          </div>
        )
      )}
    </section>
  );
}
