import { ArrowRightLeft, Database, FileSpreadsheet, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { numero, pct, usd } from "@/shared/format/format";
import { fechaHoraPlanificacion } from "../lib/campanias";
import { TONO_SEGMENTO } from "../lib/presentacion";
import type {
  BayerControlDepositoDto,
  ConciliacionConsolidadoVentasDto,
  DistribucionSegmentacionDto,
  Segmento,
  TableroPlanificacionDto,
} from "../types";

interface Props {
  tablero: TableroPlanificacionDto;
  soloLectura: boolean;
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

const DEPOSITOS_CONTROL_BAYER = [43, 53] as const;

/**
 * Contrasta fuentes actuales e históricas sin mezclarlas con el total operativo
 * de la cartera. Todos los totales, diferencias y porcentajes llegan de la API.
 */
export function ComparacionFuentes({ tablero, soloLectura }: Props) {
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
              {soloLectura ? "Fuentes fotografiadas" : "Fuentes actuales"} vs. referencia Excel
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-soft">
              Esta pantalla contesta una sola pregunta: <b>¿la app da lo mismo que el Excel que se
              venía armando a mano?</b> Es un control de puesta en marcha, no un dato de gestión —
              por eso vive acá y no en la cartera. Cuanto más chica la diferencia, más confiable es
              lo que muestran las otras pestañas.
            </p>
          </div>
          <p className="rounded-full bg-panel-soft px-2.5 py-1 text-xs text-ink-soft">
            Corte {fechaHoraPlanificacion(tablero.generadoEn)}
          </p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <FuenteCard
            icono={<Database className="size-4" aria-hidden />}
            sobrelinea={soloLectura ? "Dato fotografiado" : "Dato actual"}
            titulo="Fuentes operativas completas"
            total={
              referencia.totalActualFuentesUsd == null
                ? "Total no calculable"
                : usd(referencia.totalActualFuentesUsd)
            }
            totalDisponible={referencia.totalActualFuentesUsd != null}
            detalle={
              soloLectura
                ? "Lo que la app leyó al sacar la foto: la facturación de La Clementina en " +
                  "MacroGest más el Excel de Bayer confirmado hasta ese momento. Es el alcance " +
                  "completo, antes de recortar por padrón y por los vendedores del proceso."
                : "Lo que la app lee HOY: la facturación de La Clementina en vivo desde " +
                  "MacroGest más el último Excel de Bayer importado. Es el alcance completo, " +
                  "antes de recortar por padrón y por los vendedores del proceso."
            }
          >
            <FilaFuente
              etiqueta={soloLectura ? "LC fotografiado" : "LC vivo"}
              valor={usd(conciliacion.lc.totalVivoUsd)}
              ayuda={`${numero(conciliacion.lc.renglones)} renglones`}
            />
            <FilaFuente
              etiqueta={
                soloLectura
                  ? "Bayer de la campaña al corte"
                  : "Bayer de la campaña (archivo confirmado)"
              }
              valor={
                conciliacion.bayer.totalArchivoUsd == null
                  ? "Sin importación Bayer"
                  : usd(conciliacion.bayer.totalArchivoUsd)
              }
              ayuda={
                conciliacion.bayer.disponible
                  ? conciliacion.bayer.fechaImportacion
                    ? `${soloLectura ? "Confirmado al corte el" : "Importado el"} ${fechaHoraPlanificacion(conciliacion.bayer.fechaImportacion)}`
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
                ? "Los mismos totales, sacados del Excel que arma el negocio a mano. Se importan " +
                  "con archivo y fecha: si la planilla se actualiza, se vuelve a importar."
                : "Nadie importó todavía el Excel de esta campaña, así que no hay contra qué " +
                  "comparar. Se sube desde Conciliación."
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
            {/* La procedencia es lo que hace confiable al numero: antes estaba pegado en el codigo. */}
            {referencia.nombreArchivo && (
              <p className="mt-2 border-t border-line pt-2 text-[11px] leading-relaxed text-ink-soft">
                Importado de <b className="text-ink">{referencia.nombreArchivo}</b>
                {referencia.fechaImportacion
                  ? ` el ${fechaHoraPlanificacion(referencia.fechaImportacion)}`
                  : ""}
                . Si la planilla cambia, hay que volver a importarla para que la comparación siga
                siendo válida.
              </p>
            )}
          </FuenteCard>
        </div>

        <EstadoOperativoBayer conciliacion={conciliacion} soloLectura={soloLectura} />

        <section
          aria-labelledby="diferencias-fuentes-titulo"
          className="mt-3 rounded-md border border-line bg-panel-soft p-3"
        >
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="size-4 text-slate-brand" aria-hidden />
            <div>
              <h3 id="diferencias-fuentes-titulo" className="text-sm font-semibold text-ink">
                {soloLectura
                  ? "Diferencia al momento del corte − histórica"
                  : "Diferencia actual − histórica"}
              </h3>
              <p className="text-[11px] leading-relaxed text-ink-soft">
                Cuánto se aparta la app del Excel. <b>Positivo = la app ve más</b>, normal cuando
                MacroGest sumó facturas después de que se armó la planilla. Una diferencia chica
                valida el cálculo; una grande avisa que falta cargar algo o que se está mirando
                otra campaña.
              </p>
            </div>
          </div>

          <dl className="mt-3 grid gap-2 sm:grid-cols-3">
            <Diferencia etiqueta="Total de fuentes" valor={referencia.diferenciaTotalFuentesUsd} />
            <Diferencia
              etiqueta={soloLectura ? "LC fotografiado vs. Excel" : "LC vivo vs. Excel"}
              valor={referencia.diferenciaLcVivoUsd}
            />
            <Diferencia
              etiqueta={
                soloLectura ? "Bayer al momento del corte vs. Excel" : "Bayer actual vs. Excel"
              }
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
              lo que queda después de recortar por los vendedores del proceso y por los productores
              del padrón — es el número que ves en la pestaña de Cartera. Se muestra aparte del
              total {soloLectura ? "fotografiado" : "actual"} de fuentes y de la referencia
              histórica Excel: es un subconjunto de ellos, no algo que se les suma.
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

function EstadoOperativoBayer({
  conciliacion,
  soloLectura,
}: {
  conciliacion: ConciliacionConsolidadoVentasDto;
  soloLectura: boolean;
}) {
  const { bayer, controlBayer } = conciliacion;
  const datosControl = controlBayer.disponible ? controlBayer.datos : null;

  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-2">
      <section
        aria-labelledby="fuente-bayer-operativa-titulo"
        className="rounded-md border border-line bg-panel-soft p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
              <FileSpreadsheet className="size-4" aria-hidden />
              {soloLectura ? "Fuente operativa fotografiada" : "Fuente operativa"}
            </p>
            <h3 id="fuente-bayer-operativa-titulo" className="mt-1 text-sm font-semibold text-ink">
              {soloLectura
                ? "Fuente operativa fotografiada: último Excel Bayer confirmado al corte"
                : "Fuente operativa: último Excel Bayer confirmado"}
            </h3>
          </div>
          <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-800">
            Integración directa: pendiente de habilitación externa
          </span>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          Bayer le factura <b>directo al productor</b> y La Clementina cobra comisión, así que esa
          venta no pasa por la facturación de LC: por eso se suma en vez de pisarse. El dato sale
          del último Excel confirmado (el mismo que llena Georgina mes a mes). El cliente pidió a
          Bayer una conexión directa y todavía no le contestaron; mientras tanto, manda el archivo.
        </p>

        {!bayer.disponible ? (
          <div
            role="status"
            className="mt-3 rounded-md border border-dashed border-line bg-panel p-4"
          >
            <p className="text-sm font-medium text-ink">Sin importación Bayer confirmada</p>
            <p className="mt-1 text-xs text-ink-soft">
              La campaña no tiene todavía un Excel confirmado como fuente operativa.
            </p>
          </div>
        ) : (
          <>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <DatoBayer
                etiqueta="Identificador"
                valor={
                  bayer.importacionId == null ? "Sin dato" : `Importación #${bayer.importacionId}`
                }
              />
              <DatoBayer
                etiqueta={soloLectura ? "Confirmado al corte" : "Confirmado en"}
                valor={
                  bayer.fechaImportacion == null
                    ? "Sin dato"
                    : fechaHoraPlanificacion(bayer.fechaImportacion)
                }
              />
              <DatoBayer etiqueta="Archivo" valor={bayer.nombreArchivo ?? "Sin dato"} />
              <DatoBayer
                etiqueta="Formato"
                valor={bayer.formato == null ? "Sin dato" : bayer.formato.toUpperCase()}
              />
            </dl>

            <dl
              aria-label="Conteos del archivo Bayer completo"
              className="mt-3 grid gap-2 border-t border-line pt-3 text-xs sm:grid-cols-3"
            >
              <DatoBayer
                etiqueta="Filas del archivo"
                valor={conteoBayer(bayer.filasImportacion, soloLectura)}
              />
              <DatoBayer
                etiqueta="Filas cruzadas"
                valor={conteoBayer(bayer.filasCruzadasImportacion, soloLectura)}
              />
              <DatoBayer
                etiqueta="Filas sin cruzar"
                valor={conteoBayer(bayer.filasSinCruzarImportacion, soloLectura)}
              />
            </dl>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
              Los conteos anteriores corresponden al archivo completo; esta campaña usa {numero(
                bayer.filas,
              )} filas.
            </p>
          </>
        )}
      </section>

      <section
        aria-labelledby="control-bayer-titulo"
        className="rounded-md border border-line bg-panel-soft p-4"
      >
        <div className="flex items-start gap-2">
          <Database className="mt-0.5 size-4 shrink-0 text-slate-brand" aria-hidden />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
              Control de consistencia separado
            </p>
            <h3 id="control-bayer-titulo" className="mt-1 text-sm font-semibold text-ink">
              {soloLectura
                ? "Control indicativo al corte · depósitos 43/53"
                : "Control indicativo · depósitos 43/53"}
            </h3>
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          Cuando se carga una venta de Bayer, en MacroGest queda un pedido con depósito 43 o 53
          (&quot;MONSANTO / BAYER&quot; de San Jorge y Las Varillas). Sirve para ver cuánto de lo
          facturado por Bayer quedó realmente registrado: hoy los pedidos capturan cerca del 64 %
          porque los vendedores no los cargan completos. Es un <b>control de calidad de la carga</b>,
          no una fuente: no reemplaza al Excel y{" "}
          <strong className="text-ink">no se suma al consolidado</strong>.
        </p>

        {datosControl == null ? (
          <div
            role="status"
            className="mt-3 rounded-md border border-dashed border-line bg-panel p-4"
          >
            <p className="text-sm font-medium text-ink">Control indicativo no disponible</p>
            <p className="mt-1 text-xs text-ink-soft">
              {controlBayer.motivoNoDisponible ??
                "No se pudo consultar el control auxiliar de depósitos 43/53."}
            </p>
          </div>
        ) : (
          <>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <DatoBayer
                etiqueta="Renglones vigentes"
                valor={numero(datosControl.renglonesVigentes)}
              />
              <DatoBayer etiqueta="Pedidos" valor={numero(datosControl.pedidos)} />
              <DatoBayer
                etiqueta="Importe nominal USD"
                valor={usd(datosControl.importeNominalUsd)}
              />
              <DatoBayer
                etiqueta="Archivo − pedido nominal USD"
                valor={valorUsdConSigno(controlBayer.diferenciaArchivoVsPedidoNominalUsd)}
              />
            </dl>

            <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
              {DEPOSITOS_CONTROL_BAYER.map((numeroDeposito) => (
                <DepositoControlBayer
                  key={numeroDeposito}
                  numeroDeposito={numeroDeposito}
                  datos={datosControl.depositos.find(
                    ({ deposito }) => deposito === numeroDeposito,
                  )}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function DatoBayer({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-md border border-line/70 bg-panel p-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{etiqueta}</dt>
      <dd className="mt-1 break-words font-medium tabular text-ink">{valor}</dd>
    </div>
  );
}

function DepositoControlBayer({
  numeroDeposito,
  datos,
}: {
  numeroDeposito: (typeof DEPOSITOS_CONTROL_BAYER)[number];
  datos: BayerControlDepositoDto | undefined;
}) {
  return (
    <article className="rounded-md border border-line bg-panel p-2.5">
      <h4 className="text-xs font-semibold text-ink">Depósito {numeroDeposito}</h4>
      {datos == null ? (
        <p className="mt-1 text-[11px] text-ink-soft">Sin detalle en el control informado.</p>
      ) : (
        <dl className="mt-2 space-y-1 text-[11px]">
          <FilaControl etiqueta="Renglones vigentes" valor={numero(datos.renglonesVigentes)} />
          <FilaControl etiqueta="Pedidos" valor={numero(datos.pedidos)} />
          <FilaControl etiqueta="Importe nominal USD" valor={usd(datos.importeNominalUsd)} />
        </dl>
      )}
    </article>
  );
}

function FilaControl({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-ink-soft">{etiqueta}</dt>
      <dd className="text-right font-medium tabular text-ink">{valor}</dd>
    </div>
  );
}

function conteoBayer(valor: number | null, soloLectura: boolean): string {
  if (valor != null) return numero(valor);
  return soloLectura ? "Sin dato en este corte" : "Sin dato";
}

function valorUsdConSigno(valor: number | null): string {
  return valor == null ? "No calculable" : `${valor > 0 ? "+" : ""}${usd(valor)}`;
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
