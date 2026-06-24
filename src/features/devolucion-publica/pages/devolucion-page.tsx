import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDevolucionPublica } from "../queries/use-devolucion-publica";
import { useGuardarDevoluciones } from "../queries/use-guardar-devoluciones";

const usd = (n: number) => `US$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-panel-soft">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
          <div className="grid size-10 place-items-center rounded-card bg-slate-brand font-display text-lg font-semibold text-clementina">
            LC
          </div>
          <div>
            <p className="font-display text-lg font-semibold leading-tight text-ink">La Clementina</p>
            <p className="text-xs text-ink-soft">Devolución de cuentas corrientes</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}

export function DevolucionPage() {
  const { token = "" } = useParams();
  const q = useDevolucionPublica(token);
  const guardar = useGuardarDevoluciones(token);
  // Edits locales: sólo lo que el usuario modificó; el resto se lee de q.data.
  const [overrides, setOverrides] = useState<Record<number, string>>({});

  if (q.isPending) {
    return (
      <Marco>
        <p className="py-16 text-center text-ink-soft">Cargando…</p>
      </Marco>
    );
  }

  if (q.isError || !q.data) {
    return (
      <Marco>
        <div className="mx-auto max-w-md rounded-card border border-line bg-panel p-8 text-center shadow-card">
          <p className="font-display text-lg font-semibold text-ink">Link no válido o vencido</p>
          <p className="mt-2 text-sm text-ink-soft">
            Este enlace no es válido o ya venció (duran 24 h). Pedile uno nuevo a La Clementina.
          </p>
        </div>
      </Marco>
    );
  }

  const getDevol = (cuenta: number, def: string | null) => (cuenta in overrides ? overrides[cuenta] : (def ?? ""));
  const onGuardar = () =>
    guardar.mutate(
      q.data.items.map((i) => ({ cuenta: i.cuenta, devolucion: getDevol(i.cuenta, i.devolucion).trim() || null })),
    );

  return (
    <Marco>
      <div className="rounded-card border border-line bg-panel p-6 shadow-card">
        <h1 className="font-display text-2xl font-semibold text-ink">Cuentas de {q.data.vendedor}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Completá la <strong>Devolución</strong> de cada cuenta y guardá. El link vence el{" "}
          {new Date(q.data.expiraUtc).toLocaleString("es-AR")}.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="py-2 pr-3 font-medium">Cuenta</th>
                <th className="py-2 pr-3 font-medium">Cliente</th>
                <th className="py-2 pr-3 text-right font-medium">Vencido</th>
                <th className="py-2 pr-3 text-right font-medium">A vencer</th>
                <th className="py-2 pr-3 text-right font-medium">Saldo</th>
                <th className="py-2 font-medium">Devolución</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((i) => (
                <tr key={i.cuenta} className="border-b border-line/60">
                  <td className="py-2 pr-3 tabular-nums text-ink-soft">{i.cuenta}</td>
                  <td className="py-2 pr-3 text-ink">{i.denominacion}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-ink">{usd(i.saldoVencido)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-ink-soft">{usd(i.saldoAVencer)}</td>
                  <td className="py-2 pr-3 text-right font-medium tabular-nums text-ink">{usd(i.saldo)}</td>
                  <td className="py-2">
                    <Input
                      value={getDevol(i.cuenta, i.devolucion)}
                      onChange={(e) => setOverrides((p) => ({ ...p, [i.cuenta]: e.target.value }))}
                      placeholder="Respuesta del cliente…"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-ink-soft">{q.data.items.length} cuenta(s)</p>
          <Button variant="accent" onClick={onGuardar} disabled={guardar.isPending}>
            {guardar.isPending ? "Guardando…" : "Guardar devoluciones"}
          </Button>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-ink-soft">
        La Clementina S.A. · Si tenés dudas, respondé el email que recibiste.
      </p>
    </Marco>
  );
}
