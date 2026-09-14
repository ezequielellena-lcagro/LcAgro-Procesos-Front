import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Props<TMotivo extends string> {
  opciones: { valor: TMotivo; etiqueta: string }[];
  value: TMotivo | "";
  onChange: (value: TMotivo) => void;
  /** Sólo se muestra y se exige con motivo "Otro" (R1.4/R1.5); el resto la puede dejar vacía. */
  detalle: string;
  onDetalleChange: (detalle: string) => void;
  id?: string;
  disabled?: boolean;
}

/**
 * Selector de motivo de lista cerrada (R1.4 ajuste de stock, R1.5 anulación de orden): ambos enums
 * comparten forma, así que este único componente sirve para los dos. Con el motivo "Otro" pide el
 * detalle en texto libre y lo marca obligatorio (ADR-05); el resto de los motivos no lo necesitan.
 */
export function MotivoSelect<TMotivo extends string>({
  opciones,
  value,
  onChange,
  detalle,
  onDetalleChange,
  id,
  disabled,
}: Props<TMotivo>) {
  const detalleId = useId();
  const esOtro = value === "Otro";

  return (
    <div className="space-y-2">
      <Select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as TMotivo)}
      >
        <option value="">Elegí un motivo…</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </Select>

      {esOtro && (
        <div>
          <Label htmlFor={detalleId}>Detalle (obligatorio)</Label>
          <Textarea
            id={detalleId}
            required
            disabled={disabled}
            value={detalle}
            onChange={(e) => onDetalleChange(e.target.value)}
            placeholder="Contá brevemente qué pasó…"
            className="mt-1"
          />
        </div>
      )}
    </div>
  );
}
