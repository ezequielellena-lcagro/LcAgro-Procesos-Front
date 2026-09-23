import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toAppError } from "@/lib/api-error";
import { CampaniaSelect } from "@/shared/components/campania-select";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { Pagination, type UnidadPaginacion } from "@/shared/components/pagination";
import { confirmarCambioConBorrador } from "@/shared/hooks/use-aviso-cambios-sin-guardar";
import {
  type ContextoPlanificacion,
  type Cultivo,
  type PlanSiembraFila,
} from "../types";
import {
  cambiosDelPlan,
  cancelarCelda,
  completarVaciosConAnterior,
  editarCelda,
  erroresDelBorrador,
  erroresPorCuit,
  finalizarEdicion,
  planBase,
  usarAnteriorEnFila,
  type BorradorPlan,
} from "../lib/borrador-plan";
import { usePlanSiembra, useVendedoresPlanificacion } from "../queries/use-plan-siembra";
import { useActualizarDatosPlan, useGuardarPlan } from "../queries/use-guardar-plan";
import { AccionesGuardado } from "./acciones-guardado";
import { FuenteDatos } from "./fuente-datos";
import { PlanSiembraGrilla } from "./plan-siembra-grilla";

type ErroresCeldas = Record<string, Partial<Record<Cultivo, string>>>;

const FILAS_POR_PAGINA = 50;
const PRODUCTORES: UnidadPaginacion = { singular: "productor", plural: "productores" };

