import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/shared/components/error-state";
import { busquedaCatalogoValida, useCatalogo } from "../queries/use-logistica";
import type { Referencia } from "../types";
export function CatalogoSelect({
  tipo,
  titulo,
  value,
  onChange,
  required = true,
  modoFiltro = false,
}: {
  tipo: "clientes" | "productos" | "destinos";
  titulo: string;
  value: number;
  onChange: (codigo: number, referencia?: Referencia) => void;
  required?: boolean;
  modoFiltro?: boolean;
}) {
  const id = useId();
  const [buscar, setBuscar] = useState("");
  const q = useCatalogo(tipo, buscar);
  const filas = q.data?.pages.flatMap((p) => p.filas) ?? [];
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-ink-soft">
        {titulo}
      </label>
      <Input
        aria-label={`Buscar ${titulo.toLowerCase()}`}
        placeholder={tipo === "clientes" ? "Número de cliente o nombre" : "Código o nombre"}
        value={buscar}
        onChange={(e) => setBuscar(e.target.value)}
      />
      <select
        id={id}
        className="h-10 w-full rounded-md border border-line bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-clementina-deep"
        value={value || ""}
        onChange={(e) => {
          const codigo = Number(e.target.value);
          onChange(
            codigo,
            filas.find((f) => f.codigo === codigo),
          );
        }}
        required={required}
      >
        <option value="">{modoFiltro ? "Todos" : `Elegí ${titulo.toLowerCase()}`}</option>
        {value > 0 && !filas.some((f) => f.codigo === value) && (
          <option value={value}>Código {value} seleccionado</option>
        )}
        {filas.map((f) => (
          <option
            key={f.codigo}
            value={f.codigo}
            disabled={!modoFiltro && tipo === "clientes" && f.estado !== "A"}
          >
            {f.nombre ?? "Sin nombre"} ({f.codigo})
          </option>
        ))}
      </select>
      {!busquedaCatalogoValida(buscar) && (
        <p className="text-xs text-ink-soft">Escribí un código positivo o al menos dos letras.</p>
      )}
      {tipo === "clientes" && (
        <p className="text-xs text-ink-soft">
          Buscá por número de cliente o nombre; el número no es el CUIT.
        </p>
      )}
      {q.isLoading && (
        <p role="status" className="text-xs text-ink-soft">
          Consultando catálogo…
        </p>
      )}
      {q.isError && <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      {modoFiltro && (
        <details className="text-xs text-ink-soft">
          <summary className="cursor-pointer">Filtrar por código conocido</summary>
          <label className="mt-2 block">
            Código de {titulo.toLowerCase()} (opcional)
            <Input
              inputMode="numeric"
              pattern="[1-9][0-9]*"
              maxLength={tipo === "clientes" ? 10 : tipo === "productos" ? 6 : 8}
              value={value || ""}
              onChange={(e) => onChange(Number(e.target.value))}
            />
          </label>
        </details>
      )}
      {q.hasNextPage && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={q.isFetchingNextPage}
          onClick={() => void q.fetchNextPage()}
        >
          Más resultados
        </Button>
      )}
    </div>
  );
}
