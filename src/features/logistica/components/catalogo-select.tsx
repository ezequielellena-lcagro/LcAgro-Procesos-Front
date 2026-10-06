import { useId, useMemo, useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/shared/components/error-state";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { busquedaCatalogoValida, useCatalogo } from "../queries/use-logistica";
import type { Referencia } from "../types";

const TODOS = "Todos";

/** Etiqueta única de una fila del catálogo: el código entra para poder buscarla por número. */
function etiqueta(r: Referencia) {
  return `${r.nombre ?? "Sin nombre"} (${r.codigo})`;
}

/**
 * Elección de un cliente, producto o destino del catálogo de MacroGest.
 *
 * Es UN campo: se escribe y se elige en el mismo lugar, como en Semilla Fiscalizada y Semillero.
 * Antes eran dos cajas — un buscador arriba y un desplegable abajo — más un botón "Más
 * resultados" suelto al costado; nadie podía saber que lo que se tipeaba en la primera llenaba la
 * segunda, y el botón no decía de qué resultados hablaba.
 *
 * <p>El catálogo NO está en memoria: son miles de clientes y se buscan contra el servidor, que
 * matchea por nombre o por número. Por eso el filtrado local del combo se apaga (escondería
 * resultados que el servidor sí considera válidos) y lo tipeado va con freno de 300 ms: sin eso
 * cada tecla sería una consulta contra la base de producción.</p>
 */
export function CatalogoSelect({
  tipo,
  titulo,
  value,
  onChange,
  required = true,
  modoFiltro = false,
  className,
}: {
  tipo: "clientes" | "productos" | "destinos";
  titulo: string;
  value: number;
  onChange: (codigo: number, referencia?: Referencia) => void;
  required?: boolean;
  modoFiltro?: boolean;
  /**
   * Ancho del campo. En un formulario (una columna) no hace falta: ocupa todo el ancho. En una
   * `FilterBar` sí, porque ahí los campos van uno al lado del otro y sin ancho propio el flex se
   * los reparte a lo ancho de la pantalla. Con `modoFiltro` el campo mide lo mismo que cualquier
   * otro de la barra (rótulo + control), así que NO hace falta `self-start`: alineados por abajo
   * como el resto, los controles quedan todos a la misma altura.
   */
  className?: string;
}) {
  const id = useId();
  const [buscar, setBuscar] = useState("");
  const q = useCatalogo(tipo, useDebounce(buscar, 300));
  const filas = useMemo(() => q.data?.pages.flatMap((p) => p.filas) ?? [], [q.data]);

  const elegibles = modoFiltro
    ? filas
    : filas.filter((f) => !(tipo === "clientes" && f.estado !== "A"));
  const porEtiqueta = useMemo(() => new Map(elegibles.map((f) => [etiqueta(f), f])), [elegibles]);

  // El elegido puede no estar en la página que se trajo (se eligió antes, o se buscó otra cosa):
  // igual tiene que poder leerse en el campo, así que se agrega a mano.
  const fijada = filas.find((f) => f.codigo === value);
  const actual = value > 0 ? (fijada ? etiqueta(fijada) : `Código ${value} seleccionado`) : "";

  // Tipear un número vale como elegirlo aunque el catálogo no lo devuelva: con el ERP caído la
  // operación propia tiene que seguir consultándose por un código que ya se conoce. El combo sólo
  // confirma lo que se ELIGE de la lista, así que ese código entra como una opción más.
  const codigoTipeado = /^\d+$/.test(buscar.trim()) ? Number(buscar.trim()) : 0;
  // Sólo donde no se puede confirmar contra el catálogo: filtrando, o con el catálogo caído. En un
  // alta con catálogo sano el servidor ya busca por código, y ofrecer uno inexistente sería hacer
  // elegir algo que el backend va a rechazar.
  const porCodigo =
    codigoTipeado > 0 &&
    (modoFiltro || q.isError) &&
    !elegibles.some((f) => f.codigo === codigoTipeado)
      ? `Código ${codigoTipeado}`
      : null;
  const opciones = [
    ...(modoFiltro ? [TODOS] : []),
    ...(actual && !porEtiqueta.has(actual) ? [actual] : []),
    ...(porCodigo ? [porCodigo] : []),
    ...porEtiqueta.keys(),
  ];

  // En un formulario la ayuda se lee debajo del campo. En una barra de filtros no: sería el único
  // campo más alto que los demás y escalonaría toda la fila, así que ahí va como título del rótulo.
  const ayuda =
    tipo === "clientes"
      ? "Buscá por número de cliente o nombre; el número no es el CUIT."
      : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        title={modoFiltro ? ayuda : undefined}
        className="block text-xs font-medium text-ink-soft"
      >
        {titulo}
      </label>
      <Combobox
        id={id}
        value={actual}
        options={opciones}
        filtrarLocal={false}
        required={required && !modoFiltro}
        placeholder={
          modoFiltro
            ? TODOS
            : tipo === "clientes"
              ? "Número de cliente o nombre"
              : "Código o nombre"
        }
        vacio={
          !busquedaCatalogoValida(buscar)
            ? "Escribí un código positivo o al menos dos letras."
            : q.isLoading
              ? "Consultando catálogo…"
              : "Sin coincidencias."
        }
        onQueryChange={setBuscar}
        onChange={(texto) => {
          const fila = porEtiqueta.get(texto);
          if (fila) onChange(fila.codigo, fila);
          else if (texto === TODOS) onChange(0);
          else if (porCodigo && texto === porCodigo) onChange(codigoTipeado);
        }}
        pie={
          q.hasNextPage ? (
            <button
              type="button"
              className="text-clementina-deep hover:underline disabled:opacity-50"
              disabled={q.isFetchingNextPage}
              // onMouseDown y no onClick: el click lo come el cierre por foco del combo.
              onMouseDown={(e) => {
                e.preventDefault();
                void q.fetchNextPage();
              }}
            >
              {q.isFetchingNextPage
                ? "Trayendo más…"
                : `Ver más ${titulo.toLowerCase()} del catálogo`}
            </button>
          ) : undefined
        }
      />
      {ayuda && !modoFiltro && <p className="text-[11px] text-ink-soft">{ayuda}</p>}
      {q.isError && <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
    </div>
  );
}
