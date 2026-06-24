import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toAppError } from "@/lib/api-error";
import {
  CATEGORIAS,
  categoriaValueDesdeLabel,
  type ArticuloMapeoDto,
  type CategoriaValue,
  type MapeoVariedadInput,
} from "../types";

function makeSchema(variedadesSet: Set<string>) {
  return z.object({
    cultivarInase: z
      .string()
      .trim()
      .min(1, "Elegí una variedad.")
      .refine((v) => variedadesSet.has(v), "Esa variedad no está en el maestro INASE."),
    categoria: z.string().refine((v) => CATEGORIAS.some((c) => c.value === v), "Elegí una categoría."),
  });
}
type Values = z.infer<ReturnType<typeof makeSchema>>;

interface Props {
  articulo: ArticuloMapeoDto;
  variedades: string[];
  submitting: boolean;
  onSubmit: (input: MapeoVariedadInput) => Promise<void>;
  onCancel: () => void;
}

export function MapeoForm({ articulo, variedades, submitting, onSubmit, onCancel }: Props) {
  const variedadesSet = useMemo(() => new Set(variedades), [variedades]);
  const form = useForm<Values>({
    resolver: zodResolver(makeSchema(variedadesSet)),
    defaultValues: {
      cultivarInase: articulo.cultivarInase,
      categoria: categoriaValueDesdeLabel(articulo.categoria),
    },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    try {
      await onSubmit({
        cultivo: articulo.cultivo,
        nombreArticulo: articulo.nombreArticulo,
        cultivarInase: v.cultivarInase.trim(),
        categoria: v.categoria as CategoriaValue,
      });
    } catch (err) {
      const e = toAppError(err);
      if (e.fieldErrors) {
        for (const [campo, msgs] of Object.entries(e.fieldErrors)) {
          const name = (campo.charAt(0).toLowerCase() + campo.slice(1)).replace(/\[\d+\]/g, "") as keyof Values;
          form.setError(name, { message: msgs[0] });
        }
      } else {
        // ej.: "La variedad 'X' no existe en el maestro INASE de Trigo."
        form.setError("cultivarInase", { message: e.message });
      }
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-card border border-line bg-panel-soft p-3 text-sm">
        <dt className="text-ink-soft">Artículo</dt>
        <dd className="font-medium text-ink">{articulo.nombreArticulo}</dd>
        <dt className="text-ink-soft">Cultivo</dt>
        <dd className="text-ink">{articulo.cultivo}</dd>
        <dt className="text-ink-soft">Código</dt>
        <dd className="tabular text-ink">{articulo.codigoArticulo}</dd>
      </dl>

      {articulo.esSugerencia && articulo.cultivarInase && (
        <p className="text-xs text-clementina-deep">
          Sugerencia automática precargada — revisala antes de guardar.
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="cultivarInase">Variedad (cultivar INASE)</Label>
        <Controller
          control={form.control}
          name="cultivarInase"
          render={({ field }) => (
            <Combobox
              id="cultivarInase"
              value={field.value}
              onChange={field.onChange}
              options={variedades}
              placeholder="Empezá a escribir para buscar…"
            />
          )}
        />
        {errors.cultivarInase && <p className="text-xs text-rojo">{errors.cultivarInase.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="categoria">Categoría</Label>
        <Select id="categoria" className="w-full" {...form.register("categoria")}>
          <option value="">Elegí una categoría…</option>
          {CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        {errors.categoria && <p className="text-xs text-rojo">{errors.categoria.message}</p>}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Volver
        </Button>
        <Button type="submit" variant="accent" disabled={submitting}>
          {submitting ? "Guardando…" : "Guardar mapeo"}
        </Button>
      </div>
    </form>
  );
}
