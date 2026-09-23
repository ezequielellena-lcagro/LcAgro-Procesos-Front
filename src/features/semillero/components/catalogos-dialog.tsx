import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toAppError } from "@/lib/api-error";
import { DataTable, type Column } from "@/shared/components/data-table";
import {
  type CatalogosSemilleroDto,
  type ClienteCopiaDto,
  type DestinoActualizarInput,
  type DestinoDto,
  type EspecieDto,
  type EspecieSemillero,
  type UbicacionDto,
  type UbicacionInput,
  type VariedadDto,
  type VariedadInput,
} from "../types";
import { ClienteSelect } from "./cliente-select";

interface Props {
  open: boolean;
  onClose: () => void;
  datos: CatalogosSemilleroDto | undefined;
  onGuardarVariedad: (input: VariedadInput & { id?: number }) => Promise<unknown>;
  onGuardarUbicacion: (input: UbicacionInput & { id?: number }) => Promise<unknown>;
  clientes: ClienteCopiaDto[];
  /** Cliente elegido para ver/editar sus destinos (R1.3); el padre mantiene `destinos` al día con `onClienteChange`. */
  clienteElegido: number | null;
  onClienteChange: (clienteNumero: number | null) => void;
  destinos: DestinoDto[];
  cargandoDestinos: boolean;
  onAgregarDestino: (nombre: string) => Promise<DestinoDto>;
  onGuardarDestino: (input: DestinoActualizarInput & { id: number }) => Promise<unknown>;
}

type Solapa = "variedades" | "ubicaciones" | "destinos";

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
 * Catálogos del semillero: variedades y ubicaciones (R1.1/R1.2) y destinos por cliente con alta,
 * renombre y desactivación (R1.3).
 *
 * <p>Va en un diálogo y no en una pestaña de la página: son datos de mantenimiento — se tocan
 * cuando entra una variedad nueva o se estrena una fila del galpón, no todos los días — y como
 * pestaña le robaban lugar a Stock/Órdenes/Movimientos, que es lo que la planta mira siempre.</p>
 *
 * <p>Las tres listas van en solapas y no apiladas: cada una crece por su cuenta (una variedad por
 * híbrido sembrado, una ubicación por fila del galpón) y, una debajo de la otra, para llegar a los
 * destinos había que scrollear todo lo demás. Cada una es una `DataTable` con las mismas columnas,
 * franjas y orden que el resto de la pantalla: lo cargado se lee como una tabla, no como una lista
 * de renglones sueltos.</p>
 */
export function CatalogosDialog({
  open,
  onClose,
  datos,
  onGuardarVariedad,
  onGuardarUbicacion,
  clientes,
  clienteElegido,
  onClienteChange,
  destinos,
  cargandoDestinos,
  onAgregarDestino,
  onGuardarDestino,
}: Props) {
  const [solapa, setSolapa] = useState<Solapa>("variedades");

  return (
    <Modal open={open} onClose={onClose} title="Catálogos" className="max-w-3xl">
      {!datos ? (
        <p className="py-8 text-center text-sm text-ink-soft">Cargando los catálogos…</p>
      ) : (
        <Tabs value={solapa} onValueChange={setSolapa} className="space-y-4">
          <TabsList>
            <TabsTrigger value="variedades">Variedades ({datos.variedades.length})</TabsTrigger>
            <TabsTrigger value="ubicaciones">Ubicaciones ({datos.ubicaciones.length})</TabsTrigger>
            <TabsTrigger value="destinos">Destinos por cliente</TabsTrigger>
          </TabsList>

          <TabsContent value="variedades">
            <Variedades especies={datos.especies ?? []} variedades={datos.variedades} onGuardar={onGuardarVariedad} />
          </TabsContent>

          <TabsContent value="ubicaciones">
            <Ubicaciones ubicaciones={datos.ubicaciones} onGuardar={onGuardarUbicacion} />
          </TabsContent>

          <TabsContent value="destinos">
            <DestinosPorCliente
              clientes={clientes}
              clienteElegido={clienteElegido}
              onClienteChange={onClienteChange}
              destinos={destinos}
              cargando={cargandoDestinos}
              onAgregar={onAgregarDestino}
              onGuardar={onGuardarDestino}
            />
          </TabsContent>
        </Tabs>
      )}
    </Modal>
  );
}

