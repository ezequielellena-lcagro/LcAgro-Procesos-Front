import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CEREALES, type AjusteDto, type SignoAjuste } from "../types";
import { calcularOps, type ArrastreOp, type CeldaArrastre } from "../queries/use-arrastres";

interface Props {
  /** Campaña cuando se edita una fila existente; null = fila nueva (se elige de `campaniasDisponibles`). */
  campaniaFija: string | null;
  campaniasDisponibles: string[];
  existentes: AjusteDto[];
  submitting: boolean;
  onSubmit: (campania: string, ops: ArrastreOp[]) => Promise<void>;
  onCancel: () => void;
}

export function ArrastreForm({ campaniaFija, campaniasDisponibles, existentes, submitting, onSubmit, onCancel }: Props) {
  const [campania, setCampania] = useState(campaniaFija ?? campaniasDisponibles[0] ?? "");
  const [celdas, setCeldas] = useState<Record<string, { tn: string; signo: SignoAjuste }>>(() => {
    const init: Record<string, { tn: string; signo: SignoAjuste }> = {};
    for (const cer of CEREALES) {
      const ex = existentes.find((e) => e.cereal === cer);
      init[cer] = { tn: ex ? String(ex.tn) : "", signo: ex?.signo ?? "+" };
    }
    return init;
  });
  const [error, setError] = useState<string | null>(null);

  const setCelda = (cereal: string, patch: Partial<{ tn: string; signo: SignoAjuste }>) =>
    setCeldas((prev) => ({ ...prev, [cereal]: { ...prev[cereal], ...patch } }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!campania) {
      setError("Elegí una campaña.");
      return;
    }
    // 0 y vacío son válidos: significan "este cereal no arrastra" (girasol/sorgo normalmente no tienen).
    // Solo se rechaza lo que no es número o es negativo (el sentido lo da el Signo, no el menos).
    for (const cer of CEREALES) {
      const v = celdas[cer].tn.trim();
      if (v !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0)) {
        setError(`Toneladas inválidas en ${cer}: poné un número ≥ 0 (o dejalo vacío).`);
        return;
      }
    }

    const celdasArr: CeldaArrastre[] = CEREALES.map((cer) => ({ cereal: cer, tn: celdas[cer].tn, signo: celdas[cer].signo }));
    const ops = calcularOps(existentes, celdasArr);
    await onSubmit(campania, ops);
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="arr-campania">Campaña</Label>
        {campaniaFija ? (
          <p className="font-medium text-ink">{campaniaFija}</p>
        ) : campaniasDisponibles.length > 0 ? (
          <Select id="arr-campania" className="w-48" value={campania} onChange={(e) => setCampania(e.target.value)}>
            {campaniasDisponibles.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        ) : (
          <p className="text-sm text-ink-soft">Todas las campañas ya tienen una fila de arrastre.</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="py-2 pr-2 font-semibold">Cereal</th>
              <th className="py-2 pr-2 font-semibold">Toneladas</th>
              <th className="py-2 font-semibold">Signo</th>
            </tr>
          </thead>
          <tbody>
            {CEREALES.map((cer) => (
              <tr key={cer} className="border-b border-line-soft last:border-0">
                <td className="py-1.5 pr-2 font-medium text-ink">{cer}</td>
                <td className="py-1.5 pr-2">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    inputMode="decimal"
                    className="w-32"
                    placeholder="—"
                    aria-label={`Toneladas ${cer}`}
                    value={celdas[cer].tn}
                    onChange={(e) => setCelda(cer, { tn: e.target.value })}
                  />
                </td>
                <td className="py-1.5">
                  <Select
                    className="w-28"
                    aria-label={`Signo ${cer}`}
                    value={celdas[cer].signo}
                    onChange={(e) => setCelda(cer, { signo: e.target.value as SignoAjuste })}
                  >
                    <option value="+">+ (suma)</option>
                    <option value="-">− (resta)</option>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-soft">
        Dejá una celda vacía (o en 0) para que ese cereal no arrastre. El arrastre de las campañas siguientes se
        calcula solo.
      </p>

      {error && <p className="text-sm text-rojo">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" disabled={submitting || (!campaniaFija && campaniasDisponibles.length === 0)}>
          {submitting ? "Guardando…" : "Guardar arrastre"}
        </Button>
      </div>
    </form>
  );
}
