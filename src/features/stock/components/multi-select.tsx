import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: number;
  label: string;
}

interface Props {
  options: MultiSelectOption[];
  value: number[];
  onChange: (value: number[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Normaliza para buscar sin distinguir mayúsculas ni tildes. */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Multi-select numérico: botón que abre un panel con búsqueda + checkboxes. Commitea cada cambio
 * por `onChange` (controlado). Cierra al click afuera. Cero dependencias (no hay Popover/Command).
 */
export function MultiSelect({ options, value, onChange, placeholder = "Todos", disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const q = normalizar(query.trim());
  const visibles = useMemo(
    () => (q === "" ? options : options.filter((o) => normalizar(o.label).includes(q))),
    [q, options],
  );

  const seleccionados = new Set(value);
  const toggle = (v: number) => {
    const next = new Set(seleccionados);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange([...next]);
  };

  const resumen = value.length === 0 ? placeholder : `${value.length} seleccionado${value.length === 1 ? "" : "s"}`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-10 w-56 items-center justify-between gap-2 rounded-md border border-input bg-panel px-3 text-sm text-ink",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          value.length === 0 && "text-ink-soft",
        )}
      >
        <span className="truncate">{resumen}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-ink-soft" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-64 overflow-hidden rounded-md border border-line bg-panel shadow-float">
          <div className="border-b border-line-soft p-2">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="h-9 w-full rounded-md border border-input bg-panel px-3 text-sm text-ink placeholder:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <ul role="listbox" aria-multiselectable className="max-h-60 overflow-y-auto py-1">
            {visibles.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-soft">Sin coincidencias.</li>
            ) : (
              visibles.map((o) => (
                <li key={o.value} role="option" aria-selected={seleccionados.has(o.value)}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-ink hover:bg-panel-soft">
                    <input
                      type="checkbox"
                      checked={seleccionados.has(o.value)}
                      onChange={() => toggle(o.value)}
                      className="size-4 accent-clementina"
                    />
                    <span className="truncate">{o.label}</span>
                  </label>
                </li>
              ))
            )}
          </ul>
          <div className="flex items-center justify-between border-t border-line-soft px-3 py-1.5 text-xs">
            <button type="button" onClick={() => onChange([])} className="text-ink-soft hover:text-ink">
              Limpiar
            </button>
            <button type="button" onClick={() => setOpen(false)} className="font-medium text-clementina-deep">
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
