import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { numero } from "@/shared/format/format";
import { useGuardarObjetivo } from "../queries/use-volumen-acopiado";
import type { VendedorResumen } from "../types";

/**
 * Acuerda el objetivo de un vendedor. Arranca con el que sugiere el sistema, pero el que vale es el
 * que se acuerda con el gerente comercial: son una propuesta, no metas impuestas.
 */
export function ObjetivoDialog({
  open,
  onClose,
  campania,
  vendedor,
  explicacion,
  notaActual,
}: {
  open: boolean;
  onClose: () => void;
  campania: string;
  vendedor: VendedorResumen;
  explicacion: string;
  notaActual: string | null;
}) {
  const guardar = useGuardarObjetivo();
  const [tn, setTn] = useState(String(vendedor.objetivoAcordado ?? vendedor.objetivoSugerido));
  const [nota, setNota] = useState(notaActual ?? "");

  const valido = tn.trim() !== "" && Number(tn) > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) return;
    guardar.mutate(
      { campania, vendedor: vendedor.vendedor, tnObjetivo: Number(tn), nota: nota.trim() || undefined },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={`Objetivo de ${vendedor.vendedor}`}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-card bg-panel-soft p-3 text-sm text-ink-soft">
          <p>
            Sugerido para la campaña siguiente:{" "}
            <b className="tabular text-ink">{numero(vendedor.objetivoSugerido)} tn</b>
          </p>
          <p className="mt-1 text-xs">{explicacion}</p>
        </div>

        <div>
          <Label htmlFor="obj-tn">Objetivo acordado (tn)</Label>
          <Input
            id="obj-tn"
            type="number"
            min="0"
            step="0.1"
            value={tn}
            onChange={(e) => setTn(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="obj-nota">Nota (opcional)</Label>
          <Textarea
            id="obj-nota"
            rows={3}
            placeholder="Por qué se acordó ese número"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!valido || guardar.isPending}>
            {guardar.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
