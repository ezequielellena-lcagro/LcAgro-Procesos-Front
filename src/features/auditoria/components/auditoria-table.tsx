import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import type { AuditDto } from "../types";

const accionTone: Record<string, string> = {
  Create: "bg-verde-bg text-verde",
  Update: "bg-panel-soft text-clementina-deep",
  Delete: "bg-rojo-bg text-rojo",
};

export function AuditoriaTable({ filas, onVer }: { filas: AuditDto[]; onVer: (a: AuditDto) => void }) {
  const columns: Column<AuditDto>[] = [
    { key: "fecha", header: "Fecha", cell: (r) => <span className="text-ink-soft">{new Date(r.fecha).toLocaleString("es-AR")}</span> },
    { key: "usuario", header: "Usuario", cell: (r) => (r.usuarioId == null ? "Sistema" : `#${r.usuarioId}`) },
    {
      key: "accion",
      header: "Acción",
      cell: (r) => (
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", accionTone[r.accion] ?? "bg-secondary text-ink")}>
          {r.accion}
        </span>
      ),
    },
    {
      key: "entidad",
      header: "Entidad",
      cell: (r) => (
        <span className="font-medium text-ink">
          {r.entidad}
          {r.entidadId ? ` #${r.entidadId}` : ""}
        </span>
      ),
    },
    { key: "ip", header: "IP", cell: (r) => r.ip ?? "—" },
    {
      key: "datos",
      header: "",
      align: "right",
      cell: (r) =>
        r.datos ? (
          <Button type="button" variant="ghost" size="icon" aria-label="Ver datos" onClick={() => onVer(r)}>
            <Eye className="size-4" />
          </Button>
        ) : null,
    },
  ];

  return <DataTable columns={columns} rows={filas} getRowKey={(r) => r.id} empty="Sin registros en el rango." />;
}
