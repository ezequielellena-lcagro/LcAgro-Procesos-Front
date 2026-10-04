import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { periodoInicial, campania, fecha, kg } from "../format";
import { useListado } from "../queries/use-logistica";
import type { Preventa, Venta } from "../types";
import { TablaLogistica } from "./tabla-logistica";
import { PeriodoFiltro } from "./periodo-filtro";
export function PreventaPicker({
  selected,
  onSelect,
  filtros,
  paginaContexto,
}: {
  selected: Preventa | null;
  onSelect: (p: Preventa) => void;
  filtros?: { clienteNumero: number; producto: number; campania: number };
  paginaContexto?: object;
}) {
  const [periodo, setPeriodo] = useState(() => periodoInicial(true));
  const [buscar, setBuscar] = useState("");
  const [versionFiltros, setVersionFiltros] = useState(0);
  const q = useListado<Preventa>(
    "preventas",
    { ...periodo, ...filtros, buscar: buscar.trim() || undefined },
    (p) => ({ despuesOperacion: p.operacion, despuesNumero: p.numero }),
    buscar.trim().length !== 1,
    paginaContexto ? { ...paginaContexto, versionFiltros } : undefined,
  );
  return (
    <div className="space-y-3">
      <PeriodoFiltro
        value={periodo}
        onChange={(nuevo) => {
          setPeriodo(nuevo);
          if (paginaContexto) setVersionFiltros((v) => v + 1);
        }}
        etiqueta="Operación de la preventa"
      />
      <Input
        aria-label="Buscar preventa"
        placeholder="Número o nombre del productor"
        value={buscar}
        onChange={(e) => {
          setBuscar(e.target.value);
          if (paginaContexto) setVersionFiltros((v) => v + 1);
        }}
      />
      <TablaLogistica
        titulo="Elegir preventa"
        filas={q.data?.pages.flatMap((p) => p.filas) ?? []}
        clave={(p) => `${p.operacion}/${p.numero}`}
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
              <input
                type="radio"
                aria-label={`Elegir preventa ${p.numero}`}
                checked={selected?.numero === p.numero && selected.operacion === p.operacion}
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
                onChange={() => onSelect(p)}
              />
            ),
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
