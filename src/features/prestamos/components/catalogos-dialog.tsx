import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  AdministrarCatalogos,
  CatalogoAdminDto,
  CatalogoInput,
  CatalogoTipo,
} from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  datos?: AdministrarCatalogos;
  cargando: boolean;
  onCrear: (tipo: CatalogoTipo, input: CatalogoInput) => void;
  onActualizar: (tipo: CatalogoTipo, id: number, input: CatalogoInput) => void;
  onEliminar: (tipo: CatalogoTipo, id: number) => void;
  guardando: boolean;
}

/**
 * Administración de bancos y líneas de crédito.
 *
 * <p>Cada proveedor nuevo con financiación trae una línea nueva: hasta ahora eso pedía una
 * migración y un deploy, y por eso terminaban cargándose "parecidas" en el Excel.</p>
 *
 * <p>Las dos listas van en solapas y no una debajo de la otra: son largas (una línea por proveedor
 * con financiación) y, apiladas, para llegar a los bancos había que scrollear todas las líneas.</p>
 *
 * <p>La baja de lo que está en uso es <b>desactivar</b>, no borrar: los préstamos que ya lo tienen
 * lo siguen mostrando. Por eso cada fila dice a cuántos préstamos afecta antes de tocar nada.</p>
 */
export function CatalogosDialog({
  open,
  onClose,
  datos,
  cargando,
  onCrear,
  onActualizar,
  onEliminar,
  guardando,
}: Props) {
  const [aBorrar, setABorrar] = useState<{ tipo: CatalogoTipo; item: CatalogoAdminDto } | null>(null);
  const [solapa, setSolapa] = useState<CatalogoTipo>("lineas");

  return (
    <>
      <Modal open={open} onClose={onClose} title="Bancos y líneas de crédito">
        {cargando || !datos ? (
          <p className="py-8 text-center text-sm text-ink-soft">Cargando…</p>
        ) : (
          <Tabs value={solapa} onValueChange={setSolapa} className="space-y-4">
            <TabsList>
              <TabsTrigger value="lineas">Líneas de crédito ({datos.lineas.length})</TabsTrigger>
              <TabsTrigger value="bancos">Bancos ({datos.bancos.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="lineas">
              <Seccion
                ayuda="Las que aparecen al cargar un préstamo. Las de financiación de proveedor llevan IVA."
                tipo="lineas"
                items={datos.lineas}
                conFinanciacion
                etiquetaNuevo="Nueva línea"
                etiquetaAgregar="Agregar línea"
                onCrear={onCrear}
                onActualizar={onActualizar}
                onPedirBorrar={(item) => setABorrar({ tipo: "lineas", item })}
                guardando={guardando}
              />
            </TabsContent>

            <TabsContent value="bancos">
              <Seccion
                ayuda="Con quién está tomada la operación."
                tipo="bancos"
                items={datos.bancos}
                etiquetaNuevo="Nuevo banco"
                etiquetaAgregar="Agregar banco"
                onCrear={onCrear}
                onActualizar={onActualizar}
                onPedirBorrar={(item) => setABorrar({ tipo: "bancos", item })}
                guardando={guardando}
              />
            </TabsContent>
          </Tabs>
        )}
      </Modal>

      <Modal
        open={aBorrar !== null}
        onClose={() => setABorrar(null)}
        title="Eliminar"
        className="max-w-md"
      >
        <p className="text-sm text-ink">
          Se elimina <strong>{aBorrar?.item.nombre}</strong> del catálogo. No lo usa ningún préstamo,
          así que no se pierde nada; si en algún momento vuelve, se carga de nuevo.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setABorrar(null)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={guardando}
            onClick={() => {
              if (aBorrar) onEliminar(aBorrar.tipo, aBorrar.item.id);
              setABorrar(null);
            }}
          >
            Eliminar
          </Button>
        </div>
      </Modal>
    </>
  );
}

function Seccion({
  ayuda,
  tipo,
  items,
  conFinanciacion = false,
  etiquetaNuevo,
  etiquetaAgregar,
  onCrear,
  onActualizar,
  onPedirBorrar,
  guardando,
}: {
  ayuda: string;
  tipo: CatalogoTipo;
  items: CatalogoAdminDto[];
  conFinanciacion?: boolean;
  etiquetaNuevo: string;
  etiquetaAgregar: string;
  onCrear: Props["onCrear"];
  onActualizar: Props["onActualizar"];
  onPedirBorrar: (item: CatalogoAdminDto) => void;
  guardando: boolean;
}) {
  const [nuevo, setNuevo] = useState("");
  const [nuevoEsFinanciacion, setNuevoEsFinanciacion] = useState(false);

  const agregar = () => {
    const nombre = nuevo.trim();
    if (nombre === "") return;
    onCrear(tipo, { nombre, esFinanciacionProveedor: nuevoEsFinanciacion, activo: true });
    setNuevo("");
    setNuevoEsFinanciacion(false);
  };

  return (
    <section>
      {/* El título lo dice la solapa; acá queda sólo la aclaración de qué va en la lista. */}
      <p className="text-xs text-ink-soft">{ayuda}</p>

      <div className="mt-3 divide-y divide-line-soft rounded-md border border-line-soft">
        {items.map((item, i) => (
          <FilaCatalogo
            key={item.id}
            item={item}
            tipo={tipo}
            conFinanciacion={conFinanciacion}
            franja={i % 2 === 1}
            onActualizar={onActualizar}
            onPedirBorrar={onPedirBorrar}
            guardando={guardando}
          />
        ))}

        <div className="flex items-center gap-2 bg-panel-soft/60 p-2">
          <Input
            aria-label={etiquetaNuevo}
            placeholder={etiquetaNuevo}
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            // Enter agrega: se cargan varias seguidas y no tiene sentido ir al botón cada vez.
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregar();
              }
            }}
            className="h-9 flex-1"
          />
          {conFinanciacion && (
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-soft">
              <input
                type="checkbox"
                checked={nuevoEsFinanciacion}
                onChange={(e) => setNuevoEsFinanciacion(e.target.checked)}
                className="size-3.5 accent-clementina"
              />
              Proveedor
            </label>
          )}
          <Button size="sm" onClick={agregar} disabled={guardando}>
            <Plus className="mr-1 size-3.5" />
            {etiquetaAgregar}
          </Button>
        </div>
      </div>
    </section>
  );
}

