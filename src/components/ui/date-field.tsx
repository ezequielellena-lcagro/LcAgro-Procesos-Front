import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"]; // semana arranca el lunes

/** Cuántos años ofrece el desplegable hacia atrás y hacia adelante. */
const ANIOS_ALREDEDOR = 10;

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** ISO (yyyy-mm-dd) → dd/mm/yyyy para mostrar. */
function ddmmaaaa(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * dd/mm/aaaa escrito a mano → ISO, o `null` si todavía no es una fecha.
 *
 * Se valida que la fecha EXISTA y no sólo que tenga el formato: `new Date(2026, 1, 31)` no falla,
 * se corre al 3 de marzo. Comparando los componentes se detecta que el 31 de febrero no existe.
 */
function desdeTexto(texto: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;

  const [dia, mes, anio] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(anio, mes - 1, dia);
  const existe = fecha.getFullYear() === anio
    && fecha.getMonth() === mes - 1
    && fecha.getDate() === dia;

  return existe ? toISO(fecha) : null;
}

interface Props {
  /** Valor en formato ISO (yyyy-mm-dd). */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
}

/**
 * Selector de fecha propio: se puede escribir dd/mm/aaaa o elegir del calendario, que está en
 * español sin depender del idioma del navegador (el `<input type="date">` nativo formatea según el
 * navegador, no según la página). El valor viaja siempre como ISO yyyy-mm-dd.
 *
 * <p>Poder escribir no es un lujo: con sólo flechas de mes, cargar una fecha de 2024 estando en
 * 2026 son veinticinco clics. El calendario además lleva desplegables de mes y año.</p>
 *
 * <p>El panel se dibuja por PORTAL para no quedar recortado por contenedores con overflow.</p>
 */
export function DateField({ value, onChange, id, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(() => parseISO(value) ?? new Date());
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; arriba: boolean } | null>(null);

  // Lo tipeado mientras se escribe. En null, el campo muestra `value`: así una fecha que cambia
  // desde afuera se refleja sola, y lo que se está escribiendo no se pisa a mitad de camino.
  const [borrador, setBorrador] = useState<string | null>(null);

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
    setBorrador(null);
    setOpen(false);
  };

  const escribir = (texto: string) => {
    setBorrador(texto);
    if (texto.trim() === "") {
      onChange("");
      return;
    }
    const iso = desdeTexto(texto);
    if (iso) {
      onChange(iso);
      setVisible(parseISO(iso)!);
    }
    // Si no es una fecha todavía ("01/0") no se avisa nada: es alguien tipeando, no un error.
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

  // El año del valor entra sí o sí, aunque caiga fuera del rango: si no, una fecha vieja no se
  // podría ni mostrar en el desplegable.
  const base = new Date().getFullYear();
  const anios = [...new Set([
    ...Array.from({ length: ANIOS_ALREDEDOR * 2 + 1 }, (_, i) => base - ANIOS_ALREDEDOR + i),
    anio,
  ])].sort((a, b) => a - b);

  return (
    <div ref={rootRef} className="relative">
      <div
        className={cn(
          "flex h-10 w-full items-center rounded-md border border-input bg-panel pr-1 text-sm text-ink",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <input
          id={id}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          placeholder="dd/mm/aaaa"
          value={borrador ?? ddmmaaaa(value)}
          onChange={(e) => escribir(e.target.value)}
          // Lo que quedó a medias se descarta al salir: el campo vuelve a la fecha vigente.
          onBlur={() => setBorrador(null)}
          className={cn(
            "h-full w-full min-w-0 rounded-md bg-transparent px-3 tabular outline-none",
            "placeholder:text-ink-soft disabled:cursor-not-allowed",
          )}
        />
        <button
          type="button"
          aria-label="Abrir calendario"
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : abrir())}
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-md text-ink-soft",
            "hover:bg-panel-soft hover:text-ink disabled:cursor-not-allowed",
          )}
        >
          <Calendar className="size-4" />
        </button>
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
              transform: pos.arriba ? "translateY(-100%)" : undefined,
            }}
            className="w-[17rem] rounded-md border border-line bg-panel p-3 shadow-float"
          >
            <div className="mb-2 flex items-center gap-1">
              <button
                type="button"
                aria-label="Mes anterior"
                onClick={() => setVisible(new Date(anio, mes - 1, 1))}
                className="rounded-md p-1 text-ink-soft hover:bg-panel-soft"
              >
                <ChevronLeft className="size-4" />
              </button>

              {/* Desplegables y no sólo flechas: de 2026 a 2024 son veinticinco clics de flecha. */}
              <select
                aria-label="Mes"
                value={mes}
                onChange={(e) => setVisible(new Date(anio, Number(e.target.value), 1))}
                className="min-w-0 flex-1 rounded-md border border-line bg-panel px-1 py-1 text-sm capitalize text-ink"
              >
                {MESES.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                aria-label="Año"
                value={anio}
                onChange={(e) => setVisible(new Date(Number(e.target.value), mes, 1))}
                className="rounded-md border border-line bg-panel px-1 py-1 text-sm tabular text-ink"
              >
                {anios.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>

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
                  setBorrador(null);
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
                  setBorrador(null);
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
