import type { SelectHTMLAttributes } from "react";
import { Select } from "@/components/ui/select";
import { ENVASES, type EnvaseSemillero } from "../types";

/**
 * Un filtro de lotes: `undefined` = sin filtrar. El resto de las props (id, aria-label) pasa al
 * select.
 */
type FiltroSelectProps<T> = Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> & {
  value: T | undefined;
  onChange: (valor: T | undefined) => void;
};

/**
 * Filtro por tratamiento (Tratada / Sin tratar / ambos). Lo comparten la pestaña Stock y el armado
 * de la orden, para que los dos filtros no se desalineen.
 */
export function TratamientoSelect({ value, onChange, ...props }: FiltroSelectProps<boolean>) {
  return (
    <Select
      {...props}
      value={value === undefined ? "" : String(value)}
      onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value === "true")}
    >
      <option value="">Tratada y sin tratar</option>
      <option value="true">Tratada</option>
      <option value="false">Sin tratar</option>
    </Select>
  );
}

/** Filtro por envase (según `ENVASES`), con el mismo criterio que `TratamientoSelect`. */
export function EnvaseSelect({ value, onChange, ...props }: FiltroSelectProps<EnvaseSemillero>) {
  return (
    <Select
      {...props}
      value={value ?? ""}
      onChange={(e) => onChange(ENVASES.find((envase) => envase.valor === e.target.value)?.valor)}
    >
      <option value="">Todos</option>
      {ENVASES.map((envase) => (
        <option key={envase.valor} value={envase.valor}>
          {envase.etiqueta}
        </option>
      ))}
    </Select>
  );
}
