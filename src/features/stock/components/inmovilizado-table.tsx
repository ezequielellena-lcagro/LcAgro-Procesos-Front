import { DataTable, type Column } from "@/shared/components/data-table";
import { numero, oDash, usd } from "@/shared/format/format";
import { RotacionBadge } from "./rotacion-badge";
import type { StockItem } from "../types";

const COLUMNAS: Column<StockItem>[] = [
  {
    key: "producto",
    header: "Producto",
    className: "max-w-[18rem]",
    cell: (r) => (
      <span className="block truncate font-medium text-ink" title={r.nombreProducto}>
        {r.nombreProducto}
      </span>
    ),
  },
  { key: "deposito", header: "Depósito", cell: (r) => r.depositoNombre },
  { key: "rubro", header: "Rubro", cell: (r) => r.rubroDesc },
  { key: "stock", header: "Stock", align: "right", cell: (r) => numero(r.stockActual) },
  {
    key: "antiguedad",
    header: "Días en stock",
    align: "right",
    cell: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <span className="tabular text-ink-soft">{oDash(r.diasEnStockPromedio, (d) => `${d} d`)}</span>
        <RotacionBadge semaforo={r.semaforoRotacion} />
      </span>
    ),
  },
  { key: "cobertura", header: "Días cob.", align: "right", cell: (r) => r.diasCobertura ?? "—" },
  { key: "ventaDiaria", header: "Venta diaria", align: "right", cell: (r) => numero(r.ventaDiaria) },
  { key: "valor", header: "Valor USD", align: "right", cell: (r) => usd(r.valorUsd) },
];

/** Dónde está la plata parada: artículo × depósito sin rotación, ordenado por valor (lo ordena el backend). */
export function InmovilizadoTable({ filas }: { filas: StockItem[] }) {
  return (
    <DataTable
      columns={COLUMNAS}
      rows={filas}
      getRowKey={(r) => `${r.deposito}-${r.codigoArticulo}`}
      empty="No hay artículos inmovilizados con esos filtros."
    />
  );
}
