import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"]; // semana arranca el lunes

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function parseISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
/** ISO (YYYY-MM-DD) → dd/mm/yyyy para mostrar. */
function ddmmaaaa(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

interface Props {
  /** Valor en formato ISO (YYYY-MM-DD). */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
}

/**
 * Selector de fecha propio: muestra dd/mm/yyyy y abre un calendario en español, sin depender del
 * locale del navegador (el <input type="date"> nativo formatea según el idioma del navegador, no el
 * de la página). El valor viaja siempre como ISO YYYY-MM-DD. El panel se renderiza por PORTAL para no
 * quedar recortado por contenedores con overflow.
 */
export function DateField({ value, onChange, id, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(() => parseISO(value) ?? new Date());
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; arriba: boolean } | null>(null);

  const medir = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const alto = 330;
    const espacioAbajo = window.innerHeight - r.bottom;
    const arriba = espacioAbajo < alto && r.top > espacioAbajo;
    setPos({ top: arriba ? r.top - 4 : r.bottom + 4, left: r.left, arriba });
  }, []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [open, medir]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const abrir = () => {
    if (disabled) return;
    setVisible(parseISO(value) ?? new Date()); // al abrir, posicionarse en el mes del valor
    medir();
    setOpen(true);
  };

  const elegir = (dia: number) => {
    onChange(toISO(new Date(visible.getFullYear(), visible.getMonth(), dia)));
    setOpen(false);
  };

  const anio = visible.getFullYear();
  const mes = visible.getMonth();
  const primerDia = (new Date(anio, mes, 1).getDay() + 6) % 7; // 0 = lunes
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const hoyISO = toISO(new Date());
  const celdas: (number | null)[] = [
    ...Array.from({ length: primerDia }, () => null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : abrir())}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-panel px-3 text-sm text-ink",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <span className={value ? "tabular text-ink" : "text-ink-soft"}>{value ? ddmmaaaa(value) : "dd/mm/aaaa"}</span>
        <Calendar className="size-4 shrink-0 text-ink-soft" />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: pos.arriba ? "translateY(-100%)" : undefined,
            }}
            className="w-[17rem] rounded-md border border-line bg-panel p-3 shadow-float"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Mes anterior"
                onClick={() => setVisible(new Date(anio, mes - 1, 1))}
                className="rounded-md p-1 text-ink-soft hover:bg-panel-soft"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm font-medium capitalize text-ink">
                {MESES[mes]} {anio}
              </span>
              <button
                type="button"
                aria-label="Mes siguiente"
                onClick={() => setVisible(new Date(anio, mes + 1, 1))}
                className="rounded-md p-1 text-ink-soft hover:bg-panel-soft"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center">
              {DIAS.map((d) => (
                <div key={d} className="py-1 text-xs font-medium text-ink-soft">
                  {d}
                </div>
              ))}
              {celdas.map((dia, i) => {
                if (dia === null) return <div key={`v${i}`} />;
                const iso = toISO(new Date(anio, mes, dia));
                const sel = iso === value;
                const esHoy = iso === hoyISO;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => elegir(dia)}
                    className={cn(
                      "flex h-8 items-center justify-center rounded-md text-sm text-ink hover:bg-panel-soft",
                      esHoy && !sel && "font-semibold text-clementina-deep",
                      sel && "bg-clementina text-slate-brand hover:bg-clementina-deep",
                    )}
                  >
                    {dia}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-line-soft pt-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-ink-soft hover:text-ink"
              >
                Borrar
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(hoyISO);
                  setOpen(false);
                }}
                className="font-medium text-clementina-deep hover:underline"
              >
                Hoy
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
