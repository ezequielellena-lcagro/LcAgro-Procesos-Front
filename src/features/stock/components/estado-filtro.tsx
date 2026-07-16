import { Select } from "@/components/ui/select";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import type { EstadoStock } from "../types";

/** "" = todos. El resto espeja EstadoStock. */
export type EstadoFiltro = EstadoStock | "";

const OPCIONES: { value: EstadoFiltro; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "Ok", label: "OK" },
  { value: "RiesgoQuiebre", label: "Riesgo quiebre" },
  { value: "Inmovilizado", label: "Inmovilizado" },
];

/**
 * Filtro de estado de cobertura de la solapa Stock: permite aislar los artículos en riesgo de
 * quiebre (Decisión 3), que además siguen teniendo su badge en la columna Estado de la tabla.
 *
 * Es drill-down, no filtro compartido: no entra en la FilterBar de arriba porque los KPIs se
 * calculan sobre el set base y tienen que quedarse quietos al usarlo.
 */
export function StockEstadoFiltro({
  valor,
  onChange,
}: {
  valor: EstadoFiltro;
  onChange: (v: EstadoFiltro) => void;
}) {
  return (
    <FilterBar className="mb-0">
      <FilterField label="Estado">
        <Select value={valor} onChange={(e) => onChange(e.target.value as EstadoFiltro)}>
          {OPCIONES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </FilterField>
    </FilterBar>
  );
}
