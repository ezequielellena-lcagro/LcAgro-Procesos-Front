import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { toAppError } from "@/lib/api-error";
import { usd } from "@/shared/format/format";
import { useCostosArticulo } from "../queries/use-costos-articulo";
import { useGuardarCosto } from "../queries/use-guardar-costo";
import type { ComisionDetalleDto } from "../types";

/** Acepta coma o punto como separador decimal (el usuario tipea en es-AR). */
function aNumero(v: string): number {
  return Number(v.trim().replace(",", "."));
}

const schema = z.object({
  costoUsd: z
    .string()
    .min(1, "Ingresá el costo unitario.")
    .refine((v) => Number.isFinite(aNumero(v)), "Ingresá un número válido.")
    .refine((v) => aNumero(v) >= 0, "El costo no puede ser negativo."),
  nota: z.string().max(300, "Máximo 300 caracteres."),
});
type Values = z.infer<typeof schema>;

/**
 * Corrige a mano el costo unitario de un ARTÍCULO. MacroGest es solo lectura y trae muchos renglones
 * con `precio_costo = 0`; con costo 0 la rentabilidad es el precio entero y la comisión se dispara.
 * La corrección se guarda en nuestra BD y aplica a todos los renglones de ese artículo.
 */
export function CostoDialog({ fila, onClose }: { fila: ComisionDetalleDto | null; onClose: () => void }) {
  const guardar = useGuardarCosto();
  const costos = useCostosArticulo(fila !== null);
  const actual = fila ? costos.data?.find((c) => c.codigoArticulo === fila.codigoArticulo) : undefined;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    // `values` (no defaultValues): se resincroniza cuando cambia el renglón seleccionado y cuando
    // llega la corrección ya cargada del artículo (para no pisarle la nota al guardar de nuevo).
    values: {
      costoUsd: actual ? String(actual.costoUsd) : fila ? String(fila.costoUnitario) : "",
      nota: actual?.nota ?? "",
    },
  });

  const { errors } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    if (!fila) return;
    try {
      await guardar.mutateAsync({
        codigoArticulo: fila.codigoArticulo,
        costoUsd: aNumero(v.costoUsd),
        nota: v.nota.trim() === "" ? null : v.nota.trim(),
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
      open={fila !== null}
      onClose={onClose}
      title={fila ? `Corregir costo — ${fila.producto}` : ""}
      className="max-w-lg"
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="articulo">Artículo</Label>
          <Input id="articulo" readOnly value={fila ? `${fila.codigoArticulo} · ${fila.producto}` : ""} />
          <p className="text-xs text-ink-soft">
            La corrección es por artículo: se aplica a todos sus renglones, en todos los períodos.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="costoUsd">Costo unitario (USD)</Label>
          <Input
            id="costoUsd"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            {...form.register("costoUsd")}
          />
          {errors.costoUsd && <p className="text-xs text-rojo">{errors.costoUsd.message}</p>}
          <p className="text-xs text-ink-soft">
            {fila?.costoCorregido
              ? `Hoy se está usando un costo corregido de ${usd(fila.costoUnitario)}.`
              : `Costo en MacroGest: ${fila ? usd(fila.costoUnitario) : "—"}.`}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nota">Nota (opcional)</Label>
          <Textarea id="nota" rows={3} placeholder="De dónde salió el costo" {...form.register("nota")} />
          {errors.nota && <p className="text-xs text-rojo">{errors.nota.message}</p>}
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
