import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toAppError } from "@/lib/api-error";
import { CampaniaSelect } from "@/shared/components/campania-select";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { KpiCard } from "@/shared/components/kpi-card";
import { useAvisoCambiosSinGuardar } from "@/shared/hooks/use-aviso-cambios-sin-guardar";
import { numero, tn, usd } from "@/shared/format/format";
import {
  CULTIVOS,
  type ContextoPlanificacion,
  type Cultivo,
  type HectareasPlan,
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
  valorHectareas,
  type BorradorPlan,
} from "../lib/borrador-plan";
import { mercadoUsd, potencialTn, totalHectareas } from "../lib/calculos";
import { usePlanSiembra, useVendedoresPlanificacion } from "../queries/use-plan-siembra";
import { useActualizarDatosPlan, useGuardarPlan } from "../queries/use-guardar-plan";
import { BarraGuardado } from "./barra-guardado";
import { PlanSiembraGrilla } from "./plan-siembra-grilla";

type ErroresCeldas = Record<string, Partial<Record<Cultivo, string>>>;

function planCalculable(fila: PlanSiembraFila, borrador: BorradorPlan): HectareasPlan | null {
  const plan = valorHectareas(fila, borrador);
  if (CULTIVOS.every((cultivo) => plan[cultivo] === null)) return null;
  if (CULTIVOS.some((cultivo) => plan[cultivo] !== null && !Number.isFinite(plan[cultivo])))
    return null;
  return plan;
}

function horaMacroGest(fecha: string): string {
  return new Date(fecha).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PlanSiembraPanel({ contexto }: { contexto: ContextoPlanificacion }) {
  const [campaniaElegida, setCampaniaElegida] = useState<string>();
  const campania = campaniaElegida ?? contexto.campaniaVigente;
  const [vendedorId, setVendedorId] = useState<number>();
  const [incluirSinMovimiento, setIncluirSinMovimiento] = useState(false);
  const [soloSinPlan, setSoloSinPlan] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [borrador, setBorrador] = useState<BorradorPlan>({});
  const [erroresApi, setErroresApi] = useState<ErroresCeldas>({});
  const [conflictos, setConflictos] = useState<Set<string>>(new Set());
  const [mensajeError, setMensajeError] = useState<string>();
  const [requiereRecarga, setRequiereRecarga] = useState(false);

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
  const { confirmarCambio } = useAvisoCambiosSinGuardar(cambios.length > 0);

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

  const resumen = useMemo(() => {
    let conPlan = 0,
      hectareas = 0,
      mercado = 0,
      potencial = 0;
    for (const fila of filas) {
      const plan = planCalculable(fila, borrador);
      if (!plan) continue;
      conPlan++;
      hectareas += totalHectareas(plan);
      mercado += mercadoUsd(plan, dataVigente?.marketShare ?? null) ?? 0;
      potencial += potencialTn(plan, dataVigente?.marketShare ?? null) ?? 0;
    }
    return { conPlan, hectareas, mercado, potencial };
  }, [filas, borrador, dataVigente?.marketShare]);

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
              {vendedores.data?.map((vendedor) => (
                <option key={vendedor.id} value={vendedor.id}>
                  {vendedor.nombre} · {vendedor.sucursal}
                </option>
              ))}
            </Select>
          </FilterField>
        )}
        <FilterField label="Buscar">
          <Input
            aria-label="Buscar productor"
            value={buscar}
            onChange={(evento) => setBuscar(evento.target.value)}
            placeholder="Nombre, CUIT o cuenta"
            className="min-w-52"
          />
        </FilterField>
        <label className="flex h-10 items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={soloSinPlan}
            onChange={(evento) => setSoloSinPlan(evento.target.checked)}
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Avance de carga"
              value={resumen.conPlan + " de " + filas.length}
              hint="productores con plan"
            />
            <KpiCard
              label="Hectáreas"
              value={hayErrores ? "—" : numero(resumen.hectareas)}
              hint="según el borrador"
            />
            <KpiCard
              label="Mercado"
              value={hayErrores || !dataVigente.marketShare ? "—" : usd(resumen.mercado)}
              hint="USD estimados"
            />
            <KpiCard
              label="Potencial"
              value={hayErrores || !dataVigente.marketShare ? "—" : tn(resumen.potencial)}
            />
          </div>
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
            filas={filtradas}
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
          <div className="flex items-center justify-between text-xs text-ink-soft">
            <span>
              {dataVigente.datosMacroGestAl
                ? "Datos de MacroGest al " + horaMacroGest(dataVigente.datosMacroGestAl)
                : "Sin datos de MacroGest"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void refrescarMacroGest()}
              disabled={actualizar.isPending}
            >
              Actualizar
            </Button>
          </div>
          {editable && (
            <BarraGuardado
              cantidad={cambios.length}
              hayErrores={hayErrores || conflictos.size > 0}
              guardando={guardar.isPending}
              onDescartar={descartar}
              onGuardar={() => void guardarCambios()}
            />
          )}
        </>
      )}
    </div>
  );
}
