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

export function ConsolidadoTabla({
  lineas,
  verSorgoGirasol,
}: {
  lineas: LineaConsolidado[];
  verSorgoGirasol: boolean;
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
                className={`sticky top-0 z-20 border-b border-line bg-panel-soft px-3 py-3 font-semibold uppercase tracking-wide ${columna.format && columna.format !== "text" ? "text-right" : "text-left"} ${columna.key === "productor" ? "left-0 z-30 min-w-56" : ""}`}
              >
                {columna.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lineas.map((linea, indice) => linea.tipo === "grupo" ? (
            <tr key={`grupo-${indice}`} className="border-y border-line bg-line-soft">
              <th scope="rowgroup" colSpan={columnas.length} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink">
                {linea.etiqueta}
              </th>
            </tr>
          ) : (
            <tr
              key={`${linea.tipo}-${linea.cuit ?? indice}`}
              className={`border-b border-line-soft text-ink ${linea.tipo === "total" ? "bg-primary/20 font-bold" : linea.tipo === "subtotal" || linea.tipo === "carteras" ? "bg-panel-soft font-semibold" : linea.tipo === "fuera" || linea.tipo === "ajuste" ? "bg-line-soft/60 font-medium" : indice % 2 ? "bg-line-soft/30" : "bg-panel"}`}
            >
              {columnas.map((columna) => (
                <td
                  key={columna.key}
                  className={`whitespace-nowrap px-3 py-2 ${columna.format && columna.format !== "text" ? "text-right" : "text-left"} ${columna.key === "productor" ? "sticky left-0 z-10 bg-inherit" : ""}`}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
