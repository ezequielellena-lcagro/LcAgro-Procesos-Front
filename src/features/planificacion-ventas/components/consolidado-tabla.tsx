import { ChevronDown, ChevronRight } from "lucide-react";
import { numero, numero3, pct, usd } from "@/shared/format/format";
import { columnasConsolidado, type Columna, type LineaConsolidado } from "../lib/consolidado";

function mostrar(valor: string | number | null, formato?: Columna["format"]): string {
  if (valor === null) return "—";
  if (formato === "usd") return usd(Number(valor));
  if (formato === "percent") return pct(Number(valor));
  if (formato === "number3") return numero3(Number(valor));
  if (formato === "number") return numero(Number(valor));
  return String(valor);
}

const alineacion = (columna: Columna) =>
  columna.format && columna.format !== "text" ? "text-right" : "text-left";

/** Nombre del grupo con el chevron que lo pliega. Al plegarlo, el renglón muestra sus totales. */
function BotonGrupo({
  etiqueta,
  colapsado,
  onToggle,
}: {
  etiqueta: string;
  colapsado: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!colapsado}
      className="flex w-full items-center gap-2 text-left text-xs font-semibold uppercase tracking-wide text-ink"
    >
      {colapsado ? <ChevronRight className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
      {etiqueta}
    </button>
  );
}

export function ConsolidadoTabla({
  lineas,
  verSorgoGirasol,
  colapsados,
  onToggleGrupo,
}: {
  lineas: LineaConsolidado[];
  verSorgoGirasol: boolean;
  colapsados: Set<string>;
  onToggleGrupo: (grupo: string) => void;
}) {
  const columnas = columnasConsolidado(verSorgoGirasol);
  return (
    <div className="max-h-[70vh] overflow-auto rounded-card border border-line bg-panel shadow-card">
      <table className="min-w-max border-collapse text-xs tabular" aria-label="Consolidado de clientes">
        <thead>
          <tr className="text-ink-soft">
            {columnas.map((columna) => (
              <th
                key={columna.key}
                scope="col"
                className={`sticky top-0 z-20 border-b border-line bg-panel-soft px-3 py-3 font-semibold uppercase tracking-wide ${alineacion(columna)} ${columna.key === "productor" ? "left-0 z-30 min-w-56" : ""}`}
              >
                {columna.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lineas.map((linea, indice) => {
            if (linea.tipo === "grupo") {
              const colapsado = !!linea.grupo && colapsados.has(linea.grupo);
              const totales = colapsado ? linea.totales : undefined;
              const boton = (
                <BotonGrupo
                  etiqueta={linea.etiqueta}
                  colapsado={colapsado}
                  onToggle={() => linea.grupo && onToggleGrupo(linea.grupo)}
                />
              );
              // Plegado, el grupo ocupa un solo renglón con los totales del vendedor en sus columnas.
              return (
                <tr key={`grupo-${indice}`} className="border-y border-line bg-line-soft">
                  {totales ? (
                    columnas.map((columna, posicion) => (
                      <td
                        key={columna.key}
                        className={`whitespace-nowrap px-3 py-2 font-semibold text-ink ${alineacion(columna)} ${columna.key === "productor" ? "sticky left-0 z-10 bg-inherit" : ""}`}
                      >
                        {posicion === 0 ? boton : mostrar(columna.get(totales), columna.format)}
                      </td>
                    ))
                  ) : (
                    <th scope="rowgroup" colSpan={columnas.length} className="px-3 py-2 text-left">
                      {boton}
                    </th>
                  )}
                </tr>
              );
            }
            if (linea.grupo && colapsados.has(linea.grupo)) return null;
            return (
              <tr
                key={`${linea.tipo}-${linea.cuit ?? indice}`}
                className={`border-b border-line-soft text-ink ${linea.tipo === "total" ? "bg-primary/20 font-bold" : linea.tipo === "subtotal" || linea.tipo === "carteras" ? "bg-panel-soft font-semibold" : linea.tipo === "fuera" || linea.tipo === "ajuste" ? "bg-line-soft/60 font-medium" : indice % 2 ? "bg-line-soft/30" : "bg-panel"}`}
              >
                {columnas.map((columna) => (
                  <td
                    key={columna.key}
                    className={`whitespace-nowrap px-3 py-2 ${alineacion(columna)} ${columna.key === "productor" ? "sticky left-0 z-10 bg-inherit" : ""}`}
                  >
                    {columna.key === "productor" ? (
                      <span className="flex flex-col">
                        <span>{linea.etiqueta}</span>
                        {linea.cuit && <span className="font-normal text-ink-soft">{linea.cuit}</span>}
                      </span>
                    ) : mostrar(columna.get(linea), columna.format)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
