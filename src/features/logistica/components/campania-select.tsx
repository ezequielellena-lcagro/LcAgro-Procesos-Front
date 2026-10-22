import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FilterField } from "@/shared/components/filter-bar";
import { useCatalogo } from "../queries/use-logistica";

/**
 * Campaña como desplegable, con las campañas que realmente tienen contrato de venta en MacroGest.
 *
 * Antes era un campo de texto libre con `placeholder="2025-2026"`: había que saber el formato y
 * escribirlo bien, y una campaña inexistente se aceptaba igual hasta que el servidor la rechazaba.
 *
 * <p>Son una docena de filas, así que es un `<select>` común y no el combo con búsqueda del resto
 * de los catálogos. Si MacroGest no responde vuelve al campo escrito, para que el filtro siga
 * sirviendo con el ERP caído.</p>
 */
export function CampaniaSelect({
  value,
  onChange,
  className = "w-36",
}: {
  /** Campaña en formato de pantalla (`2025-2026`); vacío = todas. */
  value: string;
  onChange: (campania: string) => void;
  className?: string;
}) {
  const q = useCatalogo("campanias");
  const opciones = (q.data?.pages.flatMap((p) => p.filas) ?? [])
    .map((f) => f.nombre)
    .filter((n): n is string => !!n);

  if (q.isError)
    return (
      <FilterField label="Campaña" title="MacroGest no respondió el catálogo; escribila a mano.">
        <Input
          className={className}
          value={value}
          maxLength={9}
          pattern="[0-9]{4}-[0-9]{4}"
          placeholder="2025-2026"
          onChange={(e) => onChange(e.target.value)}
        />
      </FilterField>
    );

  return (
    <FilterField label="Campaña">
      <Select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Todas</option>
        {/* La elegida puede no estar en la lista (ERP lento o campaña vieja): igual se lee. */}
        {value && !opciones.includes(value) && <option value={value}>{value}</option>}
        {opciones.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
    </FilterField>
  );
}
