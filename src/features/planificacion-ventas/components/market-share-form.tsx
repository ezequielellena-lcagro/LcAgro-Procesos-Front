import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toAppError } from "@/lib/api-error";
import { CampaniaSelect } from "@/shared/components/campania-select";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { KpiCard } from "@/shared/components/kpi-card";
import { numero, numero3, oDash, pct, tn, usd } from "@/shared/format/format";
import { confirmarCambioConBorrador } from "@/shared/hooks/use-aviso-cambios-sin-guardar";
import {
  CULTIVOS_MARKET,
  type ContextoPlanificacion,
  type CultivoMarket,
  type MarketShareCultivoResponse,
  type MercadoCultivoResumen,
} from "../types";
import {
  cambiosMarket,
  copiarMarketShare,
  cultivosEditados,
  editarMarketShare,
  erroresMarket,
  finalizarMarketShare,
  textoCampo,
  valorCampo,
  type BorradorMarketShare,
  type CampoMarket,
} from "../lib/borrador-market-share";
import { useGuardarMarketShare, useMarketShare } from "../queries/use-market-share";

const NOMBRES: Record<CultivoMarket, string> = {
  soja: "Soja",
  maiz: "Ma\u00edz",
  trigo: "Trigo",
};
const CAMPOS: { campo: CampoMarket; titulo: string; etiqueta: string }[] = [
  { campo: "qqInsumoHa", titulo: "qq insumo/ha", etiqueta: "qq insumo/ha" },
  { campo: "precioUsdTn", titulo: "Precio estimado USD/tn", etiqueta: "Precio USD/tn" },
  { campo: "rindeTnHa", titulo: "Rinde tn/ha", etiqueta: "Rinde tn/ha" },
];
const VACIO: Omit<MarketShareCultivoResponse, "cultivo"> = {
  qqInsumoHa: null,
  precioUsdTn: null,
  costoUsdHa: null,
  rindeTnHa: null,
  revision: 0,
  modificadoPor: null,
  modificadoEl: null,
};

function etiquetaCampania(campania: string): string {
  return campania.slice(0, 4) + "/" + campania.slice(-2);
}

