import { AlertTriangle, History, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fecha } from "@/shared/format/format";
import { importe } from "../format";
import type { ReconstruccionCronograma } from "../types";

interface Props {
  /** Cuántos números de cuota le faltan al cronograma para llegar a los declarados. */
  faltantes: number;
  propuesta?: ReconstruccionCronograma;
  cargando: boolean;
  error: string | null;
  onBuscar: () => void;
  onConfirmar: () => void;
  aplicando: boolean;
  puedeGestionar: boolean;
}

/**
 * Trae las cuotas viejas desde los débitos de MacroGest.
 *
 * <p>Los préstamos que entraron por el Excel arrancan en la cuota que estaba pendiente el día de la
 * carga: el de Nación declara ocho cuotas y su cronograma empieza en la 5. Las cuatro primeras se
 * pagaron, pero no existen en ninguna fila — el "4 pagadas" del encabezado es una resta.</p>
 *
 * <p>Nada se crea sin verse antes, y cada cuota muestra <b>de qué movimiento sale</b>. Es lo que
 * separa reconstruir desde el banco de inventar filas.</p>
 */
export function ReconstruirCronograma({
  faltantes,
  propuesta,
  cargando,
  error,
  onBuscar,
  onConfirmar,
  aplicando,
  puedeGestionar,
}: Props) {
  if (faltantes <= 0) return null;

  return (
    <div className="mt-3 rounded-md border border-line-soft bg-panel-soft/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <History className="size-4 shrink-0 text-ink-soft" />
        <p className="flex-1 text-sm text-ink">
          <strong>Faltan {faltantes} cuotas anteriores.</strong> Se cargaron sólo las que estaban
          pendientes; los débitos de MacroGest tienen las que ya se pagaron.
        </p>
        {!propuesta && (
          <Button type="button" size="sm" variant="outline" onClick={onBuscar} disabled={cargando}>
            <Search className="mr-1 size-3.5" />
            {cargando ? "Buscando…" : "Buscar en MacroGest"}
          </Button>
        )}
      </div>

      {error && (
        <p className="mt-2 rounded-md border border-rojo/30 bg-rojo-bg px-3 py-2 text-sm text-rojo">
          {error}
        </p>
      )}

      {propuesta && (
        <div className="mt-3">
          {propuesta.cuotas.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-line-soft bg-panel">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-soft text-xs text-ink-soft">
                    <th className="px-2 py-1.5 text-left font-medium">Cuota</th>
                    <th className="px-2 py-1.5 text-left font-medium">Vencía</th>
                    <th className="px-2 py-1.5 text-right font-medium">Capital</th>
                    <th className="px-2 py-1.5 text-right font-medium">Interés</th>
                    <th className="px-2 py-1.5 text-right font-medium">IVA</th>
                    <th className="px-2 py-1.5 text-left font-medium">Se pagó</th>
                  </tr>
                </thead>
                <tbody>
                  {propuesta.cuotas.map((c, i) => (
                    <tr key={c.nroCuota} className={i % 2 === 1 ? "bg-line-soft/45" : undefined}>
                      <td className="px-2 py-1.5 tabular">{c.nroCuota}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 tabular">
                        {fecha(c.fechaVencimiento)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular">{importe(c.capital)}</td>
                      <td className="px-2 py-1.5 text-right tabular">{importe(c.interes)}</td>
                      <td className="px-2 py-1.5 text-right tabular">{importe(c.iva)}</td>
                      {/* El respaldo es el dato que hace verificable la cuota: va a la vista, no
                          escondido en un tooltip. */}
                      <td className="px-2 py-1.5 text-xs text-ink-soft">
                        {c.respaldo?.replace(/^MacroGest · DE \d+ · /, "") ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {propuesta.advertencias.map((a) => (
            <p key={a} className="mt-2 flex items-start gap-1.5 text-xs text-ink-soft">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-clementina-deep" />
              {a}
            </p>
          ))}

          {propuesta.cuotas.length > 0 && puedeGestionar && (
            <div className="mt-3 flex items-center justify-end gap-2">
              <p className="mr-auto text-xs text-ink-soft">
                Quedan pagadas: el saldo no se mueve.
              </p>
              <Button type="button" size="sm" variant="accent" onClick={onConfirmar} disabled={aplicando}>
                {aplicando ? "Agregando…" : `Agregar las ${propuesta.cuotas.length} cuotas`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
