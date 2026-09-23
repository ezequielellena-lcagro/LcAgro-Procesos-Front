import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CampaniaSelect } from "@/shared/components/campania-select";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { numero, numero3, oDash, tn, usd } from "@/shared/format/format";
import { confirmarCambioConBorrador } from "@/shared/hooks/use-aviso-cambios-sin-guardar";
import { CULTIVOS_MARKET, type ContextoPlanificacion, type MercadoCultivoResumen } from "../types";
import { etiquetaCampania, filaMarket, NOMBRES_MARKET, sinDatosMarket } from "../lib/market-share";
import { useMarketShare } from "../queries/use-market-share";
import { MarketShareDialog } from "./market-share-dialog";

/**
 * Solapa Market Share: parámetros guardados de la campaña y su resumen, ambos de sólo lectura.
 * La carga y la edición viven en `MarketShareDialog`; acá sólo se elige campaña y se recarga.
 */
export function MarketShareForm({
  contexto,
  activo,
  onDirtyChange,
}: {
  contexto: ContextoPlanificacion;
  activo: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [campaniaElegida, setCampaniaElegida] = useState<string>();
  const campania = campaniaElegida ?? contexto.campaniaVigente;
  const [abierto, setAbierto] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [mensajeError, setMensajeError] = useState<string>();
  const [requiereRecarga, setRequiereRecarga] = useState(false);
  const [recargando, setRecargando] = useState(false);
  const query = useMarketShare(campania, activo);
  const dataVigente =
    query.data?.campania === campania && !query.isPlaceholderData ? query.data : undefined;
  const editable = !!dataVigente?.editable && !query.isError;
  useEffect(() => onDirtyChange(dirty), [onDirtyChange, dirty]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  function cambiarCampania(nueva: string) {
    if (recargando || nueva === campania || !confirmarCambioConBorrador(dirty)) return;
    // El modal carga una campaña puntual: si cambia la selección, se cierra con su borrador.
    setAbierto(false);
    setMensajeError(undefined);
    setRequiereRecarga(false);
    setCampaniaElegida(nueva);
  }

  async function recargar(): Promise<boolean> {
    setRecargando(true);
    try {
      const resultado = await query.refetch();
      return !resultado.isError && resultado.data?.campania === campania;
    } catch {
      return false;
    } finally {
      setRecargando(false);
    }
  }

  async function reintentar(): Promise<boolean> {
    if (!(await recargar())) return false;
    setRequiereRecarga(false);
    setMensajeError(undefined);
    return true;
  }

  // Tras guardar, la campaña queda bloqueada hasta que el GET traiga las revisiones nuevas: volver
  // a editar con las viejas en mano devolvería 409.
  async function despuesDeGuardar() {
    setRequiereRecarga(true);
    setMensajeError(undefined);
    if (await reintentar()) toast.success("Market Share guardado.");
    else
      setMensajeError(
        "Market Share se guardó, pero no se pudo recargar. Reintentá antes de editar.",
      );
  }

  async function recargarTrasConflicto() {
    setRequiereRecarga(true);
    setMensajeError(undefined);
    if (!(await reintentar()))
      setMensajeError("No se pudo recargar Market Share. Reintentá antes de editar.");
  }

  if (!activo) return null;
  return (
    <div className="space-y-5">
      <FilterBar>
        <FilterField label="Campaña">
          <CampaniaSelect
            value={campania}
            campanias={contexto.campanias.map((item) => item.codigo)}
            onChange={cambiarCampania}
            disabled={recargando}
          />
        </FilterField>
      </FilterBar>

      {query.isError && !dataVigente ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !dataVigente ? (
        <EmptyState mensaje={"Cargando Market Share de " + etiquetaCampania(campania) + "…"} />
      ) : (
        <>
          {!editable && (
            <div className="rounded-card border border-line bg-panel-soft px-4 py-3 text-sm text-ink-soft">
              Esta campaña es de solo lectura.
            </div>
          )}
          {mensajeError && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-card border border-rojo bg-red-50 px-4 py-3 text-sm text-rojo"
            >
              <span>{mensajeError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void reintentar()}
                disabled={recargando}
              >
                Reintentar recarga
              </Button>
            </div>
          )}
          <section className="rounded-card border border-line bg-panel shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">
                  Parámetros por cultivo
                </h2>
                <p className="text-sm text-ink-soft">
                  El costo se calcula con qq de insumo por hectárea × precio USD/tn ÷ 10.
                </p>
              </div>
              {editable && (
                <Button
                  type="button"
                  onClick={() => setAbierto(true)}
                  disabled={recargando || requiereRecarga}
                >
                  {sinDatosMarket(dataVigente.cultivos)
                    ? "Nuevo Market Share"
                    : "Editar Market Share"}
                </Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-panel-soft text-xs uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left">
                      Cultivo
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      qq insumo/ha
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Precio estimado USD/tn
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Costo USD/ha
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Rinde tn/ha
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CULTIVOS_MARKET.map((cultivo) => {
                    const fila = filaMarket(dataVigente.cultivos, cultivo);
                    return (
                      <tr
                        key={cultivo}
                        data-testid={"market-row-" + cultivo}
                        className="border-t border-line even:bg-panel-soft/50"
                      >
                        <th scope="row" className="px-4 py-3 text-left font-semibold text-ink">
                          {NOMBRES_MARKET[cultivo]}
                        </th>
                        <td className="px-4 py-3 text-right tabular">
                          {oDash(fila.qqInsumoHa, numero3)}
                        </td>
                        <td className="px-4 py-3 text-right tabular">
                          {oDash(fila.precioUsdTn, usd)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular text-ink">
                          {oDash(fila.costoUsdHa, usd)}
                        </td>
                        <td className="px-4 py-3 text-right tabular">
                          {oDash(fila.rindeTnHa, numero3)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr
                    data-testid="market-row-otro"
                    className="border-t border-line bg-panel-soft/70 text-ink-soft"
                  >
                    <th scope="row" className="px-4 py-3 text-left">
                      <span className="font-semibold">Otro</span>
                      <span className="ml-2 text-xs">sin costo por ahora: no suma</span>
                    </th>
                    <td colSpan={4} className="px-4 py-3 text-right">
                      —
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3" aria-label="Resumen de campaña">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Resumen de la campaña</h2>
              <p className="text-sm text-ink-soft">
                Valores guardados. Se actualizan después de guardar.
              </p>
            </div>
            <div className="overflow-x-auto rounded-card border border-line bg-panel">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-panel-soft text-xs uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left">
                      Cultivo
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      Hectáreas
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      Costo USD/ha
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      Mercado USD
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      Rinde tn/ha
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      Potencial tn
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CULTIVOS_MARKET.map((cultivo) => {
                    const resumen: MercadoCultivoResumen = dataVigente.resumen[cultivo];
                    return (
                      <tr key={cultivo} className="border-t border-line">
                        <th scope="row" className="px-4 py-2 text-left">
                          {NOMBRES_MARKET[cultivo]}
                        </th>
                        <td className="px-4 py-2 text-right tabular">
                          {numero(resumen.hectareas)}
                        </td>
                        <td className="px-4 py-2 text-right tabular">
                          {oDash(resumen.costoUsdHa, usd)}
                        </td>
                        <td className="px-4 py-2 text-right tabular">
                          {oDash(resumen.mercadoUsd, usd)}
                        </td>
                        <td className="px-4 py-2 text-right tabular">
                          {oDash(resumen.rindeTnHa, numero3)}
                        </td>
                        <td className="px-4 py-2 text-right tabular">
                          {oDash(resumen.potencialTn, tn)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-line bg-panel-soft/70 text-ink-soft">
                    <th scope="row" className="px-4 py-2 text-left">
                      Otro
                    </th>
                    <td className="px-4 py-2 text-right tabular">
                      {numero(dataVigente.resumen.hectareasOtro)}
                    </td>
                    <td colSpan={4} className="px-4 py-2 text-right">
                      sin costo por ahora: no suma
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {abierto && (
            <MarketShareDialog
              campania={campania}
              cultivos={dataVigente.cultivos}
              copiarDe={dataVigente.copiarDe}
              onCerrar={() => setAbierto(false)}
              onGuardado={() => void despuesDeGuardar()}
              onRecargar={() => void recargarTrasConflicto()}
              onDirtyChange={setDirty}
            />
          )}
        </>
      )}
    </div>
  );
}
