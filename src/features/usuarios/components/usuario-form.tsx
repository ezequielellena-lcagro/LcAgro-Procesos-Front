import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toAppError } from "@/lib/api-error";
import type { UsuarioDto } from "../types";

function makeSchema(esNuevo: boolean) {
  return z.object({
    nombre: z.string().min(1, "Ingresá el nombre."),
    email: z.email("Email inválido."),
    password: z
      .string()
      .refine(
        (v) => (esNuevo ? v.length >= 6 : v === "" || v.length >= 6),
        esNuevo ? "Mínimo 6 caracteres." : "Mínimo 6 caracteres (vacío = no cambiar).",
      ),
    activo: z.boolean(),
    roles: z.array(z.string()).min(1, "Asigná al menos un rol."),
  });
}
export type UsuarioFormValues = z.infer<ReturnType<typeof makeSchema>>;

interface Props {
  edit: UsuarioDto | null;
  rolesDisponibles: string[];
  submitting: boolean;
  onSubmit: (values: UsuarioFormValues) => Promise<void>;
  onCancel: () => void;
}

export function UsuarioForm({ edit, rolesDisponibles, submitting, onSubmit, onCancel }: Props) {
  const esNuevo = !edit;
  const form = useForm<UsuarioFormValues>({
    resolver: zodResolver(makeSchema(esNuevo)),
    defaultValues: {
      nombre: edit?.nombre ?? "",
      email: edit?.email ?? "",
      password: "",
      activo: edit?.activo ?? true,
      roles: edit?.roles ?? [],
    },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (err) {
      const e = toAppError(err);
      if (e.fieldErrors) {
        for (const [campo, msgs] of Object.entries(e.fieldErrors)) {
          const name = (campo.charAt(0).toLowerCase() + campo.slice(1)).replace(/\[\d+\]/g, "") as keyof UsuarioFormValues;
          form.setError(name, { message: msgs[0] });
        }
      } else {
        toast.error(e.message);
      }
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" {...form.register("nombre")} />
          {errors.nombre && <p className="text-xs text-rojo">{errors.nombre.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="off" {...form.register("email")} />
          {errors.email && <p className="text-xs text-rojo">{errors.email.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{esNuevo ? "Contraseña" : "Nueva contraseña (opcional)"}</Label>
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
        {errors.password && <p className="text-xs text-rojo">{errors.password.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Roles</Label>
        <div className="flex flex-wrap gap-3">
          {rolesDisponibles.map((rol) => (
            <label key={rol} className="flex items-center gap-1.5 text-sm text-ink">
              <input type="checkbox" value={rol} className="size-4 accent-clementina-deep" {...form.register("roles")} />
              {rol}
            </label>
          ))}
        </div>
        {errors.roles && <p className="text-xs text-rojo">{errors.roles.message}</p>}
      </div>

      {!esNuevo && (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="size-4 accent-clementina-deep" {...form.register("activo")} />
          Usuario activo
        </label>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" disabled={submitting}>
          {submitting ? "Guardando…" : esNuevo ? "Crear usuario" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
