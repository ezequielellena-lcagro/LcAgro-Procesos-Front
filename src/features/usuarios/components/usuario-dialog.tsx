import { Modal } from "@/components/ui/modal";
import { useRoles } from "../queries/use-usuarios";
import { useCrearUsuario, useEditarUsuario } from "../queries/use-usuario-mutations";
import type { UsuarioDto } from "../types";
import { UsuarioForm, type UsuarioFormValues } from "./usuario-form";

export function UsuarioDialog({
  usuario,
  onClose,
}: {
  usuario: UsuarioDto | "new" | null;
  onClose: () => void;
}) {
  const roles = useRoles();
  const crear = useCrearUsuario();
  const editar = useEditarUsuario();

  const open = usuario !== null;
  const edit = usuario === "new" || usuario === null ? null : usuario;

  const onSubmit = async (v: UsuarioFormValues) => {
    if (edit) {
      await editar.mutateAsync({
        id: edit.id,
        input: {
          nombre: v.nombre,
          email: v.email,
          activo: v.activo,
          password: v.password || null,
          roles: v.roles,
        },
      });
    } else {
      await crear.mutateAsync({ nombre: v.nombre, email: v.email, password: v.password, roles: v.roles });
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={edit ? `Editar · ${edit.nombre}` : "Nuevo usuario"} className="max-w-lg">
      {open && (
        <UsuarioForm
          key={edit?.id ?? "new"}
          edit={edit}
          rolesDisponibles={roles.data ?? []}
          submitting={crear.isPending || editar.isPending}
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}
