import { useState } from "react";
import { Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/shared/components/data-table";
import { ErrorState } from "@/shared/components/error-state";
import { useArticulosMapeo } from "../queries/use-articulos-mapeo";
import { useGuardarMapeo } from "../queries/use-mapeo-mutations";
import { useVariedades } from "../queries/use-variedades";
import type { ArticuloMapeoDto, MapeoVariedadInput } from "../types";
import { MapeoForm } from "./mapeo-form";

function EstadoBadge({ a }: { a: ArticuloMapeoDto }) {
  const cls = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  if (a.mapeado) return <span className={`${cls} bg-verde-bg text-verde`}>Mapeado</span>;
  if (a.cultivarInase) return <span className={`${cls} bg-clementina/20 text-clementina-deep`}>Sugerido</span>;
  return <span className={`${cls} bg-rojo-bg text-rojo`}>Sin sugerencia</span>;
}

function Filas({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

/** Vista de lista: artículos con su estado de mapeo. Al elegir uno, el diálogo pasa al editor. */
function ListaArticulos({ onSelect }: { onSelect: (a: ArticuloMapeoDto) => void }) {
  const articulos = useArticulosMapeo();
  const [q, setQ] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(false);

  if (articulos.isError)
    return <ErrorState error={articulos.error} onRetry={() => void articulos.refetch()} />;
  if (articulos.isPending) return <Filas />;

  const filtro = q.trim().toLowerCase();
  const filas = articulos.data.filter((a) => {
    if (soloPendientes && a.mapeado) return false;
    if (filtro && !a.nombreArticulo.toLowerCase().includes(filtro)) return false;
    return true;
  });

  const columns: Column<ArticuloMapeoDto>[] = [
    {
      key: "articulo",
      header: "Artículo",
      cell: (a) => <span className="font-medium text-ink">{a.nombreArticulo}</span>,
    },
    { key: "cultivo", header: "Cultivo", cell: (a) => a.cultivo },
    {
      key: "variedad",
      header: "Variedad",
      cell: (a) => a.cultivarInase || <span className="text-ink-soft">—</span>,
    },
    {
      key: "categoria",
      header: "Categoría",
      cell: (a) => a.categoria || <span className="text-ink-soft">—</span>,
    },
    { key: "estado", header: "Estado", cell: (a) => <EstadoBadge a={a} /> },
    {
      key: "accion",
      header: "",
      align: "right",
      cell: (a) => (
        <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(a)}>
          <Pencil className="size-4" /> {a.mapeado ? "Editar" : "Mapear"}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar artículo…"
            className="pl-8"
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-ink">
          <input
            type="checkbox"
            className="size-4 accent-clementina-deep"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
          />
          Solo sin mapear
        </label>
      </div>
      <DataTable
        columns={columns}
        rows={filas}
        getRowKey={(a) => a.codigoArticulo}
        empty="No hay artículos con ese filtro."
      />
    </div>
  );
}

/** Carga los cultivares del cultivo del artículo y renderiza el form de edición. */
function MapeoEditor({ articulo, onDone }: { articulo: ArticuloMapeoDto; onDone: () => void }) {
  const variedades = useVariedades(articulo.cultivo);
  const guardar = useGuardarMapeo();

  if (variedades.isError)
    return <ErrorState error={variedades.error} onRetry={() => void variedades.refetch()} />;
  if (variedades.isPending) return <Filas rows={4} />;

  return (
    <MapeoForm
      articulo={articulo}
      variedades={variedades.data}
      submitting={guardar.isPending}
      onSubmit={async (input: MapeoVariedadInput) => {
        await guardar.mutateAsync({ codigoArticulo: articulo.codigoArticulo, input });
        onDone();
      }}
      onCancel={onDone}
    />
  );
}

/**
 * Diálogo de curación del mapeo de variedades. Funciona como wizard de dos vistas dentro del mismo
 * modal: lista de artículos → editor del artículo elegido (sin modales anidados).
 */
export function MapeosDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sel, setSel] = useState<ArticuloMapeoDto | null>(null);

  // Al cerrar, volvé a la lista para la próxima apertura (sin efectos: reseteamos en el cierre).
  const cerrar = () => {
    setSel(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title={sel ? `Mapear · ${sel.nombreArticulo}` : "Mapeo de variedades"}
      className="max-w-3xl"
    >
      {open &&
        (sel ? (
          <MapeoEditor articulo={sel} onDone={() => setSel(null)} />
        ) : (
          <ListaArticulos onSelect={setSel} />
        ))}
    </Modal>
  );
}
