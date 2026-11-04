/**
 * Celda de selección de una tabla de Logística.
 *
 * El punto es `motivo`: una fila que no se puede elegir **dice por qué**. Antes se pintaba un
 * radio/checkbox deshabilitado y nada más, así que desde el otro lado sólo se veía "no me deja"
 * —literal— sin forma de saber si faltaba un dato, si el contrato estaba anulado o si el cereal no
 * coincidía con lo ya elegido.
 */
export function Elegir({
  tipo,
  name,
  etiqueta,
  checked,
  motivo,
  onChange,
  onClick,
}: {
  tipo: "radio" | "checkbox";
  /** Obligatorio en los radio: agrupa la elección única. */
  name?: string;
  etiqueta: string;
  checked: boolean;
  /** Texto corto con la razón por la que la fila no se puede elegir; `null` = se puede. */
  motivo: string | null;
  onChange: () => void;
  onClick?: () => void;
}) {
  // Una fila ya elegida nunca se bloquea: hay que poder soltarla aunque dejara de ser elegible.
  const bloqueada = motivo != null && !checked;
  return (
    <span className="flex items-center gap-1.5">
      <input
        type={tipo}
        name={name}
        className="size-4 flex-none accent-primary"
        aria-label={etiqueta}
        aria-describedby={undefined}
        title={bloqueada ? motivo : undefined}
        checked={checked}
        disabled={bloqueada}
        onClick={onClick}
        onChange={onChange}
      />
      {bloqueada && (
        <span className="max-w-[12rem] whitespace-normal text-[11px] leading-tight text-ink-soft">
          {motivo}
        </span>
      )}
    </span>
  );
}
