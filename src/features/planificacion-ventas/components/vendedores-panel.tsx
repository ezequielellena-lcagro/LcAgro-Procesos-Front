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
import type {
  ContextoPlanificacion, SucursalComercial, VendedorComercial, ViajanteAsignable,
} from "../types";
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

interface FilaVendedor {
  clave: string;
  nombre: string;
  sucursal: string;
  viajantes: number[];
  usuarioNombre: string | null;
  activo: boolean | null;
  vendedor: VendedorComercial | null;
  viajante: ViajanteAsignable | null;
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
  const [dialogo, setDialogo] = useState<VendedorComercial | ViajanteAsignable | null>(null);
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
  function abrirDialogo(vendedor: VendedorComercial | ViajanteAsignable) {
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
  const configurados = vendedores.data ?? [];
  const codigosConfigurados = new Set(configurados.flatMap((item) => item.viajantes));
  const filas: FilaVendedor[] = [
    ...configurados.map((item) => ({
      clave: "vendedor-" + item.id, nombre: item.nombre, sucursal: item.sucursal,
      viajantes: item.viajantes, usuarioNombre: item.usuarioNombre, activo: item.activo,
      vendedor: item, viajante: null,
    })),
    ...(viajantes.data ?? []).filter((item) =>
      item.vendedorId === null && !codigosConfigurados.has(item.codigo)).map((item) => ({
      clave: "viajante-" + item.codigo, nombre: item.nombre, sucursal: "Sin asignar",
      viajantes: [item.codigo], usuarioNombre: null, activo: null,
      vendedor: null, viajante: item,
    })),
  ];
  const productores = new Map(
    (datosControl?.productoresPorVendedor ?? [])
      .map((item) => [item.vendedorId, item.productores]),
  );
  const columnas: Column<FilaVendedor>[] = [
    { key: "nombre", header: "Vendedor", sortBy: (item) => item.nombre,
      cell: (item) => <span className="font-semibold text-ink">{item.nombre}</span> },
    { key: "sucursal", header: "Sucursal", sortBy: (item) => item.vendedor?.sucursal ?? null,
      cell: (item) => item.vendedor ? item.sucursal :
        <span className="text-ink-soft">Sin asignar</span> },
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
    { key: "estado", header: "Estado", sortBy: (item) => item.activo === null ? null : item.activo ? 1 : 0,
      cell: (item) => <span className={item.activo ? "text-verde" : "text-ink-soft"}>
        {item.activo === null ? "Sin configurar" : item.activo ? "Activo" : "Inactivo"}
      </span> },
    { key: "productores", header: "Productores", align: "right",
      sortBy: (item) => item.vendedor && datosControl ?
        productores.get(item.vendedor.id) ?? 0 : null,
      cell: (item) => item.vendedor && datosControl
        ? numero(productores.get(item.vendedor.id) ?? 0) : "—" },
    { key: "acciones", header: "Acciones", align: "right",
      cell: (item) => <Button type="button" variant="outline" size="sm"
        disabled={dialogo !== null || !sucursales.data || !viajantes.data || !usuarios.data}
        onClick={() => abrirDialogo(item.vendedor ?? item.viajante!)}>
        {item.vendedor ? "Editar" : "Configurar"}
      </Button> },
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
              Viajantes tomados de MacroGest. La sucursal y el usuario se configuran en la app.
              Los códigos determinan la cartera.
            </p>
          </div>
        </div>
        {vendedores.isError ? (
          <ErrorState error={vendedores.error} onRetry={() => void vendedores.refetch()} />
        ) : !vendedores.data || !viajantes.data ? (
          <EmptyState mensaje="Cargando vendedores…" />
        ) : (
          <DataTable columns={columnas} rows={filas}
            getRowKey={(item) => item.clave} defaultSort={{ key: "nombre" }}
            empty="No hay viajantes en MacroGest." />
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
        <VendedorDialog key={"codigo" in dialogo ? "viajante-" + dialogo.codigo : "vendedor-" + dialogo.id}
          vendedor={"codigo" in dialogo ? null : dialogo}
          viajanteInicial={"codigo" in dialogo ? dialogo : null}
          sucursales={sucursales.data ?? []}
          viajantes={viajantes.data ?? []}
          usuarios={usuarios.data ?? []}
          vendedores={vendedores.data ?? []}
          guardando={guardarVendedor.isPending}
          onDirtyChange={setDialogoDirty}
          onClose={cerrarDialogo}
          onGuardar={async (request) => {
            await guardarVendedor.mutateAsync({
              id: "codigo" in dialogo ? undefined : dialogo.id, request,
            });
            toast.success("codigo" in dialogo ? "Vendedor configurado." : "Vendedor actualizado.");
          }} />
      )}
    </div>
  );
}
