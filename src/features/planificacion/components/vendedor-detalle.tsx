import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { numero, pct, usd } from "@/shared/format/format";
import { CALENDARIOS, claveCampaniaPrevia, serieMensual } from "../lib/campanias";
import type { ContextoCampania, LineaCalendario, Vendedor } from "../types";
import { AvanceBar } from "./avance-bar";

interface Props {
  vendedor: Vendedor;
  ctx: Record<LineaCalendario, ContextoCampania>;
  hoy: Date;
  /** Fracción usada para proyectar (lineal o estacional, según lo que se esté mirando). */
  fraccion: (linea: LineaCalendario) => number;
  onClose: () => void;
}

export function VendedorDetalle({ vendedor: v, ctx, hoy, fraccion, onClose }: Props) {
  return (
    <Modal open onClose={onClose} title={v.nombre} className="w-full max-w-2xl">
      <div className="max-h-[75vh] space-y-4 overflow-y-auto p-5">
        <header>
          <h2 className="font-display text-xl font-semibold text-ink">{v.nombre}</h2>
          <p className="text-xs text-ink-soft">
            Viajante {v.cod} · campaña insumos {ctx.insumos.clave} · granos {ctx.granos.clave} · corte{" "}
            {hoy.toLocaleDateString("es-AR")}
          </p>
        </header>

        {v.excluido ? (
          <Callout>
            <b>Excluido: {v.excluido}.</b> El viajante {v.cod} factura {usd(v.realInsumos)} en la campaña y eso
            suma al total de la empresa, pero no se le fija objetivo ni entra en el seguimiento comercial. La
            decisión ya está tomada en <code>VolumenAcopiado:VendedoresExcluidos</code> — acá solo se refleja.
          </Callout>
        ) : (
          <>
            {v.dudoso && (
              <Callout>
                <b>Falta confirmar si el viajante {v.cod} es un vendedor.</b> Está en la lista blanca de Cuentas
                Corrientes, pero el nombre no parece el de una persona. Si resulta ser una boca o una entidad,
                hay que sacarlo del seguimiento por objetivos.
              </Callout>
            )}

            <BloqueLinea
              titulo="Insumos · La Clementina"
              etiqueta="abr–mar"
              real={v.realInsumos}
              objetivo={v.objetivoInsumos}
              previo={v.previoInsumos}
              etiquetaPrevio={`Campaña ${claveCampaniaPrevia(4, hoy)} completa`}
              fmt={usd}
              fraccion={fraccion("insumos")}
              esperado={ctx.insumos.estacional}
              nota="Facturación neta de MacroGest: solo FAC (1) y NCR (3), con la depuración de artículos ya validada en Liquidación de Comisiones."
            />

            <GraficoMensual vendedor={v} ctx={ctx} hoy={hoy} />

            <BloqueLinea
              titulo="Granos originados · acopio"
              etiqueta="jul–jun"
              real={v.realGranos}
              objetivo={v.objetivoGranos}
              previo={v.previoGranos}
              etiquetaPrevio={`Campaña ${claveCampaniaPrevia(7, hoy)} completa`}
              fmt={(n) => `${numero(n)} tn`}
              fraccion={fraccion("granos")}
              esperado={ctx.granos.estacional}
              nota="Certificados 1116 A (comprobante CEG) de los productores de su cartera. Misma definición que el tablero de Volumen Acopiado."
            />

            <BloqueReferencia titulo="Ventas agro Bayer" etiqueta={`ene–dic · referencia`}>
              <div className="font-display text-2xl font-semibold tabular text-ink">{usd(v.bayer)}</div>
              <Fila
                label={`Año ${Number(ctx.bayer.clave) - 1}`}
                valor={
                  <>
                    {usd(v.bayerPrevio)}{" "}
                    {v.bayerPrevio > 0 && (
                      <span className="font-normal text-ink-soft">
                        ({v.bayer >= v.bayerPrevio ? "+" : ""}
                        {pct((v.bayer / v.bayerPrevio - 1) * 100)})
                      </span>
                    )}
                  </>
                }
              />
              <Fila label="Objetivo" valor={<span className="text-ink-soft">no tiene</span>} />
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                Facturación <b>distinta</b> de la de insumos, no un corte del mismo dato. Sale de la planilla de
                Bayer/Monsanto en la red del cliente, no de MacroGest, y va en año calendario. Nunca se suma a la
                línea de insumos.
              </p>
            </BloqueReferencia>

            <BloqueReferencia titulo="Potencial según plan de siembra" etiqueta="estimado">
              {v.siembra != null ? (
                <>
                  <div className="font-display text-2xl font-semibold tabular text-ink">
                    {numero(v.siembra)} <span className="text-xs font-normal text-ink-soft">tn potenciales</span>
                  </div>
                  {v.objetivoGranos > 0 && (
                    <Fila
                      label="Vs. objetivo de granos"
                      valor={`${pct((v.siembra / v.objetivoGranos) * 100)} del objetivo`}
                    />
                  )}
                </>
              ) : (
                <div className="text-sm text-ink-soft">Sin cargar</div>
              )}
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                Hectáreas planificadas × rendimiento esperado ÷ 10, cargado a mano. Es un estimador de potencial
                de la zona del vendedor — <b>no</b> es un dato real de acopio y no se suma a las toneladas
                originadas.
              </p>
            </BloqueReferencia>
          </>
        )}
      </div>
    </Modal>
  );
}

