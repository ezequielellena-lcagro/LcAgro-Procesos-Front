import { Select } from "@/components/ui/select";
import { FilterField } from "@/shared/components/filter-bar";
import type { EstadoFiltro } from "../filtros";
import type { EstadoStock } from "../types";

const OPCIONES: { value: EstadoFiltro; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "Ok", label: "OK" },
  { value: "RiesgoQuiebre", label: "Riesgo quiebre" },
  { value: "Inmovilizado", label: "Inmovilizado" },
];

/**
 * Qué es este filtro, siempre visible en el `title`: es el ÚNICO control de la barra que no mueve los
 * KPIs (el backend lo aplica como drill-down, después del set base). Sin esta aclaración, aislar
 * "Riesgo quiebre" bajaba la tabla a 3 filas dejando arriba el valor USD del total, y lo natural era
 * leerlo como el valor de esas 3 filas.
 */
const AYUDA = "Filtra el listado de abajo; los KPIs de arriba siguen siendo los del total filtrado.";

function motivoFijo(fijo: EstadoStock): string {
  return `Esta solapa ya filtra por "${OPCIONES.find((o) => o.value === fijo)?.label ?? fijo}": el filtro queda fijo.`;
}

/**
 * Filtro de estado de cobertura, en la barra de filtros compartida: permite aislar los artículos
 * en riesgo de quiebre y sigue teniendo su badge en la columna Estado de la tabla.
 *
 * Se deshabilita, siempre con el motivo en el `title`, en dos casos —nunca en silencio—:
 * - `fijo`: la solapa impone su propio estado (Inmovilizado) y el preset ganaría igual al armar la
 *   query. Se muestra el estado impuesto en vez de pisar la elección del usuario.
 * - `ignorado`: la solapa no se dibuja con `items` (Por rubro), así que el control no haría nada.
 */
export function EstadoFiltroField({
  valor,
  onChange,
  fijo,
  ignorado,
}: {
  valor: EstadoFiltro;
  onChange: (v: EstadoFiltro) => void;
  fijo?: EstadoStock;
  /** Motivo por el que la solapa activa ignora el estado. Presente = control deshabilitado. */
  ignorado?: string;
}) {
  const motivo = fijo ? motivoFijo(fijo) : ignorado;
  const deshabilitado = fijo !== undefined || ignorado !== undefined;
  return (
    <FilterField label="Estado" title={motivo ? `${motivo} ${AYUDA}` : AYUDA}>
      <Select
        value={fijo ?? valor}
        disabled={deshabilitado}
        title={motivo ?? AYUDA}
        onChange={(e) => onChange(e.target.value as EstadoFiltro)}
      >
        {OPCIONES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </FilterField>
  );
}
