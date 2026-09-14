import { Combobox } from "@/components/ui/combobox";
import type { ClienteCopiaDto } from "../types";

interface Props {
  clientes: ClienteCopiaDto[];
  /** Número de cliente elegido, o `null` si no hay ninguno (nunca vacío: es un número, no texto). */
  value: number | null;
  onChange: (clienteNumero: number | null) => void;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
}

/** "1234 · Juan Pérez": el mismo separador que usa el resto de la app (p. ej. la columna Dueño). */
function etiquetaCliente(cliente: ClienteCopiaDto): string {
  return `${cliente.numero} · ${cliente.denominacion}`;
}

/**
 * Selector de clientes de la copia local de MacroGest (R2.2: nunca consulta MacroGest en vivo, sólo
 * busca sobre la lista que le pasa el padre). Envuelve el `Combobox` genérico, que trabaja con
 * strings, y resuelve la etiqueta elegida al número de cliente que necesitan lotes y órdenes.
 */
export function ClienteSelect({ clientes, value, onChange, id, disabled, placeholder }: Props) {
  const opciones = clientes.map(etiquetaCliente);
  const seleccionado = clientes.find((c) => c.numero === value);

  const manejarCambio = (etiqueta: string) => {
    const cliente = clientes.find((c) => etiquetaCliente(c) === etiqueta);
    onChange(cliente ? cliente.numero : null);
  };

  return (
    <Combobox
      id={id}
      value={seleccionado ? etiquetaCliente(seleccionado) : ""}
      onChange={manejarCambio}
      options={opciones}
      disabled={disabled}
      placeholder={placeholder ?? "Buscar cliente…"}
    />
  );
}
