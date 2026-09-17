import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampaniaSelect } from "@/shared/components/campania-select";
import { DataTable, type Column } from "@/shared/components/data-table";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { numero } from "@/shared/format/format";
import { toAppError } from "@/lib/api-error";
import { confirmarCambioConBorrador } from "@/shared/hooks/use-aviso-cambios-sin-guardar";
import type { ContextoPlanificacion, SucursalComercial, VendedorComercial } from "../types";
import { useActualizarDatosPlan } from "../queries/use-guardar-plan";
import { useVendedoresPlanificacion } from "../queries/use-plan-siembra";
import {
  useControlPadron, useGuardarSucursal, useGuardarVendedor, useSucursales,
  useUsuariosAsignables, useViajantesMacroGest,
} from "../queries/use-vendedores";
import { ControlPadron } from "./control-padron";
import { VendedorDialog } from "./vendedor-dialog";

interface EdicionSucursal {
  id: number;
  nombre: string;
  activa: boolean;
  baseNombre: string;
  baseActiva: boolean;
}

export function VendedoresPanel({
  contexto, activo, onDirtyChange,
}: {
  contexto: ContextoPlanificacion;
  activo: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [campaniaElegida, setCampaniaElegida] = useState<string>();
  const campania = campaniaElegida ?? contexto.campaniaVigente;
  const habilitado = activo && contexto.alcance.veTodo;
  const sucursales = useSucursales(habilitado);
  const vendedores = useVendedoresPlanificacion(habilitado);
  const viajantes = useViajantesMacroGest(habilitado);
  const usuarios = useUsuariosAsignables(habilitado);
  const control = useControlPadron(campania, habilitado);
  const guardarSucursal = useGuardarSucursal();
  const guardarVendedor = useGuardarVendedor();
  const actualizarDatos = useActualizarDatosPlan();
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [edicion, setEdicion] = useState<EdicionSucursal | null>(null);
  const [errorSucursal, setErrorSucursal] = useState<string>();
  const [dialogo, setDialogo] = useState<VendedorComercial | "nuevo" | null>(null);
  const dialogoAbierto = useRef(false);
  const [dialogoDirty, setDialogoDirty] = useState(false);
  const sucursalDirty = !!nuevoNombre.trim() ||
    (edicion !== null && (edicion.nombre !== edicion.baseNombre ||
      edicion.activa !== edicion.baseActiva));
  const dirty = sucursalDirty || dialogoDirty;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  async function crearSucursal(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nombre = nuevoNombre.trim();
    if (!nombre) {
      setErrorSucursal("Ingresá el nombre de la sucursal.");
      return;
    }
    try {
      await guardarSucursal.mutateAsync({ nombre, activa: true });
      setNuevoNombre("");
      setErrorSucursal(undefined);
      toast.success("Sucursal creada.");
    } catch (error) {
      setErrorSucursal(toAppError(error).message);
    }
  }

  function empezarEdicion(sucursal: SucursalComercial) {
    if (guardarSucursal.isPending) return;
    if (edicion && !confirmarCambioConBorrador(
      edicion.nombre !== edicion.baseNombre || edicion.activa !== edicion.baseActiva,
    )) return;
    setEdicion({
      id: sucursal.id, nombre: sucursal.nombre, activa: sucursal.activa,
      baseNombre: sucursal.nombre, baseActiva: sucursal.activa,
    });
    setErrorSucursal(undefined);
  }

  async function actualizarSucursal(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!edicion) return;
    const nombre = edicion.nombre.trim();
    if (!nombre) {
      setErrorSucursal("Ingresá el nombre de la sucursal.");
      return;
    }
    try {
      await guardarSucursal.mutateAsync({
        id: edicion.id, nombre, activa: edicion.activa,
      });
      setEdicion(null);
      setErrorSucursal(undefined);
      toast.success("Sucursal actualizada.");
    } catch (error) {
      setErrorSucursal(toAppError(error).message);
    }
  }

  function cancelarEdicion() {
    if (guardarSucursal.isPending || !edicion || !confirmarCambioConBorrador(
      edicion.nombre !== edicion.baseNombre || edicion.activa !== edicion.baseActiva,
    )) return;
    setEdicion(null);
    setErrorSucursal(undefined);
  }

  const datosControl = control.data?.campania === campania && !control.isError &&
    !(control.isStale && control.isFetching) ? control.data : undefined;
  function abrirDialogo(vendedor: VendedorComercial | "nuevo") {
    if (dialogo !== null || dialogoAbierto.current) return;
    dialogoAbierto.current = true;
    setDialogo(vendedor);
  }

  function cerrarDialogo() {
    dialogoAbierto.current = false;
    setDialogo(null);
  }

  const nombresViajantes = new Map((viajantes.data ?? [])
    .map((item) => [item.codigo, item.nombre]));
  const productores = new Map(
    (datosControl?.productoresPorVendedor ?? [])
      .map((item) => [item.vendedorId, item.productores]),
  );
  const columnas: Column<VendedorComercial>[] = [
    { key: "nombre", header: "Vendedor", sortBy: (item) => item.nombre,
      cell: (item) => <span className="font-semibold text-ink">{item.nombre}</span> },
    { key: "sucursal", header: "Sucursal", sortBy: (item) => item.sucursal,
      cell: (item) => item.sucursal },
    { key: "viajantes", header: "Viajantes MacroGest",
      cell: (item) => <div className="flex max-w-sm flex-wrap gap-1">
        {item.viajantes.map((codigo) => (
          <span key={codigo} className="rounded-full border border-line bg-panel-soft px-2 py-0.5 text-xs text-ink">
            <span className="font-semibold tabular">{codigo}</span>{" "}
            {nombresViajantes.get(codigo) ?? "Código sin nombre"}
          </span>
        ))}
      </div> },
    { key: "usuario", header: "Usuario", cell: (item) => item.usuarioNombre ?? "—" },
    { key: "estado", header: "Estado", sortBy: (item) => item.activo ? 1 : 0,
      cell: (item) => <span className={item.activo ? "text-verde" : "text-ink-soft"}>
        {item.activo ? "Activo" : "Inactivo"}
      </span> },
    { key: "productores", header: "Productores", align: "right",
      sortBy: (item) => productores.get(item.id) ?? 0,
      cell: (item) => datosControl
        ? numero(productores.get(item.id) ?? 0) : "—" },
    { key: "acciones", header: "Acciones", align: "right",
      cell: (item) => <Button type="button" variant="outline" size="sm"
        disabled={dialogo !== null || !sucursales.data || !viajantes.data || !usuarios.data}
        onClick={() => abrirDialogo(item)}>Editar</Button> },
  ];
  const catalogosListos = !!sucursales.data && !!viajantes.data && !!usuarios.data &&
    !!vendedores.data;

  if (!contexto.alcance.veTodo) return null;
  return (
    <div className="space-y-6">
      <FilterBar>
        <FilterField label="Campaña del control">
          <CampaniaSelect value={campania}
            campanias={contexto.campanias.map((item) => item.codigo)}
            onChange={setCampaniaElegida} />
        </FilterField>
        <p className="self-end pb-2 text-xs text-ink-soft">
          El catálogo es común a todas las campañas; el control corresponde a la campaña elegida.
        </p>
      </FilterBar>

      <section className="rounded-card border border-line bg-panel p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Sucursales comerciales</h2>
            <p className="text-sm text-ink-soft">Se asignan a los vendedores de la app.</p>
          </div>
        </div>
        {sucursales.isError ? (
          <ErrorState error={sucursales.error} onRetry={() => void sucursales.refetch()} />
        ) : !sucursales.data ? (
          <EmptyState mensaje="Cargando sucursales…" />
        ) : (
          <div className="space-y-3">
            <ul className="divide-y divide-line-soft rounded-md border border-line">
              {sucursales.data.map((sucursal) => (
                <li key={sucursal.id} className="px-3 py-2">
                  {edicion?.id === sucursal.id ? (
                    <form onSubmit={(evento) => void actualizarSucursal(evento)}
                      className="flex flex-wrap items-end gap-2">
                      <div className="min-w-48 flex-1 space-y-1">
                        <label htmlFor={"sucursal-" + sucursal.id} className="text-xs text-ink-soft">Nombre</label>
                        <Input id={"sucursal-" + sucursal.id} value={edicion.nombre}
                          maxLength={60} disabled={guardarSucursal.isPending}
                          onChange={(evento) => setEdicion({ ...edicion, nombre: evento.target.value })} />
                      </div>
                      <label className="flex h-10 items-center gap-2 text-sm text-ink">
                        <input type="checkbox" checked={edicion.activa} disabled={guardarSucursal.isPending}
                          onChange={(evento) => setEdicion({ ...edicion, activa: evento.target.checked })} />
                        Activa
                      </label>
                      <Button type="submit" size="sm" disabled={guardarSucursal.isPending}>Guardar</Button>
                      <Button type="button" size="sm" variant="outline"
                        onClick={cancelarEdicion} disabled={guardarSucursal.isPending}>Cancelar</Button>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="font-medium text-ink">{sucursal.nombre}</span>
                        <span className="ml-2 text-xs text-ink-soft">
                          {sucursal.activa ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                      <Button type="button" size="sm" variant="outline"
                        disabled={guardarSucursal.isPending}
                        onClick={() => empezarEdicion(sucursal)}>Editar</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <form onSubmit={(evento) => void crearSucursal(evento)}
              className="flex flex-wrap items-end gap-2">
              <div className="min-w-48 flex-1 space-y-1">
                <label htmlFor="nueva-sucursal" className="text-xs text-ink-soft">Nueva sucursal</label>
                <Input id="nueva-sucursal" value={nuevoNombre}
                  maxLength={60} disabled={guardarSucursal.isPending}
                  onChange={(evento) => { setNuevoNombre(evento.target.value); setErrorSucursal(undefined); }}
                  placeholder="Nombre de la sucursal" />
              </div>
              <Button type="submit" disabled={guardarSucursal.isPending}>Agregar sucursal</Button>
            </form>
            {errorSucursal && <p role="alert" className="text-sm text-rojo">{errorSucursal}</p>}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Vendedores</h2>
            <p className="text-sm text-ink-soft">
              Los códigos de MacroGest determinan la cartera. Productores: CUIT activos o con movimiento.
            </p>
          </div>
          <Button type="button" disabled={!catalogosListos || dialogo !== null}
            onClick={() => abrirDialogo("nuevo")}>
            Nuevo vendedor
          </Button>
        </div>
        {vendedores.isError ? (
          <ErrorState error={vendedores.error} onRetry={() => void vendedores.refetch()} />
        ) : !vendedores.data ? (
          <EmptyState mensaje="Cargando vendedores…" />
        ) : (
          <DataTable columns={columnas} rows={vendedores.data}
            getRowKey={(item) => item.id} empty="Todavía no hay vendedores cargados." />
        )}
        {viajantes.isError && <ErrorState error={viajantes.error}
          onRetry={() => void viajantes.refetch()} />}
        {usuarios.isError && <ErrorState error={usuarios.error}
          onRetry={() => void usuarios.refetch()} />}
      </section>

      {control.isError ? (
        <ErrorState error={control.error} onRetry={() => void control.refetch()} />
      ) : datosControl ? (
        <ControlPadron datos={datosControl} vendedores={vendedores.data ?? []} />
      ) : (
        <EmptyState mensaje="Cargando control del padrón…" />
      )}
      <aside className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-panel-soft px-4 py-3 text-xs text-ink-soft">
        <span>{datosControl?.datosMacroGestAl
          ? "Datos MacroGest al " + new Date(datosControl.datosMacroGestAl).toLocaleString("es-AR", {
            timeZone: "America/Argentina/Buenos_Aires",
          })
          : "Sin datos de MacroGest"}</span>
        <Button type="button" variant="ghost" size="sm" disabled={actualizarDatos.isPending}
          onClick={() => void actualizarDatos.mutateAsync(campania)
            .catch((error) => toast.error(toAppError(error).message))}>
          {actualizarDatos.isPending ? "Actualizando…" : "Actualizar"}
        </Button>
      </aside>

      {dialogo !== null && catalogosListos && (
        <VendedorDialog key={dialogo === "nuevo" ? "nuevo" : dialogo.id}
          vendedor={dialogo === "nuevo" ? null : dialogo}
          sucursales={sucursales.data ?? []}
          viajantes={viajantes.data ?? []}
          usuarios={usuarios.data ?? []}
          vendedores={vendedores.data ?? []}
          guardando={guardarVendedor.isPending}
          onDirtyChange={setDialogoDirty}
          onClose={cerrarDialogo}
          onGuardar={async (request) => {
            await guardarVendedor.mutateAsync({
              id: dialogo === "nuevo" ? undefined : dialogo.id, request,
            });
            toast.success(dialogo === "nuevo" ? "Vendedor creado." : "Vendedor actualizado.");
          }} />
      )}
    </div>
  );
}