function FilaCatalogo({
  item,
  tipo,
  conFinanciacion,
  franja,
  onActualizar,
  onPedirBorrar,
  guardando,
}: {
  item: CatalogoAdminDto;
  tipo: CatalogoTipo;
  conFinanciacion: boolean;
  franja: boolean;
  onActualizar: Props["onActualizar"];
  onPedirBorrar: (item: CatalogoAdminDto) => void;
  guardando: boolean;
}) {
  const [nombre, setNombre] = useState(item.nombre);
  const [esFinanciacion, setEsFinanciacion] = useState(item.esFinanciacionProveedor);

  const cambio = nombre.trim() !== item.nombre || esFinanciacion !== item.esFinanciacionProveedor;
  const enUso = item.enUso > 0;

  const guardar = () => {
    if (nombre.trim() === "") return;
    onActualizar(tipo, item.id, {
      nombre: nombre.trim(),
      esFinanciacionProveedor: esFinanciacion,
      activo: item.activo,
    });
  };

  // El activo no pasa por "Guardar": es la baja de verdad y tiene que ser un solo clic.
  const alternarActivo = (activo: boolean) =>
    onActualizar(tipo, item.id, {
      nombre: nombre.trim() || item.nombre,
      esFinanciacionProveedor: esFinanciacion,
      activo,
    });

  return (
    <div
      data-fila
      className={cn("flex items-center gap-2 p-2", franja && "bg-line-soft/45", !item.activo && "opacity-60")}
    >
      <Input
        aria-label={`Nombre de ${item.nombre}`}
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && cambio) {
            e.preventDefault();
            guardar();
          }
        }}
        className="h-9 flex-1"
      />

      {conFinanciacion && (
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-soft">
          <input
            type="checkbox"
            aria-label={`Financiación de proveedor en ${item.nombre}`}
            checked={esFinanciacion}
            onChange={(e) => setEsFinanciacion(e.target.checked)}
            className="size-3.5 accent-clementina"
          />
          Proveedor
        </label>
      )}

      <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-soft">
        <input
          type="checkbox"
          aria-label={`Activa ${item.nombre}`}
          checked={item.activo}
          onChange={(e) => alternarActivo(e.target.checked)}
          className="size-3.5 accent-clementina"
        />
        Activa
      </label>

      {/* Cuántos préstamos la usan: es el dato que decide si se puede borrar o sólo desactivar. */}
      <span
        title={enUso ? `${item.enUso} préstamo(s) la usan` : "No la usa ningún préstamo"}
        className={cn(
          "w-7 shrink-0 rounded-md py-0.5 text-center text-xs tabular",
          enUso ? "bg-clementina/25 text-ink" : "text-ink-soft",
        )}
      >
        {item.enUso}
      </span>

      {cambio ? (
        <Button size="sm" variant="outline" onClick={guardar} disabled={guardando}>
          Guardar
        </Button>
      ) : (
        <span className="w-[4.5rem]" aria-hidden />
      )}

      <button
        type="button"
        aria-label={`Eliminar ${item.nombre}`}
        disabled={enUso || guardando}
        title={
          enUso
            ? `La usan ${item.enUso} préstamo(s): se puede desactivar, pero no borrar.`
            : "Eliminar del catálogo"
        }
        onClick={() => onPedirBorrar(item)}
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-md text-ink-soft",
          "hover:bg-destructive/10 hover:text-destructive",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-soft",
        )}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
