import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toAppError } from "@/lib/api-error";
import { ErrorState } from "@/shared/components/error-state";
import { PageHeader } from "@/shared/components/page-header";
import { toast } from "sonner";
import { useConfig, useGuardarConfig } from "../queries/use-config";
import type { ConfigDto } from "../types";

export function ConfigPage() {
  const config = useConfig();
  const guardar = useGuardarConfig();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});

  const valorDe = (c: ConfigDto) => edits[c.clave] ?? c.valor;

  const setValor = (clave: string, v: string) => {
    setEdits((p) => ({ ...p, [clave]: v }));
    setErrores((p) => ({ ...p, [clave]: "" }));
  };

  const validar = (c: ConfigDto, v: string): string => {
    if (c.tipo === "int") return /^-?\d+$/.test(v.trim()) ? "" : "Debe ser un número entero.";
    if (c.tipo === "decimal") return v.trim() !== "" && !Number.isNaN(Number(v)) ? "" : "Debe ser un número.";
    if (c.tipo === "bool") return v === "true" || v === "false" ? "" : "Debe ser verdadero/falso.";
    return "";
  };

  const onGuardar = async () => {
    if (!config.data) return;
    const errs: Record<string, string> = {};
    for (const c of config.data) {
      const e = validar(c, valorDe(c));
      if (e) errs[c.clave] = e;
    }
    setErrores(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      await guardar.mutateAsync(config.data.map((c) => ({ clave: c.clave, valor: valorDe(c).trim() })));
      setEdits({});
    } catch (err) {
      toast.error(toAppError(err).message);
    }
  };

  return (
    <>
      <PageHeader
        title="Configuración"
        subtitle="Parámetros de negocio: campaña mínima, rango de precio, zona y umbral de saldo."
      />

      {config.isError ? (
        <ErrorState error={config.error} onRetry={() => void config.refetch()} />
      ) : config.isPending ? (
        <div className="max-w-2xl space-y-3 rounded-card border border-line bg-panel p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="max-w-2xl space-y-4 rounded-card border border-line bg-panel p-5 shadow-card">
          {config.data.map((c) => (
            <div key={c.clave} className="space-y-1.5">
              <Label htmlFor={c.clave}>
                {c.descripcion ?? c.clave}
                <span className="ml-1.5 text-xs font-normal text-ink-soft">({c.clave})</span>
              </Label>
              {c.tipo === "bool" ? (
                <Select id={c.clave} className="max-w-xs" value={valorDe(c)} onChange={(e) => setValor(c.clave, e.target.value)}>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </Select>
              ) : (
                <Input
                  id={c.clave}
                  type={c.tipo === "int" || c.tipo === "decimal" ? "number" : "text"}
                  className="max-w-xs"
                  value={valorDe(c)}
                  onChange={(e) => setValor(c.clave, e.target.value)}
                />
              )}
              {errores[c.clave] && <p className="text-xs text-rojo">{errores[c.clave]}</p>}
            </div>
          ))}

          <div className="flex justify-end pt-2">
            <Button type="button" variant="accent" onClick={() => void onGuardar()} disabled={guardar.isPending}>
              {guardar.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