function BloqueLinea({
  titulo,
  etiqueta,
  real,
  objetivo,
  previo,
  etiquetaPrevio,
  fmt,
  fraccion,
  esperado,
  nota,
}: {
  titulo: string;
  etiqueta: string;
  real: number;
  objetivo: number;
  previo: number;
  etiquetaPrevio: string;
  fmt: (n: number) => string;
  fraccion: number;
  esperado: number;
  nota: string;
}) {
  const avance = objetivo > 0 ? real / objetivo : null;
  const proyeccion = fraccion > 0 ? real / fraccion : 0;
  const dif = previo > 0 ? (real / previo - 1) * 100 : null;
  const alRitmo = avance != null && avance >= esperado;

  return (
    <section className="rounded-card border border-line bg-panel-soft p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{titulo}</h3>
        <span className="rounded border border-line bg-panel px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
          {etiqueta}
        </span>
      </div>

      <div className="font-display text-2xl font-semibold tabular text-ink">{fmt(real)}</div>
      {objetivo > 0 && (
        <div className="mt-2">
          <AvanceBar avance={avance} esperado={esperado} ancho="w-full" mostrarPct={false} />
        </div>
      )}

      <div className="mt-3">
        <Fila label="Objetivo de campaña" valor={objetivo > 0 ? fmt(objetivo) : "—"} />
        <Fila
          label="Avance"
          valor={
            <span className={cn(objetivo > 0 && (alRitmo ? "text-verde" : "text-rojo"))}>
              {avance != null ? pct(avance * 100) : "—"}{" "}
              <span className="font-normal text-ink-soft">(esperado {pct(esperado * 100)})</span>
            </span>
          }
        />
        <Fila
          label="Proyección fin de campaña"
          valor={
            <span className={cn(objetivo > 0 && (proyeccion >= objetivo ? "text-verde" : "text-rojo"))}>
              {fmt(proyeccion)}
            </span>
          }
        />
        <Fila
          label={etiquetaPrevio}
          valor={
            <>
              {fmt(previo)}{" "}
              {dif != null && (
                <span className="font-normal text-ink-soft">
                  ({dif >= 0 ? "+" : ""}
                  {pct(dif)})
                </span>
              )}
            </>
          }
        />
      </div>

      <p className="mt-2 text-xs leading-relaxed text-ink-soft">{nota}</p>
    </section>
  );
}

function BloqueReferencia({
  titulo,
  etiqueta,
  children,
}: {
  titulo: string;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-dashed border-line bg-panel p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{titulo}</h3>
        <span className="rounded border border-line bg-panel-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
          {etiqueta}
        </span>
      </div>
      {children}
    </section>
  );
}

function Fila({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-t border-line/60 py-1.5 text-xs">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium tabular text-ink">{valor}</span>
    </div>
  );
}

/** Mes a mes de insumos: hace visible que la curva objetivo no es plana. */
function GraficoMensual({
  vendedor: v,
  ctx,
  hoy,
}: {
  vendedor: Vendedor;
  ctx: Record<LineaCalendario, ContextoCampania>;
  hoy: Date;
}) {
  const curva = CALENDARIOS.insumos.curva;
  if (!curva) return null;

  const serie = serieMensual(v.realInsumos, v.objetivoInsumos, curva, 4, hoy, v.cod);
  const max = Math.max(1, ...serie.map((s) => Math.max(s.objetivo, s.real)));

  return (
    <section className="rounded-card border border-line bg-panel p-4">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-ink">Mes a mes — insumos</span>
        <span className="flex gap-3 text-[10px] text-ink-soft">
          <span>
            <i className="mr-1 inline-block h-2 w-2 rounded-sm bg-slate-brand align-middle" />
            Real
          </span>
          <span>
            <i className="mr-1 inline-block h-2 w-2 rounded-sm bg-panel-soft align-middle ring-1 ring-line" />
            Objetivo
          </span>
        </span>
      </div>

      <div className="flex h-20 items-end gap-1">
        {serie.map((s) => (
          <div key={s.mes} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="relative flex h-full w-full items-end justify-center">
              <div
                className="absolute bottom-0 w-full rounded-t bg-panel-soft"
                style={{ height: `${(s.objetivo / max) * 100}%` }}
              />
              <div
                className="relative w-3/5 rounded-t bg-slate-brand"
                style={{ height: `${(s.real / max) * 100}%` }}
                title={`${s.mes}: real ${usd(s.real)} · objetivo ${usd(s.objetivo)}`}
              />
            </div>
            <span className={cn("text-[9px] text-ink-soft", s.esActual && "font-bold text-clementina-deep")}>
              {s.mes}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        La curva objetivo no es plana: la venta de insumos se concentra entre agosto y diciembre. Por eso el
        ritmo esperado a hoy es {pct(ctx.insumos.estacional * 100)} y no {pct(ctx.insumos.lineal * 100)}.
      </p>
    </section>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-clementina-deep/40 bg-clementina/10 p-3 text-xs leading-relaxed text-ink">
      {children}
    </div>
  );
}
