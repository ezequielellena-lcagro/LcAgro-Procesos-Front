import { useRef, useState, type ChangeEvent } from "react";
import { Download, Pencil, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/shared/components/data-table";
import { ErrorState } from "@/shared/components/error-state";
import { Pagination } from "@/shared/components/pagination";
import { useArticulosMapeo } from "../queries/use-articulos-mapeo";
import { useExportarMapeos } from "../queries/use-exportar-mapeos";
import { useImportarMapeos } from "../queries/use-importar-mapeos";
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

const PAGE_SIZE = 10;

/** Vista de lista: artículos con su estado de mapeo. Al elegir uno, el diálogo pasa al editor. */
function ListaArticulos({ onSelect }: { onSelect: (a: ArticuloMapeoDto) => void }) {
  const articulos = useArticulosMapeo();
  const exportar = useExportarMapeos();
  const importar = useImportarMapeos();
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [page, setPage] = useState(1);

  const onArchivo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-seleccionar el mismo archivo
    if (file) importar.mutate(file);
  };

  if (articulos.isError)
    return <ErrorState error={articulos.error} onRetry={() => void articulos.refetch()} />;
  if (articulos.isPending) return <Filas />;

  const filtro = q.trim().toLowerCase();
  const filas = articulos.data.filter((a) => {
    if (soloPendientes && a.mapeado) return false;
    if (filtro && !a.nombreArticulo.toLowerCase().includes(filtro)) return false;
    return true;
  });

  const total = filas.length;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const pageSafe = Math.min(page, totalPages); // tras refetch/filtro la página puede quedar fuera de rango
  const visibles = filas.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

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
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar artículo…"
            className="pl-8"
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-ink">
          <input
            type="checkbox"
            className="size-4 accent-clementina-deep"
            checked={soloPendientes}
            onChange={(e) => {
              setSoloPendientes(e.target.checked);
              setPage(1);
            }}
          />
          Solo sin mapear
        </label>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={onArchivo}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => exportar.mutate()}
            disabled={exportar.isPending}
          >
            <Download className="size-4" /> {exportar.isPending ? "Generando…" : "Plantilla Excel"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={importar.isPending}
          >
            <Upload className="size-4" /> {importar.isPending ? "Importando…" : "Importar"}
          </Button>
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={visibles}
        getRowKey={(a) => a.codigoArticulo}
        empty="No hay artículos con ese filtro."
      />
      {total > PAGE_SIZE && (
        <Pagination page={pageSafe} totalPages={totalPages} total={total} onPage={setPage} />
      )}
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
