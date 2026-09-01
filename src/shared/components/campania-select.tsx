import { Select } from "@/components/ui/select";

/** Selector de campaña. El label lo pone el llamador (FilterField o Label, según la pantalla). */
export function CampaniaSelect({
  value,
  campanias,
  onChange,
  disabled = false,
  id,
  todasLabel,
}: {
  value: string | undefined;
  campanias: string[] | undefined;
  onChange: (campania: string) => void;
  disabled?: boolean;
  id?: string;
  /** Si se pasa, agrega una opción de valor "" con esa etiqueta (pantallas donde ver todo es válido). */
  todasLabel?: string;
}) {
  return (
    <Select
      id={id}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || !campanias}
    >
      {todasLabel && <option value="">{todasLabel}</option>}
      {campanias?.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </Select>
  );
}
