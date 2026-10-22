import { useState, type FormEvent } from "react";
import { toAppError } from "@/lib/api-error";
import { useLogisticaExcel } from "../queries/use-logistica-excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-context";
import { PageHeader } from "@/shared/components/page-header";
import { FilterActions, FilterBar, FilterField } from "@/shared/components/filter-bar";
import { HistorialDialog } from "../components/historial-dialog";
import { CatalogoSelect } from "../components/catalogo-select";
import { AvisoDemo } from "../components/aviso-demo";
import { PeriodoFiltro } from "../components/periodo-filtro";
import { ConciliacionTabla } from "../components/conciliacion-tabla";
import { RetirarVinculoErpDialog } from "../components/retirar-vinculo-erp-dialog";
import { VinculoErpDialog } from "../components/vinculo-erp-dialog";
import { SeguimientoDetalle } from "../components/seguimiento-detalle";
import { FlotaSeguimientoDialog } from "../components/flota-seguimiento-dialog";
import { RetirarFlotaSeguimientoDialog } from "../components/retirar-flota-seguimiento-dialog";
import { SeguimientoDialog } from "../components/seguimiento-dialog";
import type { EdicionSeguimiento } from "../components/seguimiento-dialog";
import { TablaLogistica } from "../components/tabla-logistica";
import { fecha, hoy, periodoInicial, sumarDias } from "../format";
import {
  datoVigente,
  kgOperativos,
  destinatarioSeguimiento,
  ESTADO_LABEL,
  FUENTE_LABEL,
} from "../lib/seguimiento";
import { campaniaValida } from "../lib/filtros-cupos";
import { useListado } from "../queries/use-logistica";
import { ESTADOS_SEGUIMIENTO } from "../types";
import type { ConciliacionFila, Periodo, Seguimiento, TipoDatoOperativo } from "../types";

