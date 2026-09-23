import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { toAppError } from "@/lib/api-error";
import { oDash, usd } from "@/shared/format/format";
import { confirmarCambioConBorrador } from "@/shared/hooks/use-aviso-cambios-sin-guardar";
import { CULTIVOS_MARKET, type MarketShareCultivoResponse } from "../types";
import {
  cambiosMarket,
  copiarMarketShare,
  editarMarketShare,
  erroresMarket,
  finalizarMarketShare,
  textoCampo,
  valorCampo,
  type BorradorMarketShare,
  type CampoMarket,
} from "../lib/borrador-market-share";
import {
  costoUsdHa,
  etiquetaCampania,
  filaMarket,
  NOMBRES_MARKET,
  sinDatosMarket,
} from "../lib/market-share";
import { useGuardarMarketShare, useMarketShare } from "../queries/use-market-share";

const CAMPOS: { campo: CampoMarket; titulo: string; etiqueta: string }[] = [
  { campo: "qqInsumoHa", titulo: "qq insumo/ha", etiqueta: "qq insumo/ha" },
  { campo: "precioUsdTn", titulo: "Precio estimado USD/tn", etiqueta: "Precio USD/tn" },
  { campo: "rindeTnHa", titulo: "Rinde tn/ha", etiqueta: "Rinde tn/ha" },
];

/**
 * Carga de los parámetros de Market Share de una campaña: los tres cultivos juntos, en un modal.
 *
 * El borrador vive acá: al cerrar se descarta entero. El PUT manda sólo los cultivos que cambiaron
 * con su `revisionEsperada`, así que un 409 no se resuelve reintentando: hay que recargar desde el
 * panel (`onRecargar`) y volver a abrir.
 */
