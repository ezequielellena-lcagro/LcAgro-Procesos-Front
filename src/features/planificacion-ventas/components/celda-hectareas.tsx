import { Input } from "@/components/ui/input";
import { numero } from "@/shared/format/format";
import { textoHectareas } from "../lib/borrador-plan";
import type { Cultivo } from "../types";

const NOMBRES: Record<Cultivo, string> = {
  soja: "soja",
  maiz: "maíz",
  trigo: "trigo",
  otro: "otro",
};

export function CeldaHectareas({
  productor,
  cuit,
  cultivo,
  valor,
  texto,
  anterior,
  editable,
  error,
  onChange,
  onBlur,
  onEscape,
}: {
  productor: string;
  cuit: string;
  cultivo: Cultivo;
  valor: number | null;
  texto: string;
  anterior: number | null;
  editable: boolean;
  error?: string;
  onChange: (texto: string) => void;
  onBlur: () => void;
  onEscape: () => void;
}) {
  if (!editable) return <span>{valor == null ? "—" : numero(valor)}</span>;
  return (
    <div className="min-w-24">
      <Input
        aria-label={"Hectáreas de " + NOMBRES[cultivo] + " de " + productor}
        aria-invalid={!!error}
        aria-describedby={error ? "error-" + cultivo + "-" + cuit : undefined}
        data-cultivo={cultivo}
        inputMode="decimal"
        value={texto}
        placeholder={textoHectareas(anterior)}
        onChange={(evento) => onChange(evento.target.value)}
        onBlur={onBlur}
        onKeyDown={(evento) => {
          if (evento.key === "Escape") {
            evento.preventDefault();
            onEscape();
          } else if (evento.key === "Enter") {
            evento.preventDefault();
            const celdas = [
              ...document.querySelectorAll<HTMLInputElement>(
                'input[data-cultivo="' + cultivo + '"]',
              ),
            ];
            celdas[celdas.indexOf(evento.currentTarget) + 1]?.focus();
          }
        }}
        className={"h-9 min-w-24 px-2 text-right tabular " + (error ? "border-rojo bg-red-50" : "")}
      />
      {error && (
        <span id={"error-" + cultivo + "-" + cuit} className="mt-1 block text-xs text-rojo">
          {error}
        </span>
      )}
    </div>
  );
}
