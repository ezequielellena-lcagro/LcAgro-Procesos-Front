import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/shared/components/error-state";
export interface Columna<T> {
  titulo: string;
  celda: (fila: T) => ReactNode;
  numero?: boolean;
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
}: Props<T>) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-panel shadow-card">
      {error != null && <ErrorState error={error} onRetry={reintentar} />}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <caption className="sr-only">{titulo}</caption>
          <thead className="border-b border-line bg-panel-soft text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              {columnas.map((c) => (
                <th
                  key={c.titulo}
                  scope="col"
                  className={`px-4 py-2.5 font-semibold ${c.numero ? "text-right" : ""}`}
                >
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr
                key={clave(f)}
                // Franjas alternadas y hover por encima, igual que la `DataTable` del resto de la
                // app: seguir una fila con la vista es la mitad del trabajo de leer la tabla.
                className={`border-b border-line-soft last:border-0 hover:bg-line-soft/90 ${
                  i % 2 === 1 ? "bg-line-soft/45" : ""
                }`}
              >
                {columnas.map((c) => (
                  <td
                    key={c.titulo}
                    className={`px-4 py-3 align-top ${c.numero ? "text-right tabular-nums" : ""}`}
                  >
                    {c.celda(f)}
                  </td>
                ))}
              </tr>
            ))}
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