export function MarketShareDialog({
  campania,
  cultivos,
  copiarDe,
  onCerrar,
  onGuardado,
  onRecargar,
  onDirtyChange,
}: {
  campania: string;
  cultivos: MarketShareCultivoResponse[];
  copiarDe: string | null;
  onCerrar: () => void;
  onGuardado: () => void;
  onRecargar: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [borrador, setBorrador] = useState<BorradorMarketShare>({});
  const [mensajeError, setMensajeError] = useState<string>();
  const [conflicto, setConflicto] = useState(false);
  const [guardandoLocal, setGuardandoLocal] = useState(false);
  const guardar = useGuardarMarketShare();
  const sinDatos = sinDatosMarket(cultivos);
  const anterior = useMarketShare(copiarDe ?? undefined, sinDatos && !!copiarDe);
  const anteriorVigente =
    anterior.data?.campania === copiarDe && !anterior.isPlaceholderData ? anterior.data : undefined;
  const ocupado = guardar.isPending || guardandoLocal;
  const dirty = Object.keys(borrador).length > 0;
  useEffect(() => onDirtyChange(dirty), [onDirtyChange, dirty]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const errores = useMemo(() => erroresMarket(borrador), [borrador]);
  const hayErrores = Object.values(errores).some((porCampo) => Object.keys(porCampo).length > 0);
  const cambios = useMemo(() => cambiosMarket(borrador), [borrador]);

  function cerrar() {
    if (ocupado || !confirmarCambioConBorrador(dirty)) return;
    onCerrar();
  }

  function descartarYRecargar() {
    if (ocupado) return;
    onDirtyChange(false);
    onCerrar();
    onRecargar();
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado || conflicto || hayErrores || !cambios.length) return;
    setGuardandoLocal(true);
    try {
      await guardar.mutateAsync({ campania, request: { cultivos: cambios } });
    } catch (error) {
      const respuesta = toAppError(error);
      setConflicto(respuesta.status === 409);
      setMensajeError(respuesta.message);
      setGuardandoLocal(false);
      return;
    }
    onDirtyChange(false);
    onCerrar();
    onGuardado();
  }

  return (
    <Modal
      open
      onClose={cerrar}
      className="max-w-3xl"
      title={
        (sinDatos ? "Nuevo Market Share · " : "Editar Market Share · ") + etiquetaCampania(campania)
      }
    >
      <form onSubmit={(evento) => void enviar(evento)} className="space-y-4" noValidate>
        <p className="text-sm text-ink-soft">
          El costo se calcula con qq de insumo por hectárea × precio USD/tn ÷ 10.
        </p>

        {sinDatos && copiarDe && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-panel-soft px-4 py-3">
            <p className="text-sm text-ink-soft">
              Esta campaña todavía no tiene parámetros cargados.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={!anteriorVigente || ocupado}
              onClick={() => {
                if (anteriorVigente && !ocupado)
                  setBorrador((actual) =>
                    copiarMarketShare(actual, cultivos, anteriorVigente.cultivos),
                  );
              }}
            >
              Copiar valores de {etiquetaCampania(copiarDe)}
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-panel-soft text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">
                  Cultivo
                </th>
                {CAMPOS.slice(0, 2).map(({ campo, titulo }) => (
                  <th key={campo} scope="col" className="px-4 py-3 text-right">
                    {titulo}
                  </th>
                ))}
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
                const fila = filaMarket(cultivos, cultivo);
                const costo = costoUsdHa(
                  valorCampo(fila, borrador, "qqInsumoHa"),
                  valorCampo(fila, borrador, "precioUsdTn"),
                );
                return (
                  <tr
                    key={cultivo}
                    data-testid={"market-form-row-" + cultivo}
                    className="border-t border-line even:bg-panel-soft/50"
                  >
                    <th scope="row" className="px-4 py-3 text-left font-semibold text-ink">
                      {NOMBRES_MARKET[cultivo]}
                    </th>
                    {CAMPOS.slice(0, 2).map(({ campo, etiqueta }) => (
                      <td key={campo} className="px-3 py-2 text-right">
                        <Input
                          aria-label={etiqueta + " de " + NOMBRES_MARKET[cultivo]}
                          aria-invalid={!!errores[cultivo]?.[campo]}
                          title={errores[cultivo]?.[campo]}
                          inputMode="decimal"
                          disabled={ocupado || conflicto}
                          value={textoCampo(fila, borrador, campo)}
                          onChange={(evento) => {
                            if (ocupado) return;
                            setBorrador((actual) =>
                              editarMarketShare(actual, fila, campo, evento.target.value),
                            );
                          }}
                          onBlur={() =>
                            setBorrador((actual) => finalizarMarketShare(actual, cultivo))
                          }
                          className="ml-auto h-9 w-28 text-right tabular"
                        />
                        {errores[cultivo]?.[campo] && (
                          <span className="mt-1 block text-xs text-rojo">
                            {errores[cultivo]?.[campo]}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-semibold tabular text-ink">
                      {oDash(costo, usd)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        aria-label={"Rinde tn/ha de " + NOMBRES_MARKET[cultivo]}
                        aria-invalid={!!errores[cultivo]?.rindeTnHa}
                        title={errores[cultivo]?.rindeTnHa}
                        inputMode="decimal"
                        disabled={ocupado || conflicto}
                        value={textoCampo(fila, borrador, "rindeTnHa")}
                        onChange={(evento) => {
                          if (ocupado) return;
                          setBorrador((actual) =>
                            editarMarketShare(actual, fila, "rindeTnHa", evento.target.value),
                          );
                        }}
                        onBlur={() =>
                          setBorrador((actual) => finalizarMarketShare(actual, cultivo))
                        }
                        className="ml-auto h-9 w-28 text-right tabular"
                      />
                      {errores[cultivo]?.rindeTnHa && (
                        <span className="mt-1 block text-xs text-rojo">
                          {errores[cultivo]?.rindeTnHa}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr
                data-testid="market-form-row-otro"
                className="border-t border-line bg-panel-soft/70 text-ink-soft"
              >
                <th scope="row" className="px-4 py-3 text-left">
                  <span className="font-semibold">Otro</span>
                  <span className="ml-2 text-xs">sin costo por ahora: no suma</span>
                </th>
                <td className="px-3 py-2">
                  <Input disabled aria-label="qq insumo/ha de Otro" value="" />
                </td>
                <td className="px-3 py-2">
                  <Input disabled aria-label="Precio USD/tn de Otro" value="" />
                </td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-3 py-2">
                  <Input disabled aria-label="Rinde tn/ha de Otro" value="" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {mensajeError && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-card border border-rojo bg-red-50 px-4 py-3 text-sm text-rojo"
          >
            <span>{mensajeError}</span>
            {conflicto && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={descartarYRecargar}
                disabled={ocupado}
              >
                Descartar y recargar cultivos
              </Button>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="outline" onClick={cerrar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button type="submit" disabled={ocupado || hayErrores || conflicto || !cambios.length}>
            {ocupado ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
