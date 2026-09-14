import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toAppError } from "@/lib/api-error";
import {
  ESPECIES,
  type CatalogosSemilleroDto,
  type ClienteCopiaDto,
  type DestinoActualizarInput,
  type DestinoDto,
  type EspecieSemillero,
  type EstadoCopiaClientesDto,
  type UbicacionDto,
  type UbicacionInput,
  type VariedadDto,
  type VariedadInput,
} from "../types";
import { ClienteSelect } from "./cliente-select";
import { CopiaClientesAviso } from "./copia-clientes-aviso";

interface Props {
  datos: CatalogosSemilleroDto | undefined;
  onGuardarVariedad: (input: VariedadInput & { id?: number }) => Promise<unknown>;
  onGuardarUbicacion: (input: UbicacionInput & { id?: number }) => Promise<unknown>;
  clientes: ClienteCopiaDto[];
  copiaClientes: EstadoCopiaClientesDto;
  actualizandoClientes: boolean;
  onActualizarClientes: () => void;
  /** Cliente elegido para ver/editar sus destinos (R1.3); el padre mantiene `destinos` al día con `onClienteChange`. */
  clienteElegido: number | null;
  onClienteChange: (clienteNumero: number | null) => void;
  destinos: DestinoDto[];
  cargandoDestinos: boolean;
  onAgregarDestino: (nombre: string) => Promise<DestinoDto>;
  onGuardarDestino: (input: DestinoActualizarInput & { id: number }) => Promise<unknown>;
}

/** Envuelve una escritura y deja el mensaje del servidor a la vista (duplicados, especie/cliente en uso). */
function useIntento() {
  const [error, setError] = useState<string | null>(null);
  const intentar = async (accion: () => Promise<unknown>): Promise<boolean> => {
    setError(null);
    try {
      await accion();
      return true;
    } catch (err) {
      setError(toAppError(err).message);
      return false;
    }
  };
  return { error, intentar };
}

/**
 * Pestaña Catálogos: variedades y ubicaciones (R1.1/R1.2), destinos por cliente con alta, renombre y
 * desactivación (R1.3), y el estado de la copia local de clientes con su refresco manual (R2.3),
 * embebiendo `CopiaClientesAviso` (F5).
 */
export function CatalogosPanel({
  datos,
  onGuardarVariedad,
  onGuardarUbicacion,
  clientes,
  copiaClientes,
  actualizandoClientes,
  onActualizarClientes,
  clienteElegido,
  onClienteChange,
  destinos,
  cargandoDestinos,
  onAgregarDestino,
  onGuardarDestino,
}: Props) {
  if (!datos) return <p className="py-8 text-center text-ink-soft">Cargando los catálogos…</p>;
  return (
    <div className="space-y-4">
      <CopiaClientesAviso estado={copiaClientes} onActualizar={onActualizarClientes} actualizando={actualizandoClientes} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Variedades variedades={datos.variedades} onGuardar={onGuardarVariedad} />
        <Ubicaciones ubicaciones={datos.ubicaciones} onGuardar={onGuardarUbicacion} />
        <DestinosPorCliente
          clientes={clientes}
          clienteElegido={clienteElegido}
          onClienteChange={onClienteChange}
          destinos={destinos}
          cargando={cargandoDestinos}
          onAgregar={onAgregarDestino}
          onGuardar={onGuardarDestino}
        />
      </div>
    </div>
  );
}

