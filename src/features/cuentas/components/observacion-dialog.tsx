import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { toAppError } from "@/lib/api-error";
import { useGuardarObservacion } from "../queries/use-guardar-observacion";
import type { CuentaDto } from "../types";

const schema = z.object({
  devolucion: z.string().max(200, "Máximo 200 caracteres."),
  observaciones: z.string().max(1000, "Máximo 1000 caracteres."),
});
type Values = z.infer<typeof schema>;

export function ObservacionDialog({ cuenta, onClose }: { cuenta: CuentaDto | null; onClose: () => void }) {
  const guardar = useGuardarObservacion();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    // `values` (no defaultValues): se resincroniza cuando cambia la cuenta seleccionada.
    values: {
      devolucion: cuenta?.devolucion ?? "",
      observaciones: cuenta?.observaciones ?? "",
    },
  });

  const { errors } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    if (!cuenta) return;
    try {
      await guardar.mutateAsync({
        cuenta: cuenta.cuenta,
        devolucion: v.devolucion.trim() === "" ? null : v.devolucion.trim(),
        observaciones: v.observaciones.trim() === "" ? null : v.observaciones.trim(),
      });
      onClose();
    } catch (err) {
      const e = toAppError(err);
      if (e.fieldErrors) {
        for (const [campo, msgs] of Object.entries(e.fieldErrors)) {
          const name = (campo.charAt(0).toLowerCase() + campo.slice(1)).replace(/\[\d+\]/g, "") as keyof Values;
          form.setError(name, { message: msgs[0] });
        }
      } else {
        toast.error(e.message);
      }
    }
  });

  return (
    <Modal
      open={cuenta !== null}
      onClose={onClose}
      title={cuenta ? `Cuenta ${cuenta.cuenta} · ${cuenta.denominacion}` : ""}
      className="max-w-lg"
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="devolucion">Devolución</Label>
          <Textarea id="devolucion" rows={2} {...form.register("devolucion")} />
          {errors.devolucion && <p className="text-xs text-rojo">{errors.devolucion.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="observaciones">Observaciones</Label>
          <Textarea id="observaciones" rows={4} {...form.register("observaciones")} />
          {errors.observaciones && <p className="text-xs text-rojo">{errors.observaciones.message}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={guardar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="accent" disabled={guardar.isPending}>
            {guardar.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
