import { ArrowRightLeft, Database, FileSpreadsheet, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { fecha, numero, pct, usd } from "@/shared/format/format";
import { TONO_SEGMENTO } from "../lib/presentacion";
import type { DistribucionSegmentacionDto, Segmento, TableroPlanificacionDto } from "../types";

interface Props {
  tablero: TableroPlanificacionDto;
}

const SEGMENTOS: Array<{
  segmento: Segmento;
  campo: keyof Pick<DistribucionSegmentacionDto, "a" | "b" | "c" | "d">;
}> = [
  { segmento: "A", campo: "a" },
  { segmento: "B", campo: "b" },
  { segmento: "C", campo: "c" },
  { segmento: "D", campo: "d" },
];

/**
 * Contrasta fuentes actuales e históricas sin mezclarlas con el total operativo
 * de la cartera. Todos los totales, diferencias y porcentajes llegan de la API.
 */
export function ComparacionFuentes({ tablero }: Props) {
  const { conciliacion } = tablero;
  const referencia = conciliacion.referenciaHistorica;

  return (
    <div className="space-y-4">
      <section
        aria-labelledby="comparacion-fuentes-titulo"
        className="rounded-card border border-line bg-panel p-4 shadow-card"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
              Conciliación
            </p>
            <h2
              id="comparacion-fuentes-titulo"
              className="mt-1 font-display text-lg font-semibold text-ink"
            >
              Fuentes actuales vs. referencia Excel
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-soft">
              Comparación informada por el servidor para la campaña {tablero.campania}. Los alcances
              se presentan separados para que el origen de cada número sea visible.
            </p>
          </div>
          <p className="rounded-full bg-panel-soft px-2.5 py-1 text-xs text-ink-soft">
            Snapshot {fecha(tablero.generadoEn)}
          </p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <FuenteCard
            icono={<Database className="size-4" aria-hidden />}
            sobrelinea="Dato actual"
            titulo="Fuentes operativas completas"
            total={
              referencia.totalActualFuentesUsd == null
                ? "Total no calculable"
                : usd(referencia.totalActualFuentesUsd)
            }
            totalDisponible={referencia.totalActualFuentesUsd != null}
            detalle="Alcance total de las fuentes LC y Bayer, previo al recorte por padrón y cartera."
          >
            <FilaFuente
              etiqueta="LC vivo"
              valor={usd(conciliacion.lc.totalVivoUsd)}
              ayuda={`${numero(conciliacion.lc.renglones)} renglones`}
            />
            <FilaFuente
              etiqueta="Bayer importado"
              valor={
                conciliacion.bayer.totalArchivoUsd == null
                  ? "Sin importación Bayer"
                  : usd(conciliacion.bayer.totalArchivoUsd)
              }
              ayuda={
                conciliacion.bayer.disponible
                  ? conciliacion.bayer.fechaImportacion
                    ? `Importado el ${fecha(conciliacion.bayer.fechaImportacion)}`
                    : "Importación disponible"
                  : "Fuente no disponible"
              }
              disponible={conciliacion.bayer.totalArchivoUsd != null}
            />
            <FilaFuente
              etiqueta="Participación sobre mercado de referencia"
              valor={
                referencia.participacionActualSobreMercadoReferenciaPct == null
                  ? "No calculable"
                  : pct(referencia.participacionActualSobreMercadoReferenciaPct)
              }
              disponible={referencia.participacionActualSobreMercadoReferenciaPct != null}
            />
          </FuenteCard>

          <FuenteCard
            icono={<FileSpreadsheet className="size-4" aria-hidden />}
            sobrelinea="Dato histórico"
            titulo="Referencia histórica Excel"
            total={
              referencia.facturacionTotalUsd == null
                ? "Sin total histórico"
                : usd(referencia.facturacionTotalUsd)
            }
            totalDisponible={referencia.facturacionTotalUsd != null}
            detalle={
              referencia.disponible
                ? `Campaña ${referencia.campania ?? "sin identificar"} · ${referencia.estado}`
                : referencia.estado
            }
          >
            <FilaFuente
              etiqueta="LC histórico"
              valor={valorHistorico(referencia.facturacionLcUsd)}
              disponible={referencia.facturacionLcUsd != null}
            />
            <FilaFuente
              etiqueta="Bayer histórico"
              valor={valorHistorico(referencia.facturacionBayerUsd)}
              disponible={referencia.facturacionBayerUsd != null}
            />
            <FilaFuente
              etiqueta="Mercado histórico"
              valor={valorHistorico(referencia.mercadoUsd)}
              disponible={referencia.mercadoUsd != null}
            />
            <FilaFuente
              etiqueta="Participación histórica"
              valor={
                referencia.participacionPct == null
                  ? "Sin participación histórica"
                  : pct(referencia.participacionPct)
              }
              disponible={referencia.participacionPct != null}
            />
          </FuenteCard>
        </div>

        <section
          aria-labelledby="diferencias-fuentes-titulo"
          className="mt-3 rounded-md border border-line bg-panel-soft p-3"
        >
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="size-4 text-slate-brand" aria-hidden />
            <div>
              <h3 id="diferencias-fuentes-titulo" className="text-sm font-semibold text-ink">
                Diferencia actual − histórica
              </h3>
              <p className="text-[11px] text-ink-soft">
                Valores ya conciliados por la API; el signo se conserva.
              </p>
            </div>
          </div>

          <dl className="mt-3 grid gap-2 sm:grid-cols-3">
            <Diferencia etiqueta="Total de fuentes" valor={referencia.diferenciaTotalFuentesUsd} />
            <Diferencia etiqueta="LC vivo vs. Excel" valor={referencia.diferenciaLcVivoUsd} />
            <Diferencia
              etiqueta="Bayer actual vs. Excel"
              valor={referencia.diferenciaBayerArchivoUsd}
            />
          </dl>
        </section>

        <aside
          aria-label="Aclaración sobre alcances"
          className="mt-3 grid gap-3 rounded-md border border-slate-brand/15 bg-slate-brand/5 p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div className="flex gap-2">
            <Info className="mt-0.5 size-4 shrink-0 text-slate-brand" aria-hidden />
            <p className="text-xs leading-relaxed text-ink-soft">
              <strong className="text-ink">No se suma:</strong> la cartera operativa habilitada es
              un recorte de gestión. Se muestra aparte del total actual de fuentes y de la
              referencia histórica Excel; no es un componente adicional de esos totales.
            </p>
          </div>
          <div className="border-t border-line pt-2 text-left sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 sm:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
              Cartera operativa habilitada
            </p>
            <p
              className={cn(
                "mt-1 font-display text-lg font-semibold tabular",
                conciliacion.totalOperativoCarteraUsd == null
                  ? "text-sm text-ink-soft"
                  : "text-ink",
              )}
            >
              {conciliacion.totalOperativoCarteraUsd == null
                ? "No calculable sin Bayer"
                : usd(conciliacion.totalOperativoCarteraUsd)}
            </p>
          </div>
        </aside>
      </section>

      <SegmentacionHistorica tablero={tablero} />
    </div>
  );
}

function FuenteCard({
  icono,
  sobrelinea,
  titulo,
  total,
  totalDisponible,
  detalle,
  children,
}: {
  icono: ReactNode;
  sobrelinea: string;
  titulo: string;
  total: string;
  totalDisponible: boolean;
  detalle: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-card border border-line bg-panel-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
            {icono}
            {sobrelinea}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-ink">{titulo}</h3>
        </div>
      </div>
      <p
        className={cn(
          "mt-3 font-display text-2xl font-semibold leading-tight tabular",
          totalDisponible ? "text-ink" : "text-base text-ink-soft",
        )}
      >
        {total}
      </p>
      <p className="mt-1 min-h-8 text-[11px] leading-relaxed text-ink-soft">{detalle}</p>
      <dl className="mt-3 border-t border-line">{children}</dl>
    </article>
  );
}

function FilaFuente({
  etiqueta,
  valor,
  ayuda,
  disponible = true,
}: {
  etiqueta: string;
  valor: string;
  ayuda?: string;
  disponible?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/60 py-2 last:border-b-0">
      <dt>
        <span className="block text-xs text-ink-soft">{etiqueta}</span>
        {ayuda && <span className="mt-0.5 block text-[10px] text-ink-soft">{ayuda}</span>}
      </dt>
      <dd
        className={cn(
          "max-w-[55%] text-right text-xs font-medium tabular",
          disponible ? "text-ink" : "text-ink-soft",
        )}
      >
        {valor}
      </dd>
    </div>
  );
}

function Diferencia({ etiqueta, valor }: { etiqueta: string; valor: number | null }) {
  return (
    <div className="rounded-md border border-line bg-panel p-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
        {etiqueta}
      </dt>
      <dd
        className={cn(
          "mt-1 font-display text-base font-semibold tabular",
          valor == null ? "text-sm text-ink-soft" : "text-ink",
        )}
      >
        {valor == null ? "No calculable" : `${valor > 0 ? "+" : ""}${usd(valor)}`}
      </dd>
    </div>
  );
}

function SegmentacionHistorica({ tablero }: { tablero: TableroPlanificacionDto }) {
  const referencia = tablero.referenciaSegmentacion;

  return (
    <section
      aria-labelledby="segmentacion-historica-titulo"
      className="rounded-card border border-line bg-panel p-4 shadow-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
            Referencia histórica
          </p>
          <h2
            id="segmentacion-historica-titulo"
            className="mt-1 font-display text-lg font-semibold text-ink"
          >
            Segmentación histórica Excel
          </h2>
        </div>
        {referencia.disponible && (
          <p className="rounded-full bg-panel-soft px-2.5 py-1 text-xs text-ink-soft">
            Campaña {referencia.campania ?? "sin identificar"}
          </p>
        )}
      </div>

      {!referencia.disponible ? (
        <div
          role="status"
          className="mt-3 rounded-md border border-dashed border-line bg-panel-soft p-5 text-center"
        >
          <p className="text-sm font-medium text-ink">Sin segmentación histórica disponible</p>
          <p className="mt-1 text-xs text-ink-soft">{referencia.estado}</p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-xs leading-relaxed text-ink-soft">{referencia.estado}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SEGMENTOS.map(({ segmento, campo }) => (
              <article key={segmento} className="rounded-md border border-line bg-panel-soft p-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      TONO_SEGMENTO[segmento],
                    )}
                  >
                    Segmento {segmento}
                  </span>
                  <span className="font-display text-xl font-semibold tabular text-ink">
                    {referencia.distribucion[campo]}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-ink-soft">productores</p>
              </article>
            ))}
          </div>
          <dl className="mt-3 grid gap-2 border-t border-line pt-3 text-xs sm:grid-cols-3">
            <ResumenSegmentacion etiqueta="Evaluados" valor={referencia.productoresEvaluados} />
            <ResumenSegmentacion etiqueta="Sin score" valor={referencia.productoresSinScore} />
            <ResumenSegmentacion
              etiqueta="Total de la referencia"
              valor={referencia.distribucion.total}
            />
          </dl>
        </>
      )}

      <p className="mt-3 flex gap-1.5 text-[11px] leading-relaxed text-ink-soft">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Esta distribución es histórica y sirve como referencia visual. No se suma ni reemplaza la
        segmentación operativa calculada para la campaña seleccionada.
      </p>
    </section>
  );
}

function ResumenSegmentacion({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div>
      <dt className="text-ink-soft">{etiqueta}</dt>
      <dd className="mt-0.5 font-semibold tabular text-ink">{numero(valor)}</dd>
    </div>
  );
}

function valorHistorico(valor: number | null): string {
  return valor == null ? "Sin dato histórico" : usd(valor);
}