export function PlanSiembraPanel({
  contexto,
  activo = true,
  slotFuente,
  onDirtyChange,
}: {
  contexto: ContextoPlanificacion;
  /** La solapa visible es la única que manda su fuente de datos al encabezado. */
  activo?: boolean;
  slotFuente?: HTMLElement | null;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [campaniaElegida, setCampaniaElegida] = useState<string>();
  const campania = campaniaElegida ?? contexto.campaniaVigente;
  const [vendedorId, setVendedorId] = useState<number>();
  const [incluirSinMovimiento, setIncluirSinMovimiento] = useState(true);
  const [soloSinPlan, setSoloSinPlan] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [borrador, setBorrador] = useState<BorradorPlan>({});
  const [erroresApi, setErroresApi] = useState<ErroresCeldas>({});
  const [conflictos, setConflictos] = useState<Set<string>>(new Set());
  const [mensajeError, setMensajeError] = useState<string>();
  const [requiereRecarga, setRequiereRecarga] = useState(false);
  const [pagina, setPagina] = useState(1);

  const sinVendedor = !contexto.alcance.veTodo && !contexto.alcance.vendedor;
  const puedeConsultar = !sinVendedor && (!contexto.alcance.veTodo || vendedorId !== undefined);
  const vendedores = useVendedoresPlanificacion(contexto.alcance.veTodo);
  const query = usePlanSiembra(
    campania,
    contexto.alcance.veTodo ? vendedorId : undefined,
    incluirSinMovimiento,
    puedeConsultar,
  );
  const guardar = useGuardarPlan();
  const actualizar = useActualizarDatosPlan();

  const dataVigente =
    query.data?.campania === campania && !query.isPlaceholderData ? query.data : undefined;
  const editable = !!dataVigente?.editable && !requiereRecarga && !query.isError;
  const filas = useMemo(() => dataVigente?.filas ?? [], [dataVigente]);
  const cambios = useMemo(() => cambiosDelPlan(filas, borrador), [filas, borrador]);
  const errores = useMemo(() => {
    const locales = erroresDelBorrador(filas, borrador);
    const todos: ErroresCeldas = { ...erroresApi };
    for (const [cuit, celdas] of Object.entries(locales))
      todos[cuit] = { ...todos[cuit], ...celdas };
    return todos;
  }, [filas, borrador, erroresApi]);
  const hayErrores = Object.values(errores).some((celdas) => Object.keys(celdas).length > 0);
  useEffect(() => onDirtyChange?.(cambios.length > 0), [onDirtyChange, cambios.length]);
  const confirmarCambio = () => confirmarCambioConBorrador(cambios.length > 0);

  const filtradas = useMemo(() => {
    const texto = buscar.trim().toLocaleLowerCase("es-AR");
    return filas.filter(
      (fila) =>
        (!soloSinPlan || planBase(fila, borrador) === null) &&
        (!texto ||
          fila.razonSocial.toLocaleLowerCase("es-AR").includes(texto) ||
          fila.cuit.includes(texto) ||
          fila.cuentas.some((cuenta) => String(cuenta).includes(texto))),
    );
  }, [filas, buscar, soloSinPlan, borrador]);

  // Paginado en el cliente: el GET trae la cartera completa y el borrador vive por CUIT, así que
  // cambiar de página no pierde ediciones ni recorta lo que se guarda.
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / FILAS_POR_PAGINA));
  const paginaVigente = Math.min(pagina, totalPaginas);
  const visibles = useMemo(
    () => filtradas.slice((paginaVigente - 1) * FILAS_POR_PAGINA, paginaVigente * FILAS_POR_PAGINA),
    [filtradas, paginaVigente],
  );

  function descartar() {
    setBorrador({});
    setErroresApi({});
    setConflictos(new Set());
    setMensajeError(undefined);
    setRequiereRecarga(false);
  }

  function cambiarSeleccion(accion: () => void) {
    if (!confirmarCambio()) return;
    descartar();
    setPagina(1);
    accion();
  }

  function editar(fila: PlanSiembraFila, cultivo: Cultivo, texto: string) {
    setBorrador((actual) => editarCelda(actual, fila, cultivo, texto));
    setErroresApi((actual) => {
      if (!actual[fila.cuit]?.[cultivo]) return actual;
      const celda = { ...actual[fila.cuit] };
      delete celda[cultivo];
      return { ...actual, [fila.cuit]: celda };
    });
    setMensajeError(undefined);
  }

  function cancelarEdicion(fila: PlanSiembraFila, cultivo: Cultivo) {
    setBorrador((actual) => cancelarCelda(actual, fila, cultivo));
    setErroresApi((actual) => {
      if (!actual[fila.cuit]?.[cultivo]) return actual;
      const celda = { ...actual[fila.cuit] };
      delete celda[cultivo];
      return { ...actual, [fila.cuit]: celda };
    });
  }

  async function guardarCambios() {
    if (!editable || !cambios.length || hayErrores || guardar.isPending) return;
    const request = {
      items: cambios,
      ...(contexto.alcance.veTodo ? { vendedorId } : {}),
    };
    try {
      await guardar.mutateAsync({ campania, request });
    } catch (error) {
      const respuesta = toAppError(error);
      if (respuesta.codigo === "plan_modificado" && respuesta.cuits?.length) {
        setConflictos(new Set(respuesta.cuits));
        setMensajeError(
          "El plan cambió en otro lugar. Recargá estas filas antes de volver a guardar.",
        );
      } else if (respuesta.fieldErrors) {
        setErroresApi(erroresPorCuit(cambios, respuesta.fieldErrors));
        setMensajeError("Corregí las celdas marcadas para guardar.");
      } else {
        setMensajeError(respuesta.message);
      }
      return;
    }
    descartar();
    await recargarDespuesDeGuardar();
  }

  async function recargarDespuesDeGuardar() {
    try {
      const resultado = await query.refetch();
      if (resultado.isError || resultado.data?.campania !== campania)
        throw new Error("Recarga fallida");
      setRequiereRecarga(false);
      setMensajeError(undefined);
      toast.success("Plan de siembra guardado.");
    } catch {
      setRequiereRecarga(true);
      setMensajeError(
        "El plan se guardó, pero no se pudo recargar. Recargá los datos antes de seguir editando.",
      );
    }
  }

  async function recargarConflictos() {
    try {
      const resultado = await query.refetch();
      if (resultado.isError || resultado.data?.campania !== campania)
        throw new Error("Recarga fallida");
    } catch {
      setMensajeError("No se pudo recargar. Conservamos tus cambios; probá de nuevo.");
      return;
    }
    setBorrador((actual) => {
      const siguiente = { ...actual };
      for (const cuit of conflictos) delete siguiente[cuit];
      return siguiente;
    });
    setConflictos(new Set());
    setMensajeError(undefined);
  }

  async function refrescarMacroGest() {
    if (!confirmarCambio()) return;
    descartar();
    try {
      await actualizar.mutateAsync(campania);
      const resultado = await query.refetch();
      if (resultado.isError) {
        setMensajeError(toAppError(resultado.error).message);
        return;
      }
      toast.success("Datos de MacroGest actualizados.");
    } catch (error) {
      setMensajeError(toAppError(error).message);
    }
  }

  const anterior = String(Number(campania.slice(0, 4)) - 1) + "/" + campania.slice(2, 4);

  return (
    <div className="space-y-4">
      <FilterBar>
        <FilterField label="Campaña">
          <CampaniaSelect
            value={campania}
            campanias={contexto.campanias.map((c) => c.codigo)}
            onChange={(valor) => cambiarSeleccion(() => setCampaniaElegida(valor))}
          />
        </FilterField>
        {contexto.alcance.veTodo && (
          <FilterField label="Vendedor">
            <Select
              value={vendedorId ?? ""}
              onChange={(evento) =>
                cambiarSeleccion(() => setVendedorId(Number(evento.target.value) || undefined))
              }
            >
              <option value="">Elegí un vendedor…</option>
              {vendedores.data?.filter((vendedor) => vendedor.activo).map((vendedor) => (
                <option key={vendedor.id} value={vendedor.id}>
                  {vendedor.nombre}
                </option>
              ))}
            </Select>
          </FilterField>
        )}
        <FilterField label="Buscar">
          <Input
            aria-label="Buscar productor"
            value={buscar}
            onChange={(evento) => {
              setBuscar(evento.target.value);
              setPagina(1);
            }}
            placeholder="Nombre, CUIT o cuenta"
            className="min-w-52"
          />
        </FilterField>
        <label className="flex h-10 items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={soloSinPlan}
            onChange={(evento) => {
              setSoloSinPlan(evento.target.checked);
              setPagina(1);
            }}
          />
          Sólo sin plan
        </label>
        <label className="flex h-10 items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={incluirSinMovimiento}
            onChange={(evento) =>
              cambiarSeleccion(() => setIncluirSinMovimiento(evento.target.checked))
            }
          />
          Incluir activos sin movimiento
        </label>
        {editable && (
          <AccionesGuardado
            cantidad={cambios.length}
            hayErrores={hayErrores || conflictos.size > 0}
            guardando={guardar.isPending}
            onDescartar={descartar}
            onGuardar={() => void guardarCambios()}
          />
        )}
      </FilterBar>

      {sinVendedor ? (
        <EmptyState mensaje="Tu usuario no tiene cartera asignada. Pedíselo al administrador." />
      ) : !puedeConsultar ? (
        <EmptyState mensaje="Elegí un vendedor para cargar su plan de siembra." />
      ) : query.isError && !dataVigente ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !dataVigente ? (
        <EmptyState mensaje={"Cargando campaña " + campania + "…"} />
      ) : dataVigente.sinVendedor ? (
        <EmptyState mensaje="Tu usuario no tiene cartera asignada. Pedíselo al administrador." />
      ) : (
        <>
          {!dataVigente.editable && (
            <div className="rounded-card border border-line bg-panel-soft px-4 py-3 text-sm text-ink-soft">
              Esta campaña es de solo lectura.
            </div>
          )}
          {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
          {editable && filas.some((fila) => fila.anterior) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBorrador((actual) => completarVaciosConAnterior(filas, actual))}
            >
              Completar vacíos con {anterior}
            </Button>
          )}
          {mensajeError && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-card border border-rojo bg-red-50 px-4 py-3 text-sm text-rojo"
            >
              {mensajeError}
              {conflictos.size > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void recargarConflictos()}
                >
                  Recargar estas filas
                </Button>
              )}
              {requiereRecarga && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void recargarDespuesDeGuardar()}
                >
                  Recargar datos
                </Button>
              )}
            </div>
          )}
          <PlanSiembraGrilla
            filas={visibles}
            mensajeVacio={filas.length === 0
              ? "Este vendedor no tiene clientes con CUIT válido para cargar el plan. Revisá sus cuentas en MacroGest."
              : "No hay productores para estos filtros."}
            marketShare={dataVigente.marketShare}
            campania={campania}
            editable={editable}
            borrador={borrador}
            errores={errores}
            conflictos={conflictos}
            onEditar={editar}
            onFinalizarEdicion={(fila) => setBorrador((actual) => finalizarEdicion(actual, fila))}
            onCancelarCelda={cancelarEdicion}
            onCopiarAnterior={(fila) => setBorrador((actual) => usarAnteriorEnFila(fila, actual))}
            onRecargarConflictos={() => void recargarConflictos()}
          />
          {filtradas.length > 0 && (
            <Pagination
              page={paginaVigente}
              totalPages={totalPaginas}
              total={filtradas.length}
              onPage={setPagina}
              unidad={PRODUCTORES}
              detalle={
                cambios.length > 0
                  ? "los cambios de todas las páginas se guardan juntos"
                  : undefined
              }
            />
          )}
          {activo && (
            <FuenteDatos
              slot={slotFuente}
              datosMacroGestAl={dataVigente.datosMacroGestAl}
              onActualizar={() => void refrescarMacroGest()}
              actualizando={actualizar.isPending}
            />
          )}
        </>
      )}
    </div>
  );
}
