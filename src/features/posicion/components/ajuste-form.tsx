import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toAppError } from "@/lib/api-error";
import { CEREALES, TIPOS_AJUSTE, type AjusteDto, type AjusteInput } from "../types";

const schema = z.object({
  cereal: z.enum(CEREALES),
  tipo: z.enum(["arrastre", "semilla", "canje", "produccion_propia"]),
  signo: z.enum(["+", "-"]),
  tn: z.string().min(1, "Ingresá las toneladas.").refine((v) => Number(v) > 0, "Las toneladas deben ser mayores a 0."),
  precioUsd: z.string().refine((v) => v.trim() === "" || Number(v) >= 0, "Precio inválido."),
  nota: z.string().max(500, "Máximo 500 caracteres."),
});
type Values = z.infer<typeof schema>;

interface Props {
  campania: string;
  edit: AjusteDto | null;
  submitting: boolean;
  onSubmit: (input: AjusteInput) => Promise<void>;
  onCancel: () => void;
}

export function AjusteForm({ campania, edit, submitting, onSubmit, onCancel }: Props) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      cereal: edit && (CEREALES as readonly string[]).includes(edit.cereal) ? (edit.cereal as Values["cereal"]) : "Soja",
      tipo: edit?.tipo ?? "arrastre",
      signo: edit?.signo ?? "+",
      tn: edit ? String(edit.tn) : "",
      precioUsd: edit?.precioUsd != null ? String(edit.precioUsd) : "",
      nota: edit?.nota ?? "",
    },
  });

  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const input: AjusteInput = {
      campania,
      cereal: values.cereal,
      tipo: values.tipo,
      signo: values.signo,
      tn: Number(values.tn),
      precioUsd: values.precioUsd.trim() === "" ? null : Number(values.precioUsd),
      nota: values.nota.trim() === "" ? null : values.nota.trim(),
    };
    try {
      await onSubmit(input);
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
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="text-sm text-ink-soft">
        Campaña <b className="text-ink">{campania}</b>
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cereal">Cereal</Label>
          <Select id="cereal" className="w-full" {...form.register("cereal")}>
            {CEREALES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          {errors.cereal && <p className="text-xs text-rojo">{errors.cereal.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tipo">Tipo</Label>
          <Select id="tipo" className="w-full" {...form.register("tipo")}>
            {TIPOS_AJUSTE.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          {errors.tipo && <p className="text-xs text-rojo">{errors.tipo.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signo">Signo</Label>
          <Select id="signo" className="w-full" {...form.register("signo")}>
            <option value="+">+ (suma)</option>
            <option value="-">− (resta)</option>
          </Select>
          {errors.signo && <p className="text-xs text-rojo">{errors.signo.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tn">Toneladas</Label>
          <Input id="tn" type="number" step="0.01" inputMode="decimal" {...form.register("tn")} />
          {errors.tn && <p className="text-xs text-rojo">{errors.tn.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="precioUsd">Precio USD (opcional)</Label>
          <Input id="precioUsd" type="number" step="0.01" inputMode="decimal" {...form.register("precioUsd")} />
          {errors.precioUsd && <p className="text-xs text-rojo">{errors.precioUsd.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nota">Nota (opcional)</Label>
        <Textarea id="nota" rows={2} {...form.register("nota")} />
        {errors.nota && <p className="text-xs text-rojo">{errors.nota.message}</p>}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" disabled={submitting}>
          {submitting ? "Guardando…" : edit ? "Guardar cambios" : "Crear ajuste"}
        </Button>
      </div>
    </form>
  );
}
