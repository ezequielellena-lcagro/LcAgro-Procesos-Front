import { Select } from "@/components/ui/select";

/** Selector de campaña. El label lo pone el llamador (FilterField o Label, según la pantalla). */
export function CampaniaSelect({
  value,
  campanias,
  onChange,
  disabled = false,
  id,
}: {
  value: string | undefined;
  campanias: string[] | undefined;
  onChange: (campania: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <Select
      id={id}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || !campanias}
    >
      {campanias?.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </Select>
  );
}
