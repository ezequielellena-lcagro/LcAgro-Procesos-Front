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
}: Props<T>) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-panel">
      {error != null && <ErrorState error={error} onRetry={reintentar} />}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <caption className="sr-only">{titulo}</caption>
          <thead className="border-b border-line bg-secondary text-xs text-ink-soft">
            <tr>
              {columnas.map((c) => (
                <th
                  key={c.titulo}
                  scope="col"
                  className={`px-4 py-3 font-medium ${c.numero ? "text-right" : ""}`}
                >
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filas.map((f) => (
              <tr key={clave(f)} className="hover:bg-secondary/70">
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
      {hayMas && (
        <div className="border-t border-line p-3">
          <Button variant="outline" disabled={cargandoMas} onClick={mas}>
            {cargandoMas ? "Cargando…" : "Cargar más filas"}
          </Button>
        </div>
      )}
    </section>
  );
}
