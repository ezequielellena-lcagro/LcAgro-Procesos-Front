import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { KpiCard } from "@/shared/components/kpi-card";
import { PageHeader } from "@/shared/components/page-header";
import { numero, pct, usd } from "@/shared/format/format";
import { AvanceBar } from "../components/avance-bar";
import { CargaObjetivos } from "../components/carga-objetivos";
import { VendedorDetalle } from "../components/vendedor-detalle";
import { CALENDARIOS, contextoCampanias } from "../lib/campanias";
import { BAYER_SIN_CRUZAR, FECHA_CORTE, VENDEDORES } from "../mock/datos";
import type { Calendario, ContextoCampania, LineaCalendario, Vendedor } from "../types";

type Tab = "seguimiento" | "objetivos";
type Filtro = "conObjetivo" | "todos" | "riesgo";
type ModoProyeccion = "lineal" | "estacional";

/**
 * Planificación de Ventas por Vendedor.
 *
 * ⚠️ PANTALLA MOCKUP — datos inventados, sin API. Sirve para acordar con el cliente qué
 * tiene que mostrar antes de construirla. Ver `mock/datos.ts`.
 */
export function PlanificacionPage() {
  const [tab, setTab] = useState<Tab>("seguimiento");
  const [filtro, setFiltro] = useState<Filtro>("conObjetivo");
  const [orden, setOrden] = useState("facturacion");
  const [busqueda, setBusqueda] = useState("");
  const [modo, setModo] = useState<ModoProyeccion>("lineal");
  const [detalle, setDetalle] = useState<Vendedor | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>(VENDEDORES);

  const hoy = FECHA_CORTE;
  const ctx = useMemo(() => contextoCampanias(hoy), [hoy]);

  /** Fracción para proyectar: la elige el usuario. */
  const fraccion = (linea: LineaCalendario) => ctx[linea][modo === "estacional" ? "estacional" : "lineal"];
  /**
   * Ritmo que DEBERÍA llevar hoy: siempre la curva estacional, aunque se proyecte lineal.
   * Con días transcurridos todos parecerían atrasados en la primera mitad de la campaña.
   */
  const esperado = (linea: LineaCalendario) => ctx[linea].estacional;

  const conObjetivo = useMemo(() => vendedores.filter((v) => !v.excluido), [vendedores]);
  const eI = esperado("insumos");
  const eG = esperado("granos");

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let arr = vendedores.filter((v) => v.nombre.toLowerCase().includes(q));
    if (filtro === "conObjetivo") arr = arr.filter((v) => !v.excluido);
    if (filtro === "riesgo")
      arr = arr.filter((v) => !v.excluido && v.realInsumos / v.objetivoInsumos < eI * 0.8);

    const cmp: Record<string, (a: Vendedor, b: Vendedor) => number> = {
      facturacion: (a, b) => b.realInsumos - a.realInsumos,
      avance: (a, b) =>
        (b.objetivoInsumos ? b.realInsumos / b.objetivoInsumos : -1) -
        (a.objetivoInsumos ? a.realInsumos / a.objetivoInsumos : -1),
      desvio: (a, b) =>
        (a.objetivoInsumos ? a.realInsumos / a.objetivoInsumos - eI : 99) -
        (b.objetivoInsumos ? b.realInsumos / b.objetivoInsumos - eI : 99),
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, "es"),
    };
    return [...arr].sort(cmp[orden]);
  }, [vendedores, busqueda, filtro, orden, eI]);

  const suma = (f: (v: Vendedor) => number) => conObjetivo.reduce((a, v) => a + f(v), 0);
  const realI = suma((v) => v.realInsumos);
  const objI = suma((v) => v.objetivoInsumos);
  const realG = suma((v) => v.realGranos);
  const objG = suma((v) => v.objetivoGranos);
  const bayer = suma((v) => v.bayer);
  const bayerPrev = suma((v) => v.bayerPrevio);
  const proyI = realI / fraccion("insumos");
  const alRitmo = conObjetivo.filter((v) => v.realInsumos / v.objetivoInsumos >= eI).length;
  const enRiesgo = conObjetivo.filter((v) => v.realInsumos / v.objetivoInsumos < eI * 0.8).length;

  const columnas: Column<Vendedor>[] = [
    {
      key: "vendedor",
      header: "Vendedor",
      cell: (v) => (
        <span className={cn("whitespace-nowrap font-medium", v.excluido && "font-normal text-ink-soft")}>
          {v.nombre}
          {v.excluido && <Etiqueta>{v.excluido}</Etiqueta>}
          {v.dudoso && <Etiqueta>¿es vendedor?</Etiqueta>}
        </span>
      ),
      sortBy: (v) => v.nombre,
    },
    {
      key: "realI", header: "Insumos real", align: "right",
      cell: (v) => usd(v.realInsumos), sortBy: (v) => v.realInsumos,
    },
    {
      key: "objI", header: "Objetivo", align: "right",
      cell: (v) => (v.excluido ? <Dash /> : usd(v.objetivoInsumos)),
    },
    {
      key: "avanceI", header: "Avance", align: "left",
      cell: (v) => (v.excluido ? <Dash /> : <AvanceBar avance={v.realInsumos / v.objetivoInsumos} esperado={eI} />),
      sortBy: (v) => (v.excluido ? null : v.realInsumos / v.objetivoInsumos),
    },
    {
      key: "proyI", header: "Proyección", align: "right",
      cell: (v) => (v.excluido ? <Dash /> : usd(v.realInsumos / fraccion("insumos"))),
    },
    {
      key: "realG", header: "Granos (tn)", align: "right",
      cell: (v) => (v.excluido ? <Dash /> : numero(v.realGranos)), sortBy: (v) => v.realGranos,
    },
    {
      key: "avanceG", header: "Avance granos", align: "left",
      cell: (v) => (v.excluido ? <Dash /> : <AvanceBar avance={v.realGranos / v.objetivoGranos} esperado={eG} />),
      sortBy: (v) => (v.excluido ? null : v.realGranos / v.objetivoGranos),
    },
    {
      key: "bayer", header: "Bayer", align: "right",
      cell: (v) => (v.excluido ? <Dash /> : usd(v.bayer)), sortBy: (v) => v.bayer,
    },
    {
      key: "siembra", header: "Plan siembra", align: "right",
      cell: (v) =>
        v.excluido ? <Dash /> : v.siembra != null
          ? `${numero(v.siembra)} tn`
          : <span className="text-xs text-ink-soft">sin cargar</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Planificación de Ventas por Vendedor"
        subtitle="Cuánto lleva vendido y originado cada vendedor contra su objetivo, y a qué ritmo va a terminar la campaña"
        actions={
          <span className="rounded-md border border-clementina-deep/40 bg-clementina/10 px-2 py-1 text-xs font-semibold text-clementina-deep">
            MOCKUP · cifras inventadas
          </span>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="seguimiento">Seguimiento</TabsTrigger>
          <TabsTrigger value="objetivos">Carga de objetivos</TabsTrigger>
        </TabsList>

        <TabsContent value="seguimiento">
          <div className="space-y-6">
            {/* Los tres almanaques. Es la idea que más cuesta explicar en palabras. */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
              {(Object.keys(CALENDARIOS) as LineaCalendario[]).map((k) => (
                <CalendarioCard key={k} cal={CALENDARIOS[k]} ctx={ctx[k]} />
              ))}
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
              <KpiCard
                label="Vendedores con objetivo"
                value={conObjetivo.length}
                hint={`${alRitmo} al ritmo · ${enRiesgo} en riesgo`}
              />
              <KpiCard
                label="Insumos facturado"
                value={usd(realI)}
                hint={`objetivo ${usd(objI)} · ${pct((realI / objI) * 100)}`}
                tone={realI / objI >= eI ? "verde" : "rojo"}
              />
              <KpiCard
                label="Proyección fin de campaña"
                value={usd(proyI)}
                hint={`${proyI >= objI ? "+" : ""}${pct((proyI / objI - 1) * 100)} vs. objetivo · modo ${modo}`}
                tone={proyI >= objI ? "verde" : "rojo"}
              />
              <KpiCard
                label="Granos originados"
                value={`${numero(realG)} tn`}
                hint={`objetivo ${numero(objG)} tn · ${pct((realG / objG) * 100)}`}
              />
              <KpiCard
                label={`Ventas agro Bayer ${ctx.bayer.clave}`}
                value={usd(bayer)}
                hint={`${bayer >= bayerPrev ? "+" : ""}${pct((bayer / bayerPrev - 1) * 100)} vs. ${Number(ctx.bayer.clave) - 1} · sin objetivo`}
              />
            </div>

            <FilterBar>
              <FilterField label="Vendedor">
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar…"
                  className="h-9 rounded-md border border-line bg-panel px-2 text-sm text-ink outline-none focus:border-clementina-deep"
                />
              </FilterField>
              <FilterField label="Ver">
                <select
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value as Filtro)}
                  className="h-9 rounded-md border border-line bg-panel px-2 text-sm text-ink outline-none focus:border-clementina-deep"
                >
                  <option value="conObjetivo">Solo con objetivo</option>
                  <option value="todos">Todos los códigos</option>
                  <option value="riesgo">En riesgo</option>
                </select>
              </FilterField>
              <FilterField label="Ordenar">
                <select
                  value={orden}
                  onChange={(e) => setOrden(e.target.value)}
                  className="h-9 rounded-md border border-line bg-panel px-2 text-sm text-ink outline-none focus:border-clementina-deep"
                >
                  <option value="facturacion">Facturación insumos</option>
                  <option value="avance">% de avance</option>
                  <option value="desvio">Desvío vs. ritmo</option>
                  <option value="nombre">Nombre</option>
                </select>
              </FilterField>
              <div className="flex-1" />
              <FilterField label="Proyección de fin de campaña">
                <div className="flex gap-1 rounded-md border border-line bg-panel p-0.5">
                  {(["lineal", "estacional"] as ModoProyeccion[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModo(m)}
                      className={cn(
                        "rounded px-3 py-1.5 text-xs font-semibold transition",
                        modo === m ? "bg-slate-brand text-white" : "text-ink-soft hover:bg-panel-soft",
                      )}
                    >
                      {m === "lineal" ? "Ritmo lineal" : "Curva estacional"}
                    </button>
                  ))}
                </div>
              </FilterField>
            </FilterBar>

            <section>
              <DataTable
                columns={columnas}
                rows={filas}
                getRowKey={(v) => v.cod}
                onRowClick={setDetalle}
                empty="Ningún vendedor coincide con el filtro."
              />
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                Clic en una fila para ver el detalle. La marca vertical de cada barra es el{" "}
                <b>ritmo esperado a hoy</b> según la estacionalidad de la campaña — el semáforo compara contra
                esa marca, no contra el 100 %.
              </p>
            </section>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3">
              <Aviso titulo={`${BAYER_SIN_CRUZAR.length} nombres de Bayer sin cruzar`}>
                <p>
                  El cruce con MacroGest es por <b>nombre de texto libre</b>: la planilla de Bayer no trae el
                  código de vendedor. Estas filas no coinciden con ningún <code>viajantes.descripcion</code>, así
                  que su facturación <b>no se está imputando</b>.
                </p>
                <ul className="mt-2 text-xs">
                  {BAYER_SIN_CRUZAR.map((b) => (
                    <li key={b.nombre} className="flex justify-between gap-3 border-t border-line/60 py-1">
                      <span>{b.nombre}</span>
                      <b>{usd(b.monto)}</b>
                    </li>
                  ))}
                </ul>
              </Aviso>

              <Aviso titulo={`${vendedores.filter((v) => v.dudoso).length} pendientes de confirmar`}>
                <p>
                  Facturan y tienen cartera, pero <b>falta que el cliente confirme si son personas</b> con las
                  que se puede acordar un objetivo o si son bocas/entidades:{" "}
                  <b>{vendedores.filter((v) => v.dudoso).map((v) => v.nombre).join(", ")}</b>.
                </p>
                <ul className="mt-2 text-xs">
                  {vendedores.filter((v) => v.excluido).map((v) => (
                    <li key={v.cod} className="flex justify-between gap-3 border-t border-line/60 py-1">
                      <span>{v.nombre}</span>
                      <span className="text-ink-soft">{v.excluido}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2">
                  Arriba, los ya excluidos por decisión documentada en{" "}
                  <code>VolumenAcopiado:VendedoresExcluidos</code>.
                </p>
              </Aviso>

              <Aviso titulo={`${conObjetivo.filter((v) => v.siembra == null).length} sin plan de siembra`}>
                <p>
                  El plan de siembra <b>no tiene fuente en ningún sistema</b>: hoy es carga manual. Falta el de{" "}
                  <b>{conObjetivo.filter((v) => v.siembra == null).map((v) => v.nombre).join(", ")}</b>.
                </p>
                <p className="mt-2">
                  Es un estimador de potencial (ha × rinde ÷ 10) — <b>nunca</b> se suma a las toneladas reales de
                  acopio.
                </p>
              </Aviso>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="objetivos">
          <CargaObjetivos vendedores={vendedores} ctx={ctx} onGuardar={setVendedores} />
        </TabsContent>
      </Tabs>

      {detalle && (
        <VendedorDetalle
          vendedor={detalle}
          ctx={ctx}
          hoy={hoy}
          fraccion={fraccion}
          onClose={() => setDetalle(null)}
        />
      )}
    </div>
  );
}

function CalendarioCard({ cal, ctx }: { cal: Calendario; ctx: ContextoCampania }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card border border-line bg-panel p-4 shadow-card",
        "border-l-4",
        cal.esMacroGest ? "border-l-verde" : "border-l-rojo",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{cal.nombre}</h3>
        <span className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">{cal.rango}</span>
      </div>
      <p className="mb-3 text-xs text-ink-soft">
        {cal.fuente} · campaña <b className="text-ink">{ctx.clave}</b>
      </p>

      <div className="relative h-6 overflow-hidden rounded-md border border-line bg-panel-soft">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-clementina to-clementina-deep"
          style={{ width: `${(ctx.lineal * 100).toFixed(1)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-between px-2 text-[11px] font-semibold text-ink">
          <span>{pct(ctx.lineal * 100)} transcurrido</span>
          <span className="font-normal text-ink-soft">por días</span>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-ink-soft">
        {cal.curva ? (
          <>
            <i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-sm bg-slate-brand align-middle" />
            Ritmo esperado a hoy: <b className="text-ink">{pct(ctx.estacional * 100)}</b> de la campaña, no{" "}
            {pct(ctx.lineal * 100)}
          </>
        ) : (
          <>
            <i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-sm bg-rojo align-middle" />
            Informativo — hoy no tiene objetivo propio
          </>
        )}
      </p>
    </div>
  );
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-clementina-deep/40 border-l-4 border-l-clementina-deep bg-panel p-4 shadow-card">
      <h4 className="mb-1 text-sm font-bold text-ink">{titulo}</h4>
      <div className="text-xs leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}

const Dash = () => <span className="text-ink-soft">—</span>;

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-2 rounded border border-clementina-deep/40 bg-clementina/10 px-1.5 py-0.5 text-[10px] font-bold text-clementina-deep">
      {children}
    </span>
  );
}
