import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { toAppError } from "@/lib/api-error";
import { confirmarCambioConBorrador } from "@/shared/hooks/use-aviso-cambios-sin-guardar";
import type {
  SucursalComercial, UsuarioAsignable, VendedorComercial, VendedorRequest, ViajanteAsignable,
} from "../types";

function inicial(vendedor: VendedorComercial | null, viajanteInicial: ViajanteAsignable | null): VendedorRequest {
  return {
    nombre: vendedor?.nombre ?? viajanteInicial?.nombre ?? "",
    sucursalId: vendedor?.sucursalId ?? 0,
    viajantes: [...(vendedor?.viajantes ?? (viajanteInicial ? [viajanteInicial.codigo] : []))]
      .sort((a, b) => a - b),
    usuarioId: vendedor?.usuarioId ?? null,
    activo: vendedor?.activo ?? true,
  };
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function VendedorDialog({
  vendedor, viajanteInicial, sucursales, viajantes, usuarios, vendedores, guardando, onClose, onGuardar,
  onDirtyChange,
}: {
  vendedor: VendedorComercial | null;
  viajanteInicial: ViajanteAsignable | null;
  sucursales: SucursalComercial[];
  viajantes: ViajanteAsignable[];
  usuarios: UsuarioAsignable[];
  vendedores: VendedorComercial[];
  guardando: boolean;
  onClose: () => void;
  onGuardar: (request: VendedorRequest) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [base] = useState(() => inicial(vendedor, viajanteInicial));
  const [form, setForm] = useState(base);
  const [busqueda, setBusqueda] = useState("");
  const [errores, setErrores] = useState<string[]>([]);
  const [errorServidor, setErrorServidor] = useState<string>();
  const [guardandoLocal, setGuardandoLocal] = useState(false);
  const ocupado = guardando || guardandoLocal;
  const dirty = JSON.stringify(form) !== JSON.stringify(base);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  function cambiar(cambios: Partial<VendedorRequest>) {
    if (ocupado) return;
    setErrores([]);
    setErrorServidor(undefined);
    setForm((actual) => ({ ...actual, ...cambios }));
  }

  function cerrar() {
    if (ocupado || !confirmarCambioConBorrador(dirty)) return;
    onClose();
  }

  function alternarCodigo(codigo: number) {
    if (ocupado) return;
    if (codigo === viajanteInicial?.codigo) return;
    const opcion = viajantes.find((item) => item.codigo === codigo);
    if (!opcion || (!form.viajantes.includes(codigo) &&
      opcion.vendedorId !== null && opcion.vendedorId !== vendedor?.id)) return;
    cambiar({
      viajantes: form.viajantes.includes(codigo)
        ? form.viajantes.filter((actual) => actual !== codigo)
        : [...form.viajantes, codigo].sort((a, b) => a - b),
    });
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado) return;
    const nuevos: string[] = [];
    if (!form.nombre.trim()) nuevos.push("Ingresá el nombre del vendedor.");
    if (!form.sucursalId) nuevos.push("Elegí una sucursal.");
    if (form.viajantes.length === 0) nuevos.push("Elegí al menos un código de viajante.");
    if (nuevos.length) {
      setErrores(nuevos);
      return;
    }
    setGuardandoLocal(true);
    try {
      await onGuardar({ ...form, nombre: form.nombre.trim() });
      onDirtyChange(false);
      onClose();
    } catch (error) {
      setErrorServidor(toAppError(error).message);
    } finally {
      setGuardandoLocal(false);
    }
  }

  const busquedaNormalizada = normalizar(busqueda.trim());
  const coincidencias = viajantes.filter((item) =>
    normalizar(item.codigo + " " + item.nombre).includes(busquedaNormalizada),
  );
  const codigosVigentes = new Set(viajantes.map((item) => item.codigo));
  const faltantes = form.viajantes.filter((codigo) =>
    !codigosVigentes.has(codigo) &&
    normalizar("Código " + codigo + " ya no existe en MacroGest").includes(busquedaNormalizada),
  );
  const sucursalActual = sucursales.find((item) => item.id === form.sucursalId);
  const usuarioAnteriorNoAsignable = form.usuarioId !== null &&
    !usuarios.some((item) => item.id === form.usuarioId);

  return (
    <Modal open onClose={cerrar} title={vendedor ? "Editar vendedor" : "Configurar vendedor"}>
      <form onSubmit={(evento) => void enviar(evento)} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="vendedor-nombre">Nombre del vendedor</Label>
            <Input id="vendedor-nombre" value={form.nombre} disabled={ocupado}
              readOnly={!vendedor}
              onChange={(evento) => cambiar({ nombre: evento.target.value })} maxLength={120} />
            {!vendedor && <p className="text-xs text-ink-soft">Nombre tomado de MacroGest.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendedor-sucursal">Sucursal</Label>
            <Select id="vendedor-sucursal" value={form.sucursalId || ""} disabled={ocupado}
              onChange={(evento) => cambiar({ sucursalId: Number(evento.target.value) })}>
              <option value="">Elegí una sucursal</option>
              {sucursales.filter((item) => item.activa || item.id === sucursalActual?.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}{item.activa ? "" : " · inactiva"}
                  </option>
                ))}
            </Select>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-ink">Códigos de viajante</legend>
          <Input aria-label="Buscar viajante" placeholder="Buscar por código o nombre"
            value={busqueda} disabled={ocupado} onChange={(evento) => setBusqueda(evento.target.value)} />
          <div className="max-h-52 overflow-y-auto rounded-md border border-line bg-panel-soft/50">
            {coincidencias.length === 0 && faltantes.length === 0 ? (
              <p className="px-3 py-3 text-sm text-ink-soft">Sin coincidencias.</p>
            ) : (
              <>
                {faltantes.map((codigo) => (
                  <label key={codigo} className="flex items-center gap-2 border-b border-line-soft px-3 py-2 text-sm text-ink-soft">
                    <input type="checkbox" className="size-4 accent-primary"
                      aria-label={"Código " + codigo + " (ya no existe en MacroGest)"}
                      checked disabled={ocupado}
                      onChange={() => cambiar({
                        viajantes: form.viajantes.filter((actual) => actual !== codigo),
                      })} />
                    Código <span className="font-semibold tabular">{codigo}</span>
                    (ya no existe en MacroGest)
                  </label>
                ))}
                {coincidencias.map((item) => {
                  const ajeno = item.vendedorId !== null && item.vendedorId !== vendedor?.id;
                  const seleccionado = form.viajantes.includes(item.codigo);
                  return (
                    <label key={item.codigo} className="flex items-center justify-between gap-3 border-b border-line-soft px-3 py-2 text-sm last:border-0">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" className="size-4 accent-primary"
                          aria-label={item.codigo + " " + item.nombre}
                          checked={seleccionado}
                          disabled={ocupado || item.codigo === viajanteInicial?.codigo || (ajeno && !seleccionado)}
                          onChange={() => alternarCodigo(item.codigo)} />
                        <span className={ajeno ? "text-ink-soft" : "text-ink"}>
                          <span className="font-semibold tabular">{item.codigo}</span> {item.nombre}
                        </span>
                      </span>
                      {ajeno && <span className="shrink-0 text-xs text-ink-soft">Asignado a {item.vendedorNombre}</span>}
                    </label>
                  );
                })}
              </>
            )}
          </div>
          <p className="text-xs text-ink-soft">{form.viajantes.length} seleccionados</p>
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="vendedor-usuario">Usuario de la app</Label>
          <Select id="vendedor-usuario" value={form.usuarioId ?? ""} disabled={ocupado}
            onChange={(evento) => cambiar({ usuarioId: Number(evento.target.value) || null })}>
            <option value="">Sin usuario vinculado</option>
            {usuarioAnteriorNoAsignable && (
              <option value={form.usuarioId!} disabled>
                {vendedor?.usuarioNombre ?? "Usuario anterior"} · ya no asignable
              </option>
            )}
            {usuarios.map((usuario) => {
              const dueno = vendedores.find((item) =>
                item.usuarioId === usuario.id && item.id !== vendedor?.id);
              return (
                <option key={usuario.id} value={usuario.id} disabled={!!dueno}>
                  {usuario.nombre} · {usuario.email}{dueno ? " — asignado a " + dueno.nombre : ""}
                </option>
              );
            })}
          </Select>
          <p className="text-xs text-ink-soft">Sólo aparecen usuarios activos con permiso de Planificación.</p>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="size-4 accent-primary" checked={form.activo}
            disabled={ocupado} onChange={(evento) => cambiar({ activo: evento.target.checked })} />
          Vendedor activo
        </label>

        {errores.length > 0 && (
          <div role="alert" className="rounded-md border border-rojo bg-red-50 px-3 py-2 text-sm text-rojo">
            {errores.map((error) => <p key={error}>{error}</p>)}
          </div>
        )}
        {errorServidor && (
          <p role="alert" className="rounded-md border border-rojo bg-red-50 px-3 py-2 text-sm text-rojo">
            {errorServidor}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="outline" onClick={cerrar} disabled={ocupado}>Cancelar</Button>
          <Button type="submit" disabled={ocupado}>
            {ocupado ? "Guardando…" : vendedor ? "Guardar vendedor" : "Guardar configuración"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
