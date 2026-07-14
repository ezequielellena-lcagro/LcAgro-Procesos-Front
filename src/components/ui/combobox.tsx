import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
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
 * elegir una opción (click o Enter). El panel de opciones se renderiza por PORTAL en <body> con
 * posición fija, así no queda recortado por contenedores con overflow (p. ej. una tabla con scroll).
 * Escape cierra el combo sin propagar (para no cerrar un editor/diálogo contenedor).
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
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; arriba: boolean } | null>(
    null,
  );

  // Mide el trigger y ubica el panel (fixed); decide abrir hacia arriba si no entra abajo. Se llama
  // desde el handler de apertura y desde los listeners (nunca en el cuerpo de un effect).
  const medir = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const alto = 288; // max-h-60 (240) + padding/pie
    const espacioAbajo = window.innerHeight - r.bottom;
    const arriba = espacioAbajo < alto && r.top > espacioAbajo;
    setPos({ top: arriba ? r.top - 4 : r.bottom + 4, left: r.left, width: r.width, arriba });
  }, []);

  // Mientras está abierto, seguí al trigger ante scroll/resize (setState en callback, no en el cuerpo).
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [open, medir]);

  // Cierre al hacer click afuera (considera también el panel, que vive en un portal fuera de rootRef).
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
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
    medir();
    setOpen(true);
  };

  const elegir = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation(); // no dejar que un contenedor lo capture y se cierre
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
            if (!open) {
              medir();
              setOpen(true);
            }
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

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              transform: pos.arriba ? "translateY(-100%)" : undefined,
            }}
            className="z-50 overflow-hidden rounded-md border border-line bg-panel shadow-float"
          >
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
          </div>,
          document.body,
        )}
    </div>
  );
}
