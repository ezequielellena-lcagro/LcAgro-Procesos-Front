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

function motivoFijo(fijo: EstadoStock): string {
  return `Esta solapa ya filtra por "${OPCIONES.find((o) => o.value === fijo)?.label ?? fijo}": el filtro queda fijo.`;
}

/**
 * Filtro de estado de cobertura, en la barra de filtros compartida: permite aislar los artículos
 * en riesgo de quiebre y sigue teniendo su badge en la columna Estado de la tabla.
 *
 * Cuando la solapa activa fija su propio estado (Inmovilizado), el preset ganaría igual al armar
 * la query. En vez de pisar la elección del usuario en silencio, se muestra el estado impuesto y
 * el control queda deshabilitado, con el motivo en el `title`.
 */
export function EstadoFiltroField({
  valor,
  onChange,
  fijo,
}: {
  valor: EstadoFiltro;
  onChange: (v: EstadoFiltro) => void;
  fijo?: EstadoStock;
}) {
  const motivo = fijo ? motivoFijo(fijo) : undefined;
  return (
    <FilterField label="Estado" title={motivo}>
      <Select
        value={fijo ?? valor}
        disabled={fijo !== undefined}
        title={motivo}
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
