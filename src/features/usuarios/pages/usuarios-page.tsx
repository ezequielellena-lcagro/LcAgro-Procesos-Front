import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/shared/components/error-state";
import { PageHeader } from "@/shared/components/page-header";
import { UsuarioDialog } from "../components/usuario-dialog";
import { UsuariosTable } from "../components/usuarios-table";
import { useEliminarUsuario } from "../queries/use-usuario-mutations";
import { useUsuarios } from "../queries/use-usuarios";
import type { UsuarioDto } from "../types";

export function UsuariosPage() {
  const usuarios = useUsuarios();
  const eliminar = useEliminarUsuario();
  const [seleccion, setSeleccion] = useState<UsuarioDto | "new" | null>(null);

  const onEliminar = (u: UsuarioDto) => {
    if (window.confirm(`¿Desactivar a ${u.nombre}?`)) eliminar.mutate(u.id);
  };

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle="Gestión de accesos: roles y estado."
        actions={
          <Button type="button" size="sm" onClick={() => setSeleccion("new")}>
            <Plus className="size-4" /> Nuevo usuario
          </Button>
        }
      />

      {usuarios.isError ? (
        <ErrorState error={usuarios.error} onRetry={() => void usuarios.refetch()} />
      ) : usuarios.isPending ? (
        <div className="space-y-2 rounded-card border border-line bg-panel p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : (
        <UsuariosTable filas={usuarios.data} onEditar={setSeleccion} onEliminar={onEliminar} />
      )}

      <UsuarioDialog usuario={seleccion} onClose={() => setSeleccion(null)} />
    </>
  );
}
