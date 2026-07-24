import { DataTable, type Column } from "@/shared/components/data-table";
import { numero, usd } from "@/shared/format/format";
import { ComprometidoCelda, DisponibleCelda, PorLlegarCelda } from "./celdas-disponibilidad";
import { EstadoBadge } from "./estado-badge";
import type { StockItem } from "../types";

const COLUMNAS: Column<StockItem>[] = [
  { key: "codigo", header: "Código", cell: (r) => r.codigoArticulo },
  {
    key: "producto",
    header: "Producto",
    className: "max-w-[22rem]",
    cell: (r) => (
      <span className="block truncate font-medium text-ink" title={r.nombreProducto}>
        {r.nombreProducto}
      </span>
    ),
  },
  { key: "rubro", header: "Rubro", cell: (r) => r.rubroDesc },
  { key: "unidad", header: "Un.", cell: (r) => r.unidad },
  { key: "stock", header: "Stock", align: "right", cell: (r) => numero(r.stockActual) },
  { key: "porLlegar", header: "Por llegar", align: "right", cell: (r) => <PorLlegarCelda item={r} /> },
  { key: "comprometido", header: "Comprom.", align: "right", cell: (r) => <ComprometidoCelda item={r} /> },
  {
    key: "disponible",
    header: "Disponible",
    align: "right",
    className: "bg-panel-soft/40",
    cell: (r) => <DisponibleCelda item={r} />,
  },
  { key: "valor", header: "Valor USD", align: "right", cell: (r) => usd(r.valorUsd) },
  { key: "estado", header: "Estado", align: "center", cell: (r) => <EstadoBadge estado={r.estado} /> },
];

/**
 * Stock global: una fila por ARTÍCULO, sumando todos los depósitos (el backend consolida con
 * `consolidado=true`). Acá no hay agrupación por depósito —ese es justo el eje que se colapsa—,
 * así que usa la tabla plana compartida en vez de la jerárquica de la solapa Stock.
 */
export function StockGlobalTable({ filas }: { filas: StockItem[] }) {
  return (
    <DataTable
      columns={COLUMNAS}
      rows={filas}
      getRowKey={(r) => r.codigoArticulo}
      empty="No hay artículos con esos filtros."
    />
  );
}