const filtrosVacios = {
  contrato: "",
  clienteNumero: "",
  producto: "",
  campania: "",
  destinoCodigo: "",
  circuito: "",
  estadoObservado: "",
};
type Filtros = typeof filtrosVacios;
export function CargasPage() {
  const { user } = useAuth();
  const gestionar = user?.roles.includes("logistica-cargas") ?? false;
  const gestionarVinculos = user?.roles.includes("logistica-cupos") ?? false;
  const [vinculo, setVinculo] = useState<{
    snapshot: Seguimiento;
    modo: "vincular" | "reemplazar" | "retirar";
  } | null>(null);
  const [tab, setTab] = useState("dia");
  const [dia, setDia] = useState(hoy);
  const [periodo, setPeriodo] = useState<Periodo>(periodoInicial);
  const [borrador, setBorrador] = useState(filtrosVacios);
  const [filtros, setFiltros] = useState<Filtros>(filtrosVacios);
  const [paginaVersion, setPaginaVersion] = useState(0);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [historiaId, setHistoriaId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ snapshot: Seguimiento; modo: EdicionSeguimiento } | null>(
    null,
  );
  const [aviso, setAviso] = useState<string | null>(null);
  const [flota, setFlota] = useState<{ snapshot: Seguimiento; retirar: boolean } | null>(null);
  const abrirFlota = (snapshot: Seguimiento, retirar = false) => {
    setDetalleId(null);
    setAviso(null);
    setFlota({ snapshot, retirar });
  };
  const conflictoFlota = () => {
    setFlota(null);
    setAviso(
      "El seguimiento o la ficha de flota cambió. Abrí el detalle actualizado y revisá el padrón para realizar un nuevo intento explícito.",
    );
  };
  const rango = tab === "dia" ? { desde: dia, hastaExclusivo: sumarDias(dia, 1) } : periodo;
  const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== ""));
  const q = useListado<Seguimiento>(
    "seguimientos",
    { ...rango, ...params, anulados: tab === "anuladas" },
    (f) => ({ despuesFecha: f.cupo.fechaCarga, despuesId: f.cupoId }),
    tab !== "desfasajes",
    { paginaVersion },
  );
  const conciliacion = useListado<ConciliacionFila>(
    "conciliacion",
    { ...periodo, ...params, anulados: false },
    (f) => ({ despuesFecha: f.seguimiento.cupo.fechaCarga, despuesId: f.seguimiento.cupoId }),
    tab === "desfasajes",
    { paginaVersion },
    20,
  );
  const excel = useLogisticaExcel();
  const bloqueada = !!editor || !!vinculo || !!flota || excel.isPending;
  const reiniciar = () => setPaginaVersion((v) => v + 1);
  const editar = (snapshot: Seguimiento, modo: EdicionSeguimiento) => {
    setDetalleId(null);
    setAviso(null);
    setEditor({ snapshot, modo });
  };
  const valorOperativo = (s: Seguimiento, tipo: TipoDatoOperativo) => {
    const dato = datoVigente(s, tipo);
    return (
      <>
        <div>
          {!dato ? "Pendiente" : tipo === "patente" ? dato.texto : kgOperativos(dato.kilogramos)}
        </div>
        {dato && <div className="mt-1 text-xs text-ink-soft">{FUENTE_LABEL[dato.fuente]}</div>}
      </>
    );
  };
  const campaniaOk = campaniaValida(borrador);
  const aplicarFiltros = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!campaniaOk) return;
    setFiltros({ ...borrador });
    reiniciar();
  };
  /** Los filtros de la tabla, para meterlos en la barra que corresponda a la solapa. */
  const camposFiltro = (
    <>
      {(
        [
          ["contrato", "Contrato", 15],
          ["campania", "Campaña", 9],
        ] as const
      ).map(([campo, titulo, max]) => (
        <FilterField key={campo} label={titulo}>
          <Input
            className={campo === "campania" ? "w-32" : "w-40"}
            value={borrador[campo]}
            maxLength={max}
            placeholder={campo === "campania" ? "2025-2026" : undefined}
            onChange={(e) => setBorrador({ ...borrador, [campo]: e.target.value })}
          />
        </FilterField>
      ))}
      {(
        [
          ["clientes", "clienteNumero", "Productor"],
          ["productos", "producto", "Cereal"],
          ["destinos", "destinoCodigo", "Destino"],
        ] as const
      ).map(([tipo, campo, titulo]) => (
        <CatalogoSelect
          key={campo}
          className="w-56"
          tipo={tipo}
          titulo={titulo}
          value={Number(borrador[campo])}
          required={false}
          modoFiltro
          onChange={(v) => setBorrador({ ...borrador, [campo]: v ? String(v) : "" })}
        />
      ))}
      <FilterField label="Circuito">
        <Select
          className="w-40"
          value={borrador.circuito}
          onChange={(e) => setBorrador({ ...borrador, circuito: e.target.value })}
        >
          <option value="">Todos</option>
          <option value="directa">Directa</option>
          <option value="propia">Propia</option>
        </Select>
      </FilterField>
      <FilterField label="Estado observado">
        <Select
          className="w-52"
          value={borrador.estadoObservado}
          onChange={(e) => setBorrador({ ...borrador, estadoObservado: e.target.value })}
        >
          <option value="">Todos</option>
          {ESTADOS_SEGUIMIENTO.map((v) => (
            <option key={v} value={v}>
              {ESTADO_LABEL[v]}
            </option>
          ))}
        </Select>
      </FilterField>
      <FilterActions
        aplicarDeshabilitado={!campaniaOk}
        onClear={() => {
          setBorrador(filtrosVacios);
          setFiltros(filtrosVacios);
          reiniciar();
        }}
        aviso={
          !campaniaOk && (
            <p role="alert" className="mr-auto text-sm text-rojo">
              Ingresá una campaña como 2025-2026.
            </p>
          )
        }
      />
    </>
  );
  return (
    <>
      <PageHeader
        title="Cargas a puerto"
        subtitle="Seguimiento operativo por cupo recibido y fecha prevista de carga."
        actions={
          <Button
            variant="outline"
            disabled={bloqueada}
            onClick={() => excel.exportar({ ...rango, ...params, anulados: tab === "anuladas" })}
          >
            {excel.isPending ? "Exportando…" : "Exportar Excel"}
          </Button>
        }
      />
      <div inert={!!flota}>
        <AvisoDemo />
      </div>
      {excel.isPending && (
        <p role="status" className="mb-4 text-sm text-ink-soft">
          Preparando todos los seguimientos del período y los filtros aplicados…
        </p>
      )}
      {excel.error && (
        <p role="alert" className="mb-4 text-sm text-rojo">
          {toAppError(excel.error).message}
        </p>
      )}
      {aviso && (
        <p role="status" className="mb-4 text-sm text-rojo">
          {aviso}
        </p>
      )}
      <Tabs
        value={tab}
        onValueChange={(v) => {
          if (!bloqueada) {
            setTab(v);
            reiniciar();
          }
        }}
      >
        <fieldset disabled={bloqueada} className="min-w-0">
          <TabsList className="mb-4 max-w-full overflow-x-auto">
            <TabsTrigger value="dia">Día</TabsTrigger>
            <TabsTrigger value="periodo">Período</TabsTrigger>
            <TabsTrigger value="anuladas">Anuladas</TabsTrigger>
            <TabsTrigger value="desfasajes">Desfasajes</TabsTrigger>
          </TabsList>
        </fieldset>
        <fieldset disabled={bloqueada}>
          {/* Fecha y filtros en la MISMA barra, como en Cupos: son los filtros de la misma tabla.
              Sueltos, sin la barra que los agrupa, se estiraban a lo ancho de la pantalla. */}
          {tab === "dia" ? (
            <FilterBar onSubmit={aplicarFiltros}>
              <FilterField label="Fecha prevista de carga">
                <div className="w-40">
                  <DateField
                    value={dia}
                    onChange={(v) => {
                      setDia(v);
                      reiniciar();
                    }}
                  />
                </div>
              </FilterField>
              {camposFiltro}
            </FilterBar>
          ) : (
            <PeriodoFiltro
              value={periodo}
              etiqueta="Fecha prevista de carga"
              onChange={(v) => {
                setPeriodo(v);
                reiniciar();
              }}
              onSubmit={aplicarFiltros}
            >
              {camposFiltro}
            </PeriodoFiltro>
          )}
        </fieldset>
        {["dia", "periodo", "anuladas"].map((v) => (
          <TabsContent key={v} value={v}>
            <TablaLogistica
              titulo="Cargas a puerto"
              filas={q.data?.pages.flatMap((p) => p.filas) ?? []}
              clave={(f) => f.cupoId}
              cargando={q.isLoading}
              error={q.error}
              reintentar={!bloqueada ? () => void q.refetch() : undefined}
              hayMas={!bloqueada && q.hasNextPage}
              mas={() => void q.fetchNextPage()}
              cargandoMas={q.isFetchingNextPage}
              vacio={
                tab === "anuladas"
                  ? "No hay seguimientos anulados para estas fechas y filtros."
                  : "No hay cargas para estas fechas y filtros. Los cupos aparecen al registrar su recepción."
              }
              columnas={[
                {
                  titulo: "Cupo / recepción",
                  celda: (f) => (
                    <>
                      <div>{f.cupo.codigoTerminal || "Código pendiente"}</div>
                      <div className="text-xs text-ink-soft">{f.cupo.contratoVenta}</div>
                      <div className="text-xs text-ink-soft">
                        {f.referenciaRecepcion} · fila {f.cupo.ordinal}
                      </div>
                    </>
                  ),
                },
                { titulo: "Fecha prevista de carga", celda: (f) => fecha(f.cupo.fechaCarga) },
                { titulo: "Destinatario", celda: destinatarioSeguimiento },
                {
                  titulo: "Cereal / campaña",
                  celda: (f) => `${f.cupo.productoNombre ?? f.cupo.producto} / ${f.cupo.campania}`,
                },
                {
                  titulo: "Destino / circuito / lugar",
                  celda: (f) => (
                    <>
                      <div>{f.cupo.destinoNombre ?? f.cupo.destinoCodigo}</div>
                      <div className="text-xs text-ink-soft">
                        {f.cupo.circuito} · {f.cupo.lugarTipo}
                        {f.cupo.lugarReferencia ? `: ${f.cupo.lugarReferencia}` : ""}
                      </div>
                    </>
                  ),
                },
                {
                  titulo: "Estado observado",
                  celda: (f) => (
                    <>
                      <div>{ESTADO_LABEL[f.estadoObservado]}</div>
                      <div className="text-xs text-ink-soft">
                        {f.anuladoAl
                          ? "Anulado"
                          : f.estadoFuente
                            ? FUENTE_LABEL[f.estadoFuente]
                            : "Sin observación registrada"}
                      </div>
                    </>
                  ),
                },
                {
                  titulo: "Camión elegido",
                  celda: (f) =>
                    f.flotaVigente ? (
                      <>
                        <div>{f.flotaVigente.patenteChasis}</div>
                        <div className="mt-1 text-xs text-ink-soft">
                          {f.flotaVigente.patenteAcoplado ?? "Sin acoplado informado"}
                        </div>
                        <div className="text-xs text-ink-soft">
                          {f.flotaVigente.conductor ?? "Sin conductor informado"} · revisión{" "}
                          {f.flotaVigente.revision}
                        </div>
                      </>
                    ) : (
                      "Sin camión elegido"
                    ),
                },
                { titulo: "Patente operativa", celda: (f) => valorOperativo(f, "patente") },
                {
                  titulo: "Carga operativa",
                  numero: true,
                  celda: (f) => valorOperativo(f, "kg_carga"),
                },
                {
                  titulo: "Descarga operativa",
                  numero: true,
                  celda: (f) => valorOperativo(f, "kg_descarga"),
                },
                {
                  titulo: "Acciones",
                  celda: (f) => (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={bloqueada}
                        onClick={() => setDetalleId(f.cupoId)}
                      >
                        Detalle
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={bloqueada}
                        onClick={() => setHistoriaId(f.cupoId)}
                      >
                        Historial
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          </TabsContent>
        ))}
        <TabsContent value="desfasajes">
          <ConciliacionTabla
            paginas={conciliacion.data?.pages ?? []}
            cargando={conciliacion.isLoading}
            error={conciliacion.error}
            reintentar={() => {
              if (!bloqueada) void conciliacion.refetch();
            }}
            hayMas={!bloqueada && conciliacion.hasNextPage}
            mas={() => void conciliacion.fetchNextPage()}
            cargandoMas={conciliacion.isFetchingNextPage}
            bloqueada={bloqueada}
            onDetalle={setDetalleId}
          />
        </TabsContent>
      </Tabs>
      {detalleId && (
        <SeguimientoDetalle
          cupoId={detalleId}
          gestionar={gestionar}
          gestionarVinculos={gestionarVinculos}
          onElegirCamion={(snapshot) => abrirFlota(snapshot)}
          onRetirarCamion={(snapshot) => abrirFlota(snapshot, true)}
          onVincular={(snapshot) => {
            setDetalleId(null);
            setAviso(null);
            setVinculo({ snapshot, modo: "vincular" });
          }}
          onReemplazar={(snapshot) => {
            setDetalleId(null);
            setAviso(null);
            setVinculo({ snapshot, modo: "reemplazar" });
          }}
          onRetirar={(snapshot) => {
            setDetalleId(null);
            setAviso(null);
            setVinculo({ snapshot, modo: "retirar" });
          }}
          onClose={() => setDetalleId(null)}
          onEditar={editar}
          onHistoria={() => {
            setHistoriaId(detalleId);
            setDetalleId(null);
          }}
        />
      )}
      {editor && (
        <SeguimientoDialog
          seguimiento={editor.snapshot}
          modo={editor.modo}
          onClose={() => setEditor(null)}
          onConflict={() => {
            setEditor(null);
            setAviso(
              "El seguimiento cambió. Abrí el detalle actualizado para revisar y volver a registrar la observación.",
            );
          }}
        />
      )}
      {vinculo?.modo === "retirar" && (
        <RetirarVinculoErpDialog
          seguimiento={vinculo.snapshot}
          onClose={() => setVinculo(null)}
          onConflict={() => {
            setVinculo(null);
            setAviso(
              "El cupo cambió. Abrí el detalle actualizado para revisar la referencia y realizar un nuevo intento explícito.",
            );
          }}
        />
      )}
      {vinculo && vinculo.modo !== "retirar" && (
        <VinculoErpDialog
          seguimiento={vinculo.snapshot}
          modo={vinculo.modo}
          onClose={() => setVinculo(null)}
          onConflict={() => {
            setVinculo(null);
            setAviso(
              "El cupo cambió. Abrí el detalle actualizado para revisar y volver a vincular con una nueva lectura propia.",
            );
          }}
        />
      )}
      {flota &&
        (flota.retirar ? (
          <RetirarFlotaSeguimientoDialog
            seguimiento={flota.snapshot}
            onClose={() => setFlota(null)}
            onConflict={conflictoFlota}
          />
        ) : (
          <FlotaSeguimientoDialog
            seguimiento={flota.snapshot}
            onClose={() => setFlota(null)}
            onConflict={conflictoFlota}
          />
        ))}
      {historiaId && (
        <HistorialDialog
          recurso="seguimientos"
          id={historiaId}
          onClose={() => setHistoriaId(null)}
        />
      )}
    </>
  );
}
