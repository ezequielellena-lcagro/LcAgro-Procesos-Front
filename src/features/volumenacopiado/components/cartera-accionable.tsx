import { cn } from "@/lib/utils";
import { numero } from "@/shared/format/format";
import { Sparkline } from "@/shared/components/sparkline";
import { historiaValores } from "../lib/historia";
import type { ClienteCartera } from "../types";

type Variante = "reactivar" | "defender";

const CONFIG: Record<
  Variante,
  { titulo: string; subtitulo: string; totalLabel: string; acento: string; chip: string; tono: "rojo" | "clementina" }
> = {
  reactivar: {
    titulo: "Reactivar",
    subtitulo: "Clientes con historia que este año no entregaron",
    totalLabel: "recuperables",
    acento: "border-l-rojo",
    chip: "bg-rojo-bg text-rojo",
    tono: "rojo",
  },
  defender: {
    titulo: "Defender",
    subtitulo: "Activos por debajo de su pico: volumen que se está yendo",
    totalLabel: "en riesgo",
    acento: "border-l-clementina-deep",
    chip: "bg-clementina/15 text-clementina-deep",
    tono: "clementina",
  },
};

const TOPE = 8;

/**
 * Bloque accionable de la cartera de un vendedor: separa lo que hay para *reactivar* (dormidos) de lo
 * que hay que *defender* (declinantes), en vez de dejar todo en una tabla plana. Encabeza con las
 * toneladas en juego (lo recuperable / lo que se está yendo) para que se lea como una prioridad.
 */
export function CarteraAccionable({
  variante,
  clientes,
}: {
  variante: Variante;
  clientes: ClienteCartera[];
}) {
  const cfg = CONFIG[variante];

  // En riesgo = brecha contra el pico; recuperable = el pico entero (hoy está en cero).
  const enJuego = (c: ClienteCartera) => (variante === "defender" ? c.tnPico - c.tn : c.tnPico);
  const ordenados = [...clientes].sort((a, b) => enJuego(b) - enJuego(a));
  const total = ordenados.reduce((acc, c) => acc + enJuego(c), 0);
  const visibles = ordenados.slice(0, TOPE);

  return (
    <section className={cn("rounded-card border border-l-4 border-line bg-panel p-4 shadow-card", cfg.acento)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-display text-lg font-semibold text-ink">
          {cfg.titulo}
          <span className={cn("ml-2 rounded-full px-2 py-0.5 align-middle text-xs font-medium", cfg.chip)}>
            {ordenados.length}
          </span>
        </h3>
        {ordenados.length > 0 && (
          <div className="text-right">
            <span className="font-display text-xl font-semibold tabular text-ink">{numero(total)} tn</span>{" "}
            <span className="text-xs text-ink-soft">{cfg.totalLabel}</span>
          </div>
        )}
      </div>
      <p className="mt-0.5 text-xs text-ink-soft">{cfg.subtitulo}</p>

      {ordenados.length === 0 ? (
        <p className="mt-4 rounded-card bg-verde-bg px-3 py-2 text-sm text-verde">
          {variante === "reactivar"
            ? "Sin clientes dormidos: la cartera está bien cubierta."
            : "Ningún activo por debajo de su pico: la cartera no está cediendo volumen."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line-soft">
          {visibles.map((c) => (
            <li key={c.numero} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2">
              <span className="truncate text-sm text-ink" title={c.cliente}>
                {c.cliente}
              </span>
              <Sparkline values={historiaValores(c.historia)} tone={cfg.tono} />
              <span className="min-w-[7.5rem] text-right text-sm tabular">
                {variante === "reactivar" ? (
                  <>
                    <span className="font-semibold text-ink">{numero(c.tnPico)} tn</span>
                    <span className="block text-xs text-ink-soft">en {c.campaniaPico}</span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-ink">{numero(c.tn)} tn</span>
                    <span className="block text-xs text-rojo">−{numero(c.tnPico - c.tn)} vs. pico</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {ordenados.length > TOPE && (
        <p className="mt-2 text-xs text-ink-soft">y {ordenados.length - TOPE} más…</p>
      )}
    </section>
  );
}
