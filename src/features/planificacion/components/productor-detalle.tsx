import { AlertTriangle, CheckCircle2, CircleHelp, Database, FileSpreadsheet } from "lucide-react";
import type { ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { fecha, numero, pct, usd } from "@/shared/format/format";
import {
  ETIQUETA_BANDA,
  ETIQUETA_CANAL,
  ETIQUETA_CULTIVO,
  TONO_CANAL,
  TONO_SEGMENTO,
} from "../lib/presentacion";
import type {
  ConsolidadoVentasItemDto,
  DesgloseCriterioSegmentacionDto,
  ProductorTableroDetalleDto,
} from "../types";

interface Props {
  detalle: ProductorTableroDetalleDto;
  onClose: () => void;
}

type EstadoDato = "disponible" | "advertencia" | "no-disponible";

/**
 * Ficha de un productor del tablero productivo.
 *
 * Los importes, la participación, la oportunidad y el score se muestran tal como
 * llegan en el snapshot de la API. Este componente sólo les da formato.
 */
export function ProductorDetalle({ detalle, onClose }: Props) {
  const { item, plan } = detalle;
  const productor = item.productor;
  const bayerDisponible = productor.facturacionBayerUsd != null;
  const motivoComparabilidad = motivoDatoNoComparable(productor);
  const desvios = [
    productor.tieneDesvioVendedorLc
      ? "Hay facturación LC vinculada a otro vendedor o sin vendedor."
      : null,
    productor.tieneDesvioVendedorBayer === true
      ? "Hay facturación Bayer vinculada a otro vendedor o sin vendedor."
      : null,
  ].filter((mensaje): mensaje is string => mensaje != null);

  return (
    <Modal open onClose={onClose} title={productor.razonSocial} className="w-full max-w-4xl">
      <div className="space-y-5">
        <header className="rounded-card border border-line bg-panel-soft p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
                Productor · campaña {detalle.campania}
              </p>
              <p className="mt-1 truncate font-display text-xl font-semibold text-ink">
                {productor.razonSocial}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {productor.vendedorNombre ?? "Sin vendedor asignado"}
                {" · "}
                {productor.sucursal ?? "Sin sucursal informada"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-bold",
                  item.segmento ? TONO_SEGMENTO[item.segmento] : "bg-panel text-ink-soft",
                )}
              >
                {item.segmento ? `Segmento ${item.segmento}` : "Sin segmentación"}
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold",
                  productor.canal ? TONO_CANAL[productor.canal] : "bg-panel text-ink-soft",
                )}
              >
                {productor.canal ? ETIQUETA_CANAL[productor.canal] : "Canal no disponible"}
              </span>
            </div>
          </div>

          <dl className="mt-4 grid gap-2 border-t border-line pt-3 text-xs sm:grid-cols-3">
            <Identidad
              termino="Cuenta MacroGest"
              valor={
                productor.cuentaMacroGest == null
                  ? "Sin cuenta MacroGest"
                  : String(productor.cuentaMacroGest)
              }
            />
            <Identidad
              termino="Vendedor"
              valor={
                productor.vendedorCodigo == null
                  ? "Sin código asignado"
                  : `Código ${productor.vendedorCodigo}`
              }
            />
            <Identidad termino="Snapshot" valor={fecha(detalle.generadoEn)} />
          </dl>
        </header>

        <section aria-labelledby="estado-fuentes-titulo">
          <div className="mb-2">
            <h3 id="estado-fuentes-titulo" className="text-sm font-semibold text-ink">
              Estado de las fuentes
            </h3>
            <p className="text-xs text-ink-soft">
              Qué información pudo usar el servidor para este productor.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <FuenteEstado
              icono={<FileSpreadsheet className="size-4" aria-hidden />}
              titulo="Plan de siembra"
              valor={plan.planCargado ? `Cargado · revisión ${plan.revision}` : "Sin cargar"}
              detalle={
                !plan.planCargado
                  ? "No hay hectáreas informadas para la campaña."
                  : plan.vigenteDesde
                    ? `Vigente desde ${fecha(plan.vigenteDesde)}`
                    : "Sin fecha de vigencia informada."
              }
              estado={plan.planCargado ? "disponible" : "advertencia"}
            />
            <FuenteEstado
              icono={<Database className="size-4" aria-hidden />}
              titulo="Mercado"
              valor={
                !plan.planCargado
                  ? "No calculable"
                  : plan.mercadoCompleto
                    ? "Completo"
                    : "Incompleto"
              }
              detalle={detalleEstadoMercado(plan)}
              estado={
                plan.mercadoCompleto
                  ? "disponible"
                  : plan.planCargado
                    ? "advertencia"
                    : "no-disponible"
              }
            />
            <FuenteEstado
              icono={<Database className="size-4" aria-hidden />}
              titulo="Bayer"
              valor={bayerDisponible ? "Disponible" : "Sin importación"}
              detalle={
                bayerDisponible
                  ? "La venta directa está incluida en el snapshot."
                  : "No hay una fuente Bayer disponible para esta campaña."
              }
              estado={bayerDisponible ? "disponible" : "no-disponible"}
            />
          </div>

          {desvios.length > 0 && (
            <div
              role="note"
              className="mt-2 flex gap-2 rounded-md border border-clementina-deep/30 bg-clementina/10 p-3 text-xs text-ink"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-clementina-deep" aria-hidden />
              <div>
                <p className="font-semibold">Revisar asignación de vendedor</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink-soft">
                  {desvios.map((desvio) => (
                    <li key={desvio}>{desvio}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="lectura-comercial-titulo">
          <div className="mb-2">
            <h3 id="lectura-comercial-titulo" className="text-sm font-semibold text-ink">
              Lectura comercial
            </h3>
            <p className="text-xs text-ink-soft">
              Valores calculados por la API para la campaña seleccionada.
            </p>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
            <Metrica
              etiqueta="Mercado conocido"
              valor={
                productor.mercadoConocidoUsd == null
                  ? textoMercadoNoDisponible(productor)
                  : usd(productor.mercadoConocidoUsd)
              }
              detalle={
                productor.mercadoConocidoUsd == null
                  ? undefined
                  : productor.mercadoCompleto
                    ? "Plan y costos completos"
                    : "Valor parcial · faltan costos"
              }
              disponible={productor.mercadoConocidoUsd != null}
            />
            <Metrica
              etiqueta="Facturación LC"
              valor={usd(productor.facturacionLcUsd)}
              detalle="Fuente operativa LC"
            />
            <Metrica
              etiqueta="Facturación Bayer"
              valor={
                productor.facturacionBayerUsd == null
                  ? "Sin importación Bayer"
                  : usd(productor.facturacionBayerUsd)
              }
              detalle={bayerDisponible ? "Venta directa informada" : undefined}
              disponible={bayerDisponible}
            />
            <Metrica
              etiqueta="Facturación total"
              valor={
                productor.facturacionTotalUsd == null
                  ? "No calculable sin Bayer"
                  : usd(productor.facturacionTotalUsd)
              }
              disponible={productor.facturacionTotalUsd != null}
            />
            <Metrica
              etiqueta="Participación"
              valor={
                productor.participacionPct == null
                  ? motivoComparabilidad
                  : pct(productor.participacionPct)
              }
              detalle={
                productor.participacionPct == null
                  ? undefined
                  : "Participación informada por la API"
              }
              disponible={productor.participacionPct != null}
            >
              {productor.participacionPct != null && (
                <BarraParticipacion valor={productor.participacionPct} />
              )}
            </Metrica>
            <Metrica
              etiqueta="Oportunidad"
              valor={
                productor.oportunidadUsd == null
                  ? motivoComparabilidad
                  : usd(productor.oportunidadUsd)
              }
              detalle={
                productor.oportunidadUsd == null ? undefined : "Oportunidad informada por la API"
              }
              disponible={productor.oportunidadUsd != null}
              destacada
            />
          </div>
        </section>

        <section
          aria-labelledby="plan-siembra-titulo"
          className="rounded-card border border-line bg-panel p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 id="plan-siembra-titulo" className="text-sm font-semibold text-ink">
                Plan por cultivo
              </h3>
              <p className="text-xs text-ink-soft">
                Hectáreas y estimaciones guardadas para {plan.campania}.
              </p>
            </div>
            {plan.planCargado && (
              <div className="text-right text-xs text-ink-soft">
                <span className="font-semibold text-ink">{numero(plan.hectareasTotales)} ha</span>
                <br />
                {plan.mercadoCompleto ? "Mercado completo" : "Mercado incompleto"}
              </div>
            )}
          </div>

          {!plan.planCargado || plan.lineas.length === 0 ? (
            <div className="mt-3 rounded-md border border-dashed border-line bg-panel-soft p-5 text-center">
              <p className="text-sm font-medium text-ink">
                {plan.planCargado ? "Plan cargado sin líneas" : "Sin plan de siembra cargado"}
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                {plan.planCargado
                  ? "La API no informó cultivos para esta revisión."
                  : "No hay cultivos ni hectáreas para mostrar en esta campaña."}
              </p>
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <caption className="sr-only">
                  Plan de siembra por cultivo de {productor.razonSocial}
                </caption>
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-wide text-ink-soft">
                    <th scope="col" className="pb-2 text-left font-medium">
                      Cultivo
                    </th>
                    <th scope="col" className="pb-2 text-right font-medium">
                      Hectáreas
                    </th>
                    <th scope="col" className="pb-2 text-right font-medium">
                      Costo USD/ha
                    </th>
                    <th scope="col" className="pb-2 text-right font-medium">
                      Rinde tn/ha
                    </th>
                    <th scope="col" className="pb-2 text-right font-medium">
                      Tn potenciales
                    </th>
                    <th scope="col" className="pb-2 text-right font-medium">
                      Mercado
                    </th>
                    <th scope="col" className="pb-2 text-right font-medium">
                      Origen
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plan.lineas.map((linea, indice) => (
                    <tr
                      key={`${linea.cultivo}-${linea.vigenteDesde}-${indice}`}
                      className="border-b border-line/60"
                    >
                      <th scope="row" className="py-2 text-left font-medium text-ink">
                        {ETIQUETA_CULTIVO[linea.cultivo]}
                      </th>
                      <td className="py-2 text-right tabular">{numero(linea.hectareas)}</td>
                      <td className="py-2 text-right tabular">
                        {linea.costoUsdHa == null ? (
                          <DatoAusente>Sin costo</DatoAusente>
                        ) : (
                          usd(linea.costoUsdHa)
                        )}
                      </td>
                      <td className="py-2 text-right tabular">
                        {linea.rindeTnHa == null ? (
                          <DatoAusente>Sin rinde</DatoAusente>
                        ) : (
                          numero(linea.rindeTnHa)
                        )}
                      </td>
                      <td className="py-2 text-right tabular">
                        {linea.toneladasPotenciales == null ? (
                          <DatoAusente>No calculable</DatoAusente>
                        ) : (
                          numero(linea.toneladasPotenciales)
                        )}
                      </td>
                      <td className="py-2 text-right font-medium tabular">
                        {linea.mercadoUsd == null ? (
                          <DatoAusente>No calculable</DatoAusente>
                        ) : (
                          usd(linea.mercadoUsd)
                        )}
                      </td>
                      <td className="py-2 text-right text-xs text-ink-soft">
                        {linea.origen === "manual" ? "Manual" : "Excel"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line font-semibold text-ink">
                    <th scope="row" className="pt-2 text-left">
                      Total informado
                    </th>
                    <td className="pt-2 text-right tabular">{numero(plan.hectareasTotales)}</td>
                    <td className="pt-2 text-right text-xs text-ink-soft">No aplica</td>
                    <td className="pt-2 text-right text-xs text-ink-soft">No aplica</td>
                    <td className="pt-2 text-right text-xs text-ink-soft">No informado</td>
                    <td className="pt-2 text-right tabular">
                      {plan.mercadoUsd == null ? (
                        <DatoAusente>No calculable</DatoAusente>
                      ) : (
                        usd(plan.mercadoUsd)
                      )}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section
          aria-labelledby="score-titulo"
          className="rounded-card border border-line bg-panel p-4"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 id="score-titulo" className="text-sm font-semibold text-ink">
                Score y desglose
              </h3>
              <p className="text-xs text-ink-soft">
                Resultado de la matriz vigente calculado por el servidor.
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-semibold tabular text-ink">
                {item.score == null ? "—" : numero(item.score)}
              </p>
              <p className="text-xs text-ink-soft">
                {item.segmento ? `Segmento ${item.segmento}` : "No calculado"}
              </p>
            </div>
          </div>

          {item.desglose.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed border-line bg-panel-soft p-4 text-center text-xs text-ink-soft">
              El score no está disponible para esta campaña o la API no informó su desglose.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {item.desglose.map((criterio) => (
                <CriterioScore key={criterio.criterio} criterio={criterio} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}

function Identidad({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div>
      <dt className="text-ink-soft">{termino}</dt>
      <dd className="mt-0.5 font-medium text-ink">{valor}</dd>
    </div>
  );
}

function FuenteEstado({
  icono,
  titulo,
  valor,
  detalle,
  estado,
}: {
  icono: ReactNode;
  titulo: string;
  valor: string;
  detalle: string;
  estado: EstadoDato;
}) {
  const IconoEstado =
    estado === "disponible" ? CheckCircle2 : estado === "advertencia" ? AlertTriangle : CircleHelp;

  return (
    <article
      className={cn(
        "rounded-md border p-3",
        estado === "disponible" && "border-verde/25 bg-verde/5",
        estado === "advertencia" && "border-clementina-deep/30 bg-clementina/10",
        estado === "no-disponible" && "border-line bg-panel-soft",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
          {icono}
          {titulo}
        </span>
        <IconoEstado
          className={cn(
            "size-4",
            estado === "disponible" && "text-verde",
            estado === "advertencia" && "text-clementina-deep",
            estado === "no-disponible" && "text-ink-soft",
          )}
          aria-hidden
        />
      </div>
      <p className="mt-2 text-sm font-semibold text-ink">{valor}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{detalle}</p>
    </article>
  );
}

function Metrica({
  etiqueta,
  valor,
  detalle,
  disponible = true,
  destacada = false,
  children,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  disponible?: boolean;
  destacada?: boolean;
  children?: ReactNode;
}) {
  return (
    <article
      className={cn(
        "rounded-md border border-line bg-panel p-3",
        destacada && disponible && "border-rojo/25 bg-rojo/5",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{etiqueta}</p>
      <p
        className={cn(
          "mt-1 min-h-7 font-display text-lg font-semibold leading-tight tabular",
          disponible ? (destacada ? "text-rojo" : "text-ink") : "text-sm text-ink-soft",
        )}
      >
        {valor}
      </p>
      {children}
      {detalle && <p className="mt-1 text-[11px] text-ink-soft">{detalle}</p>}
    </article>
  );
}

function BarraParticipacion({ valor }: { valor: number }) {
  const ancho = Math.min(Math.max(valor, 0), 100);
  return (
    <div
      className="mt-2 h-1.5 overflow-hidden rounded bg-panel-soft"
      role="progressbar"
      aria-label="Participación de bolsillo"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={ancho}
      aria-valuetext={pct(valor)}
    >
      <div className="h-full rounded bg-clementina-deep" style={{ width: `${ancho}%` }} />
    </div>
  );
}

function CriterioScore({ criterio }: { criterio: DesgloseCriterioSegmentacionDto }) {
  const ancho = Math.min(Math.max(criterio.fraccion * 100, 0), 100);

  return (
    <article
      className={cn(
        "rounded-md border p-3",
        criterio.activo
          ? "border-line bg-panel-soft"
          : "border-dashed border-line bg-panel opacity-70",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="text-xs font-semibold text-ink">{criterio.nombre}</h4>
            {!criterio.activo && (
              <span className="rounded-full bg-panel-soft px-1.5 py-0.5 text-[10px] text-ink-soft">
                Inactivo
              </span>
            )}
            <span className="rounded-full bg-slate-brand/10 px-1.5 py-0.5 text-[10px] text-slate-brand">
              {ETIQUETA_BANDA[criterio.banda]}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-soft">Dato: {formatearValorCriterio(criterio)}</p>
        </div>
        <p className="text-right text-xs font-semibold tabular text-ink">
          {numero(criterio.puntos)} / {numero(criterio.peso)} pts
        </p>
      </div>

      {criterio.activo && (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded bg-panel"
          role="progressbar"
          aria-label={`Resultado de ${criterio.nombre}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={ancho}
          aria-valuetext={pct(criterio.fraccion * 100)}
        >
          <div className="h-full rounded bg-clementina" style={{ width: `${ancho}%` }} />
        </div>
      )}
    </article>
  );
}

function DatoAusente({ children }: { children: ReactNode }) {
  return <span className="text-xs font-normal text-ink-soft">{children}</span>;
}

function detalleEstadoMercado(plan: ProductorTableroDetalleDto["plan"]): string {
  if (!plan.planCargado) return "Hace falta cargar el plan antes de obtener el mercado.";
  if (plan.mercadoCompleto) return "Todos los cultivos informados tienen costo vigente.";

  const cultivos =
    plan.cultivosSinCosto.length === 0
      ? "cultivos sin costo"
      : plan.cultivosSinCosto.map((cultivo) => ETIQUETA_CULTIVO[cultivo]).join(", ");

  return `${numero(plan.hectareasSinCosto)} ha sin costo: ${cultivos}.`;
}

function motivoDatoNoComparable(productor: ConsolidadoVentasItemDto): string {
  if (!productor.planCargado) return "Sin plan de siembra";
  if (!productor.mercadoCompleto) return "Mercado incompleto";
  if (productor.facturacionBayerUsd == null) return "Sin importación Bayer";
  return "No calculable";
}

function textoMercadoNoDisponible(productor: ConsolidadoVentasItemDto): string {
  if (!productor.planCargado) return "Sin plan de siembra";
  if (!productor.mercadoCompleto) return "Mercado incompleto";
  return "No calculable";
}

function formatearValorCriterio(criterio: DesgloseCriterioSegmentacionDto): string {
  if (!criterio.datoDisponible || criterio.valor == null) return "Sin dato";

  const unidad = criterio.unidad.trim();
  if (unidad.toLowerCase() === "usd") return usd(criterio.valor);
  if (unidad === "%") return pct(criterio.valor);
  return unidad ? `${numero(criterio.valor)} ${unidad}` : numero(criterio.valor);
}