function CeldaResumen({
  valor,
  formato,
}: {
  valor: number | null;
  formato: (valor: number) => string;
}) {
  return <>{oDash(valor, formato)}</>;
}

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
  const [borrador, setBorrador] = useState<BorradorMarketShare>({});
  const [mensajeError, setMensajeError] = useState<string>();
  const [conflicto, setConflicto] = useState(false);
  const [requiereRecarga, setRequiereRecarga] = useState(false);
  const [guardandoLocal, setGuardandoLocal] = useState(false);
  const [recargando, setRecargando] = useState(false);
  const query = useMarketShare(campania, activo);
  const guardar = useGuardarMarketShare();
  const dataVigente =
    query.data?.campania === campania && !query.isPlaceholderData ? query.data : undefined;
  const sinDatos =
    !!dataVigente &&
    dataVigente.cultivos.every(
      (fila) => fila.qqInsumoHa === null && fila.precioUsdTn === null && fila.rindeTnHa === null,
    );
  const anterior = useMarketShare(
    dataVigente?.copiarDe ?? undefined,
    activo && sinDatos && !!dataVigente?.copiarDe,
  );
  const anteriorVigente =
    anterior.data?.campania === dataVigente?.copiarDe && !anterior.isPlaceholderData
      ? anterior.data
      : undefined;
  const editable = !!dataVigente?.editable && !requiereRecarga && !query.isError;
  const guardando = guardar.isPending || guardandoLocal || recargando;
  const dirty = Object.keys(borrador).length > 0;
  useEffect(() => onDirtyChange(dirty), [onDirtyChange, dirty]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const errores = useMemo(() => erroresMarket(borrador), [borrador]);
  const hayErrores = Object.values(errores).some((porCampo) => Object.keys(porCampo).length > 0);
  const cambios = useMemo(() => cambiosMarket(borrador), [borrador]);
  const cantidad = cultivosEditados(borrador);

  function descartar() {
    setBorrador({});
    setMensajeError(undefined);
    setConflicto(false);
    setRequiereRecarga(false);
  }

  function cambiarCampania(nueva: string) {
    if (guardando || nueva === campania || !confirmarCambioConBorrador(dirty)) return;
    descartar();
    setCampaniaElegida(nueva);
  }

  async function recargar(descartarAlTerminar: boolean) {
    setRecargando(true);
    try {
      const resultado = await query.refetch();
      if (resultado.isError || resultado.data?.campania !== campania)
        throw new Error("Recarga fallida");
      if (descartarAlTerminar) descartar();
      else {
        setRequiereRecarga(false);
        setMensajeError(undefined);
      }
      return true;
    } catch {
      setMensajeError("No se pudo recargar Market Share. Conservamos los cambios pendientes.");
      return false;
    } finally {
      setRecargando(false);
    }
  }

  async function guardarCambios() {
    if (!editable || conflicto || guardando || hayErrores || !cambios.length) return;
    setGuardandoLocal(true);
    try {
      try {
        await guardar.mutateAsync({ campania, request: { cultivos: cambios } });
      } catch (error) {
        const respuesta = toAppError(error);
        setConflicto(respuesta.status === 409);
        setMensajeError(respuesta.message);
        return;
      }
      setBorrador({});
      setConflicto(false);
      setRequiereRecarga(true);
      const actualizado = await recargar(false);
      if (actualizado) toast.success("Market Share guardado.");
      else
        setMensajeError(
          "Market Share se guard\u00f3, pero no se pudo recargar. Reintent\u00e1 antes de editar.",
        );
    } finally {
      setGuardandoLocal(false);
    }
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
            disabled={guardando}
          />
        </FilterField>
      </FilterBar>

      {query.isError && !dataVigente ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !dataVigente ? (
        <EmptyState mensaje={"Cargando Market Share de " + etiquetaCampania(campania) + "\u2026"} />
      ) : (
        <>
          {!editable && !requiereRecarga && (
            <div className="rounded-card border border-line bg-panel-soft px-4 py-3 text-sm text-ink-soft">
              Esta campaña es de solo lectura.
            </div>
          )}
          {sinDatos && dataVigente.copiarDe && editable && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-panel-soft px-4 py-3">
              <p className="text-sm text-ink-soft">
                Esta campaña todavía no tiene parámetros cargados.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={!anteriorVigente || guardando}
                onClick={() => {
                  if (anteriorVigente && !guardando)
                    setBorrador((actual) =>
                      copiarMarketShare(actual, dataVigente.cultivos, anteriorVigente.cultivos),
                    );
                }}
              >
                Copiar valores de {etiquetaCampania(dataVigente.copiarDe)}
              </Button>
            </div>
          )}
          {mensajeError && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-card border border-rojo bg-red-50 px-4 py-3 text-sm text-rojo"
            >
              <span>{mensajeError}</span>
              {(conflicto || requiereRecarga) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void recargar(conflicto)}
                  disabled={guardando}
                >
                  {conflicto ? "Descartar y recargar cultivos" : "Reintentar recarga"}
                </Button>
              )}
            </div>
          )}
          <section className="rounded-card border border-line bg-panel shadow-card">
            <div className="border-b border-line px-5 py-4">
              <h2 className="font-display text-lg font-semibold text-ink">
                Parámetros por cultivo
              </h2>
              <p className="text-sm text-ink-soft">
                El costo se calcula con qq de insumo por hectárea × precio USD/tn ÷
                10.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm">
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
                    const fila = dataVigente.cultivos.find((item) => item.cultivo === cultivo) ?? {
                      ...VACIO,
                      cultivo,
                    };
                    const qq = valorCampo(fila, borrador, "qqInsumoHa");
                    const precio = valorCampo(fila, borrador, "precioUsdTn");
                    const costo =
                      qq !== null &&
                      precio !== null &&
                      Number.isFinite(qq) &&
                      Number.isFinite(precio)
                        ? (qq * precio) / 10
                        : null;
                    return (
                      <tr
                        key={cultivo}
                        data-testid={"market-form-row-" + cultivo}
                        className="border-t border-line even:bg-panel-soft/50"
                      >
                        <th scope="row" className="px-4 py-3 text-left font-semibold text-ink">
                          {NOMBRES[cultivo]}
                        </th>
                        {CAMPOS.slice(0, 2).map(({ campo, etiqueta }) => (
                          <td key={campo} className="px-3 py-2 text-right">
                            <Input
                              aria-label={etiqueta + " de " + NOMBRES[cultivo]}
                              aria-invalid={!!errores[cultivo]?.[campo]}
                              title={errores[cultivo]?.[campo]}
                              inputMode="decimal"
                              disabled={!editable || conflicto || guardando}
                              value={textoCampo(fila, borrador, campo)}
                              onChange={(evento) => {
                                if (guardando) return;
                                setBorrador((actual) =>
                                  editarMarketShare(actual, fila, campo, evento.target.value),
                                );
                              }}
                              onBlur={() =>
                                setBorrador((actual) => finalizarMarketShare(actual, cultivo))
                              }
                              className="ml-auto h-9 w-32 text-right tabular"
                            />
                            {errores[cultivo]?.[campo] && (
                              <span className="mt-1 block text-xs text-rojo">
                                {errores[cultivo]?.[campo]}
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right font-semibold tabular text-ink">
                          <CeldaResumen valor={costo} formato={usd} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            aria-label={"Rinde tn/ha de " + NOMBRES[cultivo]}
                            aria-invalid={!!errores[cultivo]?.rindeTnHa}
                            title={errores[cultivo]?.rindeTnHa}
                            inputMode="decimal"
                            disabled={!editable || conflicto || guardando}
                            value={textoCampo(fila, borrador, "rindeTnHa")}
                            onChange={(evento) => {
                              if (guardando) return;
                              setBorrador((actual) =>
                                editarMarketShare(actual, fila, "rindeTnHa", evento.target.value),
                              );
                            }}
                            onBlur={() =>
                              setBorrador((actual) => finalizarMarketShare(actual, cultivo))
                            }
                            className="ml-auto h-9 w-32 text-right tabular"
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
          </section>

          <section className="space-y-3" aria-label="Resumen de campaña">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">
                Resumen de la campaña
              </h2>
              <p className="text-sm text-ink-soft">
                Valores guardados. Se actualizan después de guardar.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <KpiCard
                label="Mercado"
                value={oDash(dataVigente.resumen.mercadoUsd, usd)}
                hint="USD estimados"
              />
              <KpiCard
                label="Facturación LC"
                value={usd(dataVigente.resumen.facturacionLcUsd)}
              />
              <KpiCard
                label="Participación LC"
                value={oDash(dataVigente.resumen.participacionLc, (valor) => pct(valor * 100))}
              />
              <KpiCard label="Potencial" value={oDash(dataVigente.resumen.potencialTn, tn)} />
              <KpiCard label="Originación" value={tn(dataVigente.resumen.originacionTn)} />
              <KpiCard
                label="Participación en originación"
                value={oDash(dataVigente.resumen.participacionOriginacion, (valor) =>
                  pct(valor * 100),
                )}
              />
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
                          {NOMBRES[cultivo]}
                        </th>
                        <td className="px-4 py-2 text-right tabular">
                          {numero(resumen.hectareas)}
                        </td>
                        <td className="px-4 py-2 text-right tabular">
                          <CeldaResumen valor={resumen.costoUsdHa} formato={usd} />
                        </td>
                        <td className="px-4 py-2 text-right tabular">
                          <CeldaResumen valor={resumen.mercadoUsd} formato={usd} />
                        </td>
                        <td className="px-4 py-2 text-right tabular">
                          <CeldaResumen valor={resumen.rindeTnHa} formato={numero3} />
                        </td>
                        <td className="px-4 py-2 text-right tabular">
                          <CeldaResumen valor={resumen.potencialTn} formato={tn} />
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

          {editable && cantidad > 0 && (
            <div className="sticky bottom-3 z-30 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-ink px-4 py-3 text-panel shadow-xl">
              <span className="text-sm font-semibold">
                {cantidad} {cantidad === 1 ? "cultivo modificado" : "cultivos modificados"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-panel hover:text-ink"
                  onClick={descartar}
                  disabled={guardando}
                >
                  Descartar
                </Button>
                <Button
                  type="button"
                  onClick={() => void guardarCambios()}
                  disabled={guardando || hayErrores || conflicto || cambios.length === 0}
                >
                  {guardando ? "Guardando\u2026" : "Guardar cambios"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