function Variedades({ especies, variedades, onGuardar }: {
  especies: EspecieDto[];
  variedades: VariedadDto[];
  onGuardar: Props["onGuardarVariedad"];
}) {
  const [especie, setEspecie] = useState<EspecieSemillero>("");
  const [nombre, setNombre] = useState("");
  const [renombrando, setRenombrando] = useState<{ id: number; nombre: string } | null>(null);
  const { error, intentar } = useIntento();

  const activas = especies.filter((e) => e.activo);

  const agregar = async () => {
    if (nombre.trim() === "" || especie === "") return;
    if (await intentar(() => onGuardar({ especie, nombre: nombre.trim(), activo: true }))) setNombre("");
  };

  const guardarNombre = (v: VariedadDto, nuevo: string) =>
    void intentar(() => onGuardar({ id: v.id, especie: v.especie, nombre: nuevo.trim(), activo: v.activo })).then(
      (ok) => ok && setRenombrando(null),
    );

  const columnas: Column<VariedadDto>[] = [
    {
      key: "especie",
      header: "Especie",
      sortBy: (v) => v.especie,
      cell: (v) => <span className="text-ink-soft">{v.especie}</span>,
      className: "whitespace-nowrap",
    },
    {
      key: "nombre",
      header: "Variedad",
      sortBy: (v) => v.nombre,
      cell: (v) =>
        renombrando?.id === v.id ? (
          <Input
            aria-label={`Nombre de ${v.nombre}`}
            className="h-8"
            autoFocus
            value={renombrando.nombre}
            onChange={(e) => setRenombrando({ id: v.id, nombre: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && guardarNombre(v, renombrando.nombre)}
          />
        ) : (
          <span className={v.activo ? "font-medium text-ink" : "text-ink-soft line-through"}>{v.nombre}</span>
        ),
    },
    {
      key: "enUso",
      header: "Lotes",
      align: "right",
      sortBy: (v) => v.enUso,
      cell: (v) => <span className="text-ink-soft">{v.enUso}</span>,
      className: "w-16",
    },
    {
      key: "activo",
      header: "Activa",
      align: "center",
      sortBy: (v) => (v.activo ? 0 : 1),
      cell: (v) => (
        <Checkbox
          etiqueta={`${v.nombre} activa`}
          checked={v.activo}
          onChange={() => void intentar(() => onGuardar({ id: v.id, especie: v.especie, nombre: v.nombre, activo: !v.activo }))}
        />
      ),
      className: "w-20",
    },
    {
      key: "acciones",
      header: "",
      align: "right",
      cell: (v) =>
        renombrando?.id === v.id ? (
          <Acciones>
            <Button type="button" size="sm" onClick={() => guardarNombre(v, renombrando.nombre)}>
              Guardar nombre
            </Button>
            <Button type="button" size="sm" variant="ghost" aria-label="Cancelar renombre" onClick={() => setRenombrando(null)}>
              Cancelar
            </Button>
          </Acciones>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Renombrar ${v.nombre}`}
            onClick={() => setRenombrando({ id: v.id, nombre: v.nombre })}
          >
            Renombrar
          </Button>
        ),
      className: "w-52",
    },
  ];

  return (
    <Seccion ayuda="Los híbridos y variedades que aparecen al cargar un lote.">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Especie de la nueva variedad"
          className="w-40"
          value={especie}
          onChange={(e) => setEspecie(e.target.value as EspecieSemillero)}
        >
          <option value="">Elegí especie…</option>
          {activas.map((e) => (
            <option key={e.codigoRubro} value={e.nombre}>
              {e.nombre}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Nueva variedad"
          className="min-w-40 flex-1"
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
      <Aviso mensaje={error} />

      <DataTable
        columns={columnas}
        rows={variedades}
        getRowKey={(v) => v.id}
        defaultSort={{ key: "especie" }}
        empty="Todavía no hay variedades cargadas."
        stickyHeader
        scrollClassName="max-h-80 overflow-y-auto"
      />
    </Seccion>
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

  const columnas: Column<UbicacionDto>[] = [
    {
      key: "codigo",
      header: "Código",
      sortBy: (u) => u.codigo,
      cell: (u) => (
        <span className={u.activo ? "font-semibold text-ink" : "text-ink-soft line-through"}>{u.codigo}</span>
      ),
      className: "w-28 whitespace-nowrap",
    },
    {
      key: "descripcion",
      header: "Descripción",
      sortBy: (u) => u.descripcion,
      cell: (u) => <span className="text-ink-soft">{u.descripcion ?? "—"}</span>,
    },
    {
      key: "enUso",
      header: "Mov.",
      align: "right",
      sortBy: (u) => u.enUso,
      cell: (u) => <span className="text-ink-soft">{u.enUso}</span>,
      className: "w-20",
    },
    {
      key: "activo",
      header: "Activa",
      align: "center",
      sortBy: (u) => (u.activo ? 0 : 1),
      cell: (u) => (
        <Checkbox
          etiqueta={`${u.codigo} activa`}
          checked={u.activo}
          onChange={() =>
            void intentar(() => onGuardar({ id: u.id, codigo: u.codigo, descripcion: u.descripcion, activo: !u.activo }))
          }
        />
      ),
      className: "w-20",
    },
  ];

  return (
    <Seccion ayuda="Dónde está parada cada bolsa: el lugar que se elige al ingresar, reubicar o cargar.">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Nueva ubicación"
          className="w-32"
          value={codigo}
          placeholder="G1-6"
          maxLength={30}
          onChange={(e) => setCodigo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void agregar()}
        />
        <Input
          aria-label="Descripción de la nueva ubicación"
          className="min-w-40 flex-1"
          value={descripcion}
          placeholder="Galpón 1, fila 6"
          maxLength={120}
          onChange={(e) => setDescripcion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void agregar()}
        />
        <Button type="button" variant="accent" onClick={() => void agregar()}>
          Agregar ubicación
        </Button>
      </div>
      <Aviso mensaje={error} />

      <DataTable
        columns={columnas}
        rows={ubicaciones}
        getRowKey={(u) => u.id}
        defaultSort={{ key: "codigo" }}
        empty="Todavía no hay ubicaciones cargadas."
        stickyHeader
        scrollClassName="max-h-80 overflow-y-auto"
      />
    </Seccion>
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
  // campo Cliente dentro de un `Modal`, que no es un portal y puede quedar montado a la vez que este
  // diálogo (mismo riesgo que resolvió `clienteFiltroId` en `ordenes-panel.tsx`).
  const clienteId = useId();
  const [nuevo, setNuevo] = useState("");
  const [renombrando, setRenombrando] = useState<{ id: number; nombre: string } | null>(null);
  const { error, intentar } = useIntento();

  const agregar = async () => {
    const nombre = nuevo.trim();
    if (nombre === "" || clienteElegido === null) return;
    if (await intentar(() => onAgregar(nombre))) setNuevo("");
  };

  const guardarNombre = (d: DestinoDto, nuevoNombre: string) =>
    void intentar(() => onGuardar({ id: d.id, nombre: nuevoNombre.trim(), activo: d.activo })).then(
      (ok) => ok && setRenombrando(null),
    );

  const columnas: Column<DestinoDto>[] = [
    {
      key: "nombre",
      header: "Destino",
      sortBy: (d) => d.nombre,
      cell: (d) =>
        renombrando?.id === d.id ? (
          <Input
            aria-label={`Nombre de ${d.nombre}`}
            className="h-8"
            autoFocus
            value={renombrando.nombre}
            onChange={(e) => setRenombrando({ id: d.id, nombre: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && guardarNombre(d, renombrando.nombre)}
          />
        ) : (
          <span className={d.activo ? "font-medium text-ink" : "text-ink-soft line-through"}>{d.nombre}</span>
        ),
    },
    {
      key: "enUso",
      header: "Órdenes",
      align: "right",
      sortBy: (d) => d.enUso,
      cell: (d) => <span className="text-ink-soft">{d.enUso}</span>,
      className: "w-24",
    },
    {
      key: "activo",
      header: "Activo",
      align: "center",
      sortBy: (d) => (d.activo ? 0 : 1),
      cell: (d) => (
        <Checkbox
          etiqueta={`${d.nombre} activo`}
          checked={d.activo}
          onChange={() => void intentar(() => onGuardar({ id: d.id, nombre: d.nombre, activo: !d.activo }))}
        />
      ),
      className: "w-20",
    },
    {
      key: "acciones",
      header: "",
      align: "right",
      cell: (d) =>
        renombrando?.id === d.id ? (
          <Acciones>
            <Button type="button" size="sm" onClick={() => guardarNombre(d, renombrando.nombre)}>
              Guardar nombre
            </Button>
            <Button type="button" size="sm" variant="ghost" aria-label="Cancelar renombre" onClick={() => setRenombrando(null)}>
              Cancelar
            </Button>
          </Acciones>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Renombrar ${d.nombre}`}
            onClick={() => setRenombrando({ id: d.id, nombre: d.nombre })}
          >
            Renombrar
          </Button>
        ),
      className: "w-52",
    },
  ];

  return (
    <Seccion ayuda="Los campos de cada cliente: es el Destino que se elige en la orden de carga y lo que sale impreso. Se dan de alta desde la orden; acá se corrigen y se dan de baja.">
      <div className="space-y-1">
        <Label htmlFor={clienteId}>Cliente</Label>
        <ClienteSelect id={clienteId} clientes={clientes} value={clienteElegido} onChange={onClienteChange} />
      </div>

      {clienteElegido === null ? (
        <Vacio texto="Elegí un cliente para ver sus destinos." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label="Nuevo destino"
              className="min-w-40 flex-1"
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
          <Aviso mensaje={error} />
          {cargando ? (
            <Vacio texto="Cargando los destinos…" />
          ) : (
            <DataTable
              columns={columnas}
              rows={destinos}
              getRowKey={(d) => d.id}
              defaultSort={{ key: "nombre" }}
              empty="Este cliente todavía no tiene destinos."
              stickyHeader
              scrollClassName="max-h-80 overflow-y-auto"
            />
          )}
        </>
      )}
    </Seccion>
  );
}

function Seccion({ ayuda, children }: { ayuda: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">{ayuda}</p>
      {children}
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="rounded-card border border-dashed border-line py-6 text-center text-sm text-ink-soft">{texto}</p>;
}

function Aviso({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="text-sm text-rojo">
      {mensaje}
    </p>
  );
}

/** Los dos botones del renombre, sin que la fila crezca de alto al entrar en edición. */
function Acciones({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-1">{children}</div>;
}

/** Sin texto al lado: la columna ya se titula "Activa"/"Activo"; el nombre viaja en el `aria-label`. */
function Checkbox({ etiqueta, checked, onChange }: { etiqueta: string; checked: boolean; onChange: () => void }) {
  return (
    <input
      type="checkbox"
      aria-label={etiqueta}
      className="size-4 accent-clementina-deep"
      checked={checked}
      onChange={onChange}
    />
  );
}
