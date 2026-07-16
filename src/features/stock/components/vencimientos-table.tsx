import { DataTable, type Column } from "@/shared/components/data-table";
import { fecha, numero, oDash, usd } from "@/shared/format/format";
import { VencimientoBadge } from "./vencimiento-badge";
import { filasDeVencimiento, type FilaVencimiento } from "../vencimientos";
import type { StockItem } from "../types";

/** "vencido hace 20 d" / "vence hoy" / "60 d". */
function etiquetaDias(dias: number | null): string {
  if (dias === null) return "—";
  if (dias < 0) return `vencido hace ${Math.abs(dias)} d`;
  if (dias === 0) return "vence hoy";
  return `${dias} d`;
}

const COLUMNAS: Column<FilaVencimiento>[] = [
  {
    key: "producto",
    header: "Producto",
    className: "max-w-[18rem]",
    cell: (f) => (
      <span className="block truncate font-medium text-ink" title={f.nombreProducto}>
        {f.nombreProducto}
      </span>
    ),
  },
  { key: "deposito", header: "Depósito", cell: (f) => f.depositoNombre },
  { key: "serie", header: "Lote / serie", cell: (f) => f.serie || "—" },
  { key: "vence", header: "Vencimiento", cell: (f) => oDash(f.fechaVencimiento, fecha) },
  { key: "dias", header: "Días", align: "right", cell: (f) => etiquetaDias(f.diasParaVencer) },
  { key: "unidades", header: "Unidades", align: "right", cell: (f) => numero(f.stockActual) },
  { key: "valor", header: "Valor USD", align: "right", cell: (f) => usd(f.valorUsd) },
  {
    key: "estado",
    header: "Estado",
    align: "center",
    cell: (f) => <VencimientoBadge estado={f.estadoVenc} />,
  },
];

/** Qué hay que vender o dar de baja ya, a nivel lote y ordenado por urgencia. */
export function VencimientosTable({ filas }: { filas: StockItem[] }) {
  return (
    <DataTable
      columns={COLUMNAS}
      rows={filasDeVencimiento(filas)}
      getRowKey={(f) => f.key}
      empty="No hay lotes vencidos ni próximos a vencer con esos filtros."
    />
  );
}
