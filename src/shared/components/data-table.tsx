import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string | number;
  empty?: ReactNode;
}

function alignCls(a?: "left" | "right" | "center") {
  return a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";
}

export function DataTable<T>({ columns, rows, getRowKey, empty }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-panel shadow-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-panel-soft text-xs uppercase tracking-wide text-ink-soft">
            {columns.map((c) => (
              <th key={c.key} className={cn("px-3.5 py-2.5 font-semibold", alignCls(c.align), c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3.5 py-10 text-center text-ink-soft">
                {empty ?? "Sin datos."}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={getRowKey(row, i)} className="border-b border-line-soft last:border-0 hover:bg-panel-soft/60">
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3.5 py-2.5 tabular", alignCls(c.align), c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
