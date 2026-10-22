import { alineacionCelda, mostrarCelda } from "../lib/celdas";
import { columnasObjetivos, type LineaObjetivos, type VistaObjetivos } from "../lib/objetivos";

// Los tintes son semitransparentes: van sobre un fondo opaco para que la columna fija no deje ver lo
// que pasa por debajo al desplazar la tabla a la derecha.
const tinte = (linea: LineaObjetivos, indice: number) =>
  linea.tipo === "total" ? "bg-primary/20"
    : linea.tipo === "fuera" || linea.tipo === "ajuste" ? "bg-line-soft/60"
      : indice % 2 ? "bg-line-soft/30" : "";

const peso = (linea: LineaObjetivos) =>
  linea.tipo === "total" ? "font-bold" : linea.tipo === "fuera" || linea.tipo === "ajuste" ? "font-medium" : "";

export function ObjetivosTabla({ lineas, vista = "real" }: { lineas: LineaObjetivos[]; vista?: VistaObjetivos }) {
  const columnas = columnasObjetivos(vista);
  return (
    <div className="max-h-[70vh] overflow-auto rounded-card border border-line bg-panel shadow-card">
      <table
        className="w-full min-w-max border-collapse text-xs tabular"
        aria-label={vista === "objetivo" ? "Objetivos por vendedor" : "Base de objetivos por vendedor"}
      >
        <thead>
          <tr className="text-ink-soft">
            {columnas.map((columna) => (
              <th
                key={columna.key}
                scope="col"
                className={`sticky top-0 z-20 border-b border-line bg-panel-soft px-3 py-3 font-semibold uppercase tracking-wide ${alineacionCelda(columna.format)} ${columna.key === "vendedor" ? "left-0 z-30 min-w-48" : ""}`}
              >
                {columna.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lineas.map((linea, indice) => (
            <tr key={`${linea.tipo}-${linea.etiqueta}`} className={`border-b border-line-soft bg-panel text-ink ${peso(linea)}`}>
              {columnas.map((columna) => {
                const valor = mostrarCelda(columna.get(linea), columna.format);
                const alineacion = alineacionCelda(columna.format);
                return columna.key === "vendedor" ? (
                  <td key={columna.key} className="sticky left-0 z-10 bg-panel p-0">
                    <div className={`whitespace-nowrap px-3 py-2 ${alineacion} ${tinte(linea, indice)}`}>{valor}</div>
                  </td>
                ) : (
                  <td key={columna.key} className={`whitespace-nowrap px-3 py-2 ${alineacion} ${tinte(linea, indice)}`}>
                    {valor}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
