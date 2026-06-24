import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Normaliza para buscar sin distinguir mayúsculas ni tildes. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  /** Tope de opciones renderizadas a la vez (la búsqueda angosta el resto). */
  maxVisible?: number;
}

/**
 * Combo buscable: input de texto que filtra una lista (potencialmente de miles) y commitea solo al
 * elegir una opción (click o Enter). Pensado para ir adentro de un Modal: Escape cierra el combo sin
 * cerrar el diálogo. Reemplaza al &lt;datalist&gt; nativo (feo y sin paginar).
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  id,
  disabled,
  maxVisible = 50,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // Cierre al hacer click afuera. (setState en el callback del listener es válido; no en el cuerpo del effect.)
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const q = normalizar(query.trim());
  const coincidencias = useMemo(
    () => (q === "" ? options : options.filter((o) => normalizar(o).includes(q))),
    [q, options],
  );
  const visibles = coincidencias.slice(0, maxVisible);
  const active = Math.min(activeIndex, Math.max(visibles.length - 1, 0));

  const abrir = () => {
    if (disabled) return;
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  };

  const elegir = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation(); // no dejar que el Modal lo capture y se cierre
      setOpen(false);
      return;
    }
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      abrir();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, visibles.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (visibles[active]) elegir(visibles[active]);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          autoComplete="off"
          disabled={disabled}
          value={open ? query : value}
          placeholder={value && !open ? value : (placeholder ?? "Buscar…")}
          onFocus={abrir}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            if (!open) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-panel px-3 py-2 pr-9 text-sm text-ink",
            "placeholder:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-line bg-panel shadow-float">
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {visibles.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-soft">Sin coincidencias.</li>
            ) : (
              visibles.map((opt, i) => (
                <li key={opt} role="option" aria-selected={opt === value}>
                  <button
                    type="button"
                    // onMouseDown (no onClick): selecciona antes de que el input pierda foco.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      elegir(opt);
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-ink",
                      i === active && "bg-panel-soft",
                    )}
                  >
                    <span className="truncate">{opt}</span>
                    {opt === value && <Check className="size-4 shrink-0 text-clementina-deep" />}
                  </button>
                </li>
              ))
            )}
          </ul>
          {coincidencias.length > maxVisible && (
            <div className="border-t border-line-soft px-3 py-1.5 text-xs text-ink-soft">
              Mostrando {maxVisible} de {coincidencias.length}. Seguí escribiendo para afinar.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
