import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterField } from "@/shared/components/filter-bar";
import { periodoInicial, campania, fecha, kg } from "../format";
import { useListado } from "../queries/use-logistica";
import type { Preventa, Venta } from "../types";
import { usePaginacion } from "../lib/paginacion";
import { Paginacion } from "./paginacion";
import { TablaLogistica } from "./tabla-logistica";
import { PeriodoFiltro } from "./periodo-filtro";
export function PreventaPicker({
  selected,
  onSelect,
  filtros,
  paginaContexto,
  busquedaInicial = "",
  bajoFiltros,
  tamano,
}: {
  selected: Preventa | null;
  /** `null` cuando se suelta la preventa elegida. */
  onSelect: (p: Preventa | null) => void;
  filtros?: { clienteNumero: number; producto: number; campania: number };
  paginaContexto?: object;
  /** Búsqueda con la que arranca el listado: abrir con una preventa ya elegida la muestra sola. */
  busquedaInicial?: string;
  /** Bloque propio ENTRE la barra de filtros y la tabla, para no cruzar la grilla antes de él. */
  bajoFiltros?: ReactNode;
  /** Filas por página. En un diálogo conviene chico: la tabla comparte alto con el formulario. */
  tamano?: number;
}) {
  const [periodo, setPeriodo] = useState(() => periodoInicial(true));
  const [buscar, setBuscar] = useState(busquedaInicial);
  const [versionFiltros, setVersionFiltros] = useState(0);
  const q = useListado<Preventa>(
    "preventas",
    { ...periodo, ...filtros, buscar: buscar.trim() || undefined },
    (p) => ({ despuesOperacion: p.operacion, despuesNumero: p.numero }),
    buscar.trim().length !== 1,
    paginaContexto ? { ...paginaContexto, versionFiltros } : undefined,
    tamano,
  );
  const paginacion = usePaginacion(q);
  return (
    <div>
      {/* El período y la búsqueda en la MISMA barra: son los dos filtros del mismo listado. */}
      <PeriodoFiltro
        value={periodo}
        onChange={(nuevo) => {
          setPeriodo(nuevo);
          if (paginaContexto) setVersionFiltros((v) => v + 1);
        }}
        etiqueta="Operación de la preventa"
      >
        <FilterField label="Buscar preventa">
          <Input
            className="min-w-[240px]"
            placeholder="Número o nombre del productor"
            value={buscar}
            onChange={(e) => {
              setBuscar(e.target.value);
              if (paginaContexto) setVersionFiltros((v) => v + 1);
            }}
          />
        </FilterField>
      </PeriodoFiltro>
      {bajoFiltros}
      <TablaLogistica
        titulo="Elegir preventa"
        filas={paginacion.filas}
        clave={(p) => `${p.operacion}/${p.numero}`}
        cargando={q.isLoading}
        error={q.error}
        reintentar={() => void q.refetch()}
        pie={<Paginacion {...paginacion} unidad={{ singular: "preventa", plural: "preventas" }} />}
        columnas={[
          {
            titulo: "Elegir",
            celda: (p) => {
              const elegida = selected?.numero === p.numero && selected.operacion === p.operacion;
              return (
                <input
                  type="radio"
                  className="size-4 accent-primary"
                  aria-label={`Elegir preventa ${p.numero}`}
                  title={elegida ? "Tocalo de nuevo para soltar la preventa" : undefined}
                  checked={elegida}
                  disabled={
                    !p.clienteNumero ||
                    !p.producto ||
                    !p.campania ||
                    p.estado === "A" ||
                    (filtros != null &&
                      (p.clienteNumero !== filtros.clienteNumero ||
                        p.producto !== filtros.producto ||
                        p.campania !== filtros.campania))
                  }
                  // Un radio no se destilda solo. El clic corre ANTES del change, así que acá se
                  // suelta la que ya estaba elegida; sin esto, una vez tocada una preventa no
                  // había cómo volver a un pedido sin preventa salvo recargando.
                  onClick={() => {
                    if (elegida) onSelect(null);
                  }}
                  onChange={() => onSelect(p)}
                />
              );
            },
          },
          {
            titulo: "Preventa",
            celda: (p) => (
              <span>
                {p.operacion} {p.numero}
              </span>
            ),
          },
          {
            titulo: "Productor",
            celda: (p) => p.clienteNombre ?? `Cliente ${p.clienteNumero ?? "sin identificar"}`,
          },
          {
            titulo: "Cereal / campaña",
            celda: (p) =>
              `${p.productoNombre ?? p.producto ?? "Sin cereal"} / ${campania(p.campania)}`,
          },
          {
            titulo: "Entrega",
            celda: (p) => `${fecha(p.fechaEntregaInicio)} — ${fecha(p.fechaEntregaFin)}`,
          },
          { titulo: "Contratado", numero: true, celda: (p) => kg(p.kgContratados) },
        ]}
      />
    </div>
  );
}
export function VentaPicker({
  selected,
  onSelect,
}: {
  selected: Venta | null;
  onSelect: (p: Venta) => void;
}) {
  const [periodo, setPeriodo] = useState(() => periodoInicial(true));
  const [buscar, setBuscar] = useState("");
  const q = useListado<Venta>(
    "contratos",
    { ...periodo, buscar: buscar.trim() || undefined },
    (p) => ({ despuesNumero: p.numero }),
    buscar.trim().length !== 1,
  );
  return (
    <div className="space-y-3">
      <PeriodoFiltro value={periodo} onChange={setPeriodo} etiqueta="Operación del contrato" />
      <Input
        aria-label="Buscar contrato de venta"
        placeholder="Número de contrato o comprador"
        value={buscar}
        onChange={(e) => setBuscar(e.target.value)}
      />
      <TablaLogistica
        titulo="Elegir contrato de venta"
        filas={q.data?.pages.flatMap((p) => p.filas) ?? []}
        clave={(p) => p.numero}
        cargando={q.isLoading}
        error={q.error}
        reintentar={() => void q.refetch()}
        hayMas={q.hasNextPage}
        mas={() => void q.fetchNextPage()}
        cargandoMas={q.isFetchingNextPage}
        columnas={[
          {
            titulo: "Elegir",
            celda: (p) => (
              <Button
                size="sm"
                type="button"
                variant={selected?.numero === p.numero ? "default" : "outline"}
                disabled={!p.producto || !p.campania || p.estado === "A"}
                onClick={() => onSelect(p)}
              >
                Elegir {p.numero}
              </Button>
            ),
          },
          { titulo: "Comprador", celda: (p) => p.compradorNombre ?? "Sin nombre" },
          {
            titulo: "Cereal / campaña",
            celda: (p) =>
              `${p.productoNombre ?? p.producto ?? "Sin cereal"} / ${campania(p.campania)}`,
          },
          {
            titulo: "Destino",
            celda: (p) => p.destinoNombre ?? `Código ${p.destinoCodigo ?? "sin dato"}`,
          },
        ]}
      />
    </div>
  );
}
