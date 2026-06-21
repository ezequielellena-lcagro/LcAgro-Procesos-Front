import { Pencil, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { fecha } from "@/shared/format/format";
import type { UsuarioDto } from "../types";

export function UsuariosTable({
  filas,
  onEditar,
  onEliminar,
}: {
  filas: UsuarioDto[];
  onEditar: (u: UsuarioDto) => void;
  onEliminar: (u: UsuarioDto) => void;
}) {
  const columns: Column<UsuarioDto>[] = [
    { key: "nombre", header: "Nombre", cell: (r) => <span className="font-medium text-ink">{r.nombre}</span> },
    { key: "email", header: "Email", cell: (r) => <span className="text-ink-soft">{r.email}</span> },
    {
      key: "roles",
      header: "Roles",
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.roles.map((rol) => (
            <span key={rol} className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-ink">
              {rol}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "activo",
      header: "Estado",
      cell: (r) => (
        <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", r.activo ? "text-verde" : "text-ink-soft")}>
          <span className={cn("size-2 rounded-full", r.activo ? "bg-verde" : "bg-ink-soft")} />
          {r.activo ? "Activo" : "Inactivo"}
        </span>
      ),
    },
    { key: "fechaAlta", header: "Alta", cell: (r) => fecha(r.fechaAlta) },
    {
      key: "acciones",
      header: "",
      align: "right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label="Editar" onClick={() => onEditar(r)}>
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Desactivar"
            onClick={() => onEliminar(r)}
            disabled={!r.activo}
          >
            <UserX className="size-4 text-rojo" />
          </Button>
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} rows={filas} getRowKey={(r) => r.id} empty="Sin usuarios." />;
}