function Variedades({ variedades, onGuardar }: { variedades: VariedadDto[]; onGuardar: Props["onGuardarVariedad"] }) {
  const [especie, setEspecie] = useState<EspecieSemillero>("Soja");
  const [nombre, setNombre] = useState("");
  const [renombrando, setRenombrando] = useState<{ id: number; nombre: string } | null>(null);
  const { error, intentar } = useIntento();

  const agregar = async () => {
    if (nombre.trim() === "") return;
    if (await intentar(() => onGuardar({ especie, nombre: nombre.trim(), activo: true }))) setNombre("");
  };

  return (
    <Tarjeta titulo="Variedades">
      <div className="flex gap-2">
        <Select
          aria-label="Especie de la nueva variedad"
          className="w-32"
          value={especie}
          onChange={(e) => setEspecie(e.target.value as EspecieSemillero)}
        >
          {ESPECIES.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.etiqueta}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Nueva variedad"
          value={nombre}
          placeholder="DM 46E25"
          maxLength={80}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void agregar()}
        />
        <Button type="button" variant="accent" onClick={() => void agregar()}>
          Agregar variedad
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-rojo">
          {error}
        </p>
      )}
      {ESPECIES.map((e) => (
        <div key={e.valor}>
          <h4 className="mb-1 mt-3 text-xs font-semibold uppercase text-ink-soft">{e.etiqueta}</h4>
          <ul className="divide-y divide-line-soft">
            {variedades
              .filter((v) => v.especie === e.valor)
              .map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-1.5 text-sm">
                  {renombrando?.id === v.id ? (
                    <>
                      <Input
                        aria-label={`Nombre de ${v.nombre}`}
                        className="h-8"
                        value={renombrando.nombre}
                        onChange={(ev) => setRenombrando({ id: v.id, nombre: ev.target.value })}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          void intentar(() =>
                            onGuardar({ id: v.id, especie: v.especie, nombre: renombrando.nombre.trim(), activo: v.activo }),
                          ).then((ok) => ok && setRenombrando(null))
                        }
                      >
                        Guardar nombre
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className={v.activo ? "flex-1 text-ink" : "flex-1 text-ink-soft line-through"}>{v.nombre}</span>
                      <span className="text-xs text-ink-soft">
                        {v.enUso} {v.enUso === 1 ? "lote" : "lotes"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Renombrar ${v.nombre}`}
                        onClick={() => setRenombrando({ id: v.id, nombre: v.nombre })}
                      >
                        Renombrar
                      </Button>
                    </>
                  )}
                  <label className="flex items-center gap-1 text-xs text-ink-soft">
                    <input
                      type="checkbox"
                      aria-label={`${v.nombre} activa`}
                      className="size-4 accent-clementina-deep"
                      checked={v.activo}
                      onChange={() => void intentar(() => onGuardar({ id: v.id, especie: v.especie, nombre: v.nombre, activo: !v.activo }))}
                    />
                    Activa
                  </label>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </Tarjeta>
  );
}

function Ubicaciones({ ubicaciones, onGuardar }: { ubicaciones: UbicacionDto[]; onGuardar: Props["onGuardarUbicacion"] }) {
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const { error, intentar } = useIntento();

  const agregar = async () => {
    if (codigo.trim() === "") return;
    const ok = await intentar(() =>
      onGuardar({ codigo: codigo.trim(), descripcion: descripcion.trim() === "" ? null : descripcion.trim(), activo: true }),
    );
    if (ok) {
      setCodigo("");
      setDescripcion("");
    }
  };

  return (
    <Tarjeta titulo="Ubicaciones del galpón">
      <div className="flex gap-2">
        <Input aria-label="Nueva ubicación" className="w-32" value={codigo} placeholder="G1-6" maxLength={30} onChange={(e) => setCodigo(e.target.value)} />
        <Input
          aria-label="Descripción de la nueva ubicación"
          value={descripcion}
          placeholder="Galpón 1, fila 6"
          maxLength={120}
          onChange={(e) => setDescripcion(e.target.value)}
        />
        <Button type="button" variant="accent" onClick={() => void agregar()}>
          Agregar ubicación
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-rojo">
          {error}
        </p>
      )}
      <ul className="mt-3 divide-y divide-line-soft">
        {ubicaciones.map((u) => (
          <li key={u.id} className="flex items-center gap-3 py-1.5 text-sm">
            <span className={u.activo ? "w-24 font-semibold text-ink" : "w-24 text-ink-soft line-through"}>{u.codigo}</span>
            <span className="flex-1 text-ink-soft">{u.descripcion ?? ""}</span>
            <span className="text-xs text-ink-soft">{u.enUso} mov.</span>
            <label className="flex items-center gap-1 text-xs text-ink-soft">
              <input
                type="checkbox"
                aria-label={`${u.codigo} activa`}
                className="size-4 accent-clementina-deep"
                checked={u.activo}
                onChange={() => void intentar(() => onGuardar({ id: u.id, codigo: u.codigo, descripcion: u.descripcion, activo: !u.activo }))}
              />
              Activa
            </label>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

function DestinosPorCliente({
  clientes,
  clienteElegido,
  onClienteChange,
  destinos,
  cargando,
  onAgregar,
  onGuardar,
}: {
  clientes: ClienteCopiaDto[];
  clienteElegido: number | null;
  onClienteChange: (clienteNumero: number | null) => void;
  destinos: DestinoDto[];
  cargando: boolean;
  onAgregar: Props["onAgregarDestino"];
  onGuardar: Props["onGuardarDestino"];
}) {
  // Id propio (no `"clienteNumero"`): ese id ya lo usan `OrdenDialog`/`LoteDialog` para su propio
  // campo Cliente dentro de un `Modal`, que no es un portal y puede quedar montado a la vez que esta
  // pestaña (mismo riesgo que resolvió `clienteFiltroId` en `ordenes-panel.tsx`).
  const clienteId = useId();
  const [nuevo, setNuevo] = useState("");
  const [renombrando, setRenombrando] = useState<{ id: number; nombre: string } | null>(null);
  const { error, intentar } = useIntento();

  const agregar = async () => {
    const nombre = nuevo.trim();
    if (nombre === "" || clienteElegido === null) return;
    if (await intentar(() => onAgregar(nombre))) setNuevo("");
  };

  return (
    <Tarjeta titulo="Destinos por cliente">
      <div className="space-y-1">
        <Label htmlFor={clienteId}>Cliente</Label>
        <ClienteSelect id={clienteId} clientes={clientes} value={clienteElegido} onChange={onClienteChange} />
      </div>

      {clienteElegido === null ? (
        <p className="py-4 text-center text-sm text-ink-soft">Elegí un cliente para ver sus destinos.</p>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            <Input
              aria-label="Nuevo destino"
              value={nuevo}
              placeholder="Campo El Roble"
              maxLength={120}
              onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void agregar()}
            />
            <Button type="button" variant="accent" onClick={() => void agregar()}>
              Agregar destino
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-rojo">
              {error}
            </p>
          )}
          {cargando ? (
            <p className="py-4 text-center text-sm text-ink-soft">Cargando los destinos…</p>
          ) : destinos.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-soft">Este cliente todavía no tiene destinos.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line-soft">
              {destinos.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-1.5 text-sm">
                  {renombrando?.id === d.id ? (
                    <>
                      <Input
                        aria-label={`Nombre de ${d.nombre}`}
                        className="h-8"
                        value={renombrando.nombre}
                        onChange={(ev) => setRenombrando({ id: d.id, nombre: ev.target.value })}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          void intentar(() => onGuardar({ id: d.id, nombre: renombrando.nombre.trim(), activo: d.activo })).then(
                            (ok) => ok && setRenombrando(null),
                          )
                        }
                      >
                        Guardar nombre
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className={d.activo ? "flex-1 text-ink" : "flex-1 text-ink-soft line-through"}>{d.nombre}</span>
                      <span className="text-xs text-ink-soft">
                        {d.enUso} {d.enUso === 1 ? "orden" : "órdenes"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Renombrar ${d.nombre}`}
                        onClick={() => setRenombrando({ id: d.id, nombre: d.nombre })}
                      >
                        Renombrar
                      </Button>
                    </>
                  )}
                  <label className="flex items-center gap-1 text-xs text-ink-soft">
                    <input
                      type="checkbox"
                      aria-label={`${d.nombre} activo`}
                      className="size-4 accent-clementina-deep"
                      checked={d.activo}
                      onChange={() => void intentar(() => onGuardar({ id: d.id, nombre: d.nombre, activo: !d.activo }))}
                    />
                    Activo
                  </label>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Tarjeta>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-card border border-line bg-panel p-4 shadow-card">
      <h3 className="font-display text-base font-semibold text-ink">{titulo}</h3>
      {children}
    </section>
  );
}
