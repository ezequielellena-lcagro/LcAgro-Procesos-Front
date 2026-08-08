import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { aplicarCambio, totalCuota, totales, type FilaCuota } from "../cronograma";
import { importe } from "../format";

/** Acepta coma o punto como separador decimal (el usuario tipea en es-AR). */
function aNumero(v: string): number {
  const n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

interface Props {
  cuotas: FilaCuota[];
  onChange: (cuotas: FilaCuota[]) => void;
  /** Cuotas ya pagadas: se muestran bloqueadas porque son historia y no se editan. */
  bloqueadas?: number[];
  disabled?: boolean;
}

/**
 * Cronograma editable celda por celda. Es una PROPUESTA que el usuario corrige contra el cuadro de
 * marcha del banco: los vencimientos reales no siguen meses calendario exactos (el préstamo
 * TEDESCHI va de a ~180 días corridos) y el interés lo liquida el banco.
 *
 * El IVA se autocompleta al 12 % del interés, pero se respeta si el usuario lo pisa — ver
 * `aplicarCambio`.
 */
export function CronogramaEditor({ cuotas, onChange, bloqueadas = [], disabled = false }: Props) {
  const t = totales(cuotas);

  const editar = (i: number, cambio: Partial<FilaCuota>) =>
    onChange(cuotas.map((c, j) => (i === j ? aplicarCambio(c, cambio) : c)));

  const agregar = () => {
    const ultima = cuotas.at(-1);
    onChange([
      ...cuotas,
      {
        nroCuota: (ultima?.nroCuota ?? 0) + 1,
        // Arranca en la fecha de la última: casi siempre hay que correrla, pero escribir una fecha
        // entera desde cero es peor que ajustar una cercana.
        fechaVencimiento: ultima?.fechaVencimiento ?? new Date().toISOString().slice(0, 10),
        capital: 0,
        interes: 0,
        iva: 0,
      },
    ]);
  };

  const quitar = (i: number) => onChange(cuotas.filter((_, j) => j !== i));

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-panel-soft text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-2 py-2 text-left font-semibold">Cuota</th>
              <th className="px-2 py-2 text-left font-semibold">Vencimiento</th>
              <th className="px-2 py-2 text-right font-semibold">Capital</th>
              <th className="px-2 py-2 text-right font-semibold">Interés</th>
              <th className="px-2 py-2 text-right font-semibold">IVA</th>
              <th className="px-2 py-2 text-right font-semibold">Total</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {cuotas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-ink-soft">
                  Todavía no hay cuotas. Usá el asistente o agregalas a mano.
                </td>
              </tr>
            ) : (
              cuotas.map((c, i) => {
                const bloqueada = bloqueadas.includes(c.nroCuota);
                return (
                  <tr key={i} className="border-b border-line/60 last:border-0">
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Número de cuota ${i + 1}`}
                        type="number"
                        min="1"
                        className="w-16"
                        value={c.nroCuota}
                        disabled={disabled || bloqueada}
                        onChange={(e) => editar(i, { nroCuota: Number(e.target.value) })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <DateField
                        value={c.fechaVencimiento}
                        disabled={disabled || bloqueada}
                        onChange={(v) => editar(i, { fechaVencimiento: v })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Capital de la cuota ${c.nroCuota}`}
                        inputMode="decimal"
                        className="w-32 text-right"
                        value={c.capital}
                        disabled={disabled || bloqueada}
                        onChange={(e) => editar(i, { capital: aNumero(e.target.value) })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Interés de la cuota ${c.nroCuota}`}
                        inputMode="decimal"
                        className="w-32 text-right"
                        value={c.interes}
                        disabled={disabled || bloqueada}
                        onChange={(e) => editar(i, { interes: aNumero(e.target.value) })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`IVA de la cuota ${c.nroCuota}`}
                        inputMode="decimal"
                        className="w-28 text-right"
                        value={c.iva}
                        disabled={disabled || bloqueada}
                        onChange={(e) => editar(i, { iva: aNumero(e.target.value) })}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular">
                      {importe(totalCuota(c))}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {!bloqueada && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Quitar la cuota ${c.nroCuota}`}
                          disabled={disabled}
                          onClick={() => quitar(i)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {cuotas.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-line bg-panel-soft font-semibold tabular">
                <td className="px-2 py-2" colSpan={2}>
                  TOTAL
                </td>
                <td className="px-2 py-2 text-right">{importe(t.capital)}</td>
                <td className="px-2 py-2 text-right">{importe(t.interes)}</td>
                <td className="px-2 py-2 text-right">{importe(t.iva)}</td>
                <td className="px-2 py-2 text-right">{importe(t.total)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={agregar} disabled={disabled}>
        <Plus className="mr-1 size-4" /> Agregar cuota
      </Button>
    </div>
  );
}
