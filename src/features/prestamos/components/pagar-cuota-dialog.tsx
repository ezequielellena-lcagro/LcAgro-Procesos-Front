import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { toAppError } from "@/lib/api-error";
import { fecha } from "@/shared/format/format";
import { importe } from "../format";
import { usePagarCuota } from "../queries/use-prestamo-mutations";
import type { VencimientoDto } from "../types";

const hoyISO = () => new Date().toISOString().slice(0, 10);

/**
 * Registra el pago de una cuota. En el Excel esto era borrar la fila —y con ella el historial—;
 * acá la cuota queda con su fecha y su importe, que es lo que después permite conciliar contra los
 * débitos bancarios de MacroGest.
 */
export function PagarCuotaDialog({
  cuota,
  onClose,
}: {
  cuota: VencimientoDto | null;
  onClose: () => void;
}) {
  const pagar = usePagarCuota();
  const [fechaPago, setFechaPago] = useState(hoyISO());
  const [importePagado, setImportePagado] = useState("");
  const [observacion, setObservacion] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuota) return;
    try {
      await pagar.mutateAsync({
        cuotaId: cuota.cuotaId,
        fechaPago,
        // Vacío = se pagó el total de la cuota, que es el caso normal.
        importePagado: importePagado.trim() === "" ? null : Number(importePagado.replace(",", ".")),
        observacion: observacion.trim() === "" ? null : observacion.trim(),
      });
      cerrar();
    } catch (err) {
      toast.error(toAppError(err).message);
    }
  };

  const cerrar = () => {
    setFechaPago(hoyISO());
    setImportePagado("");
    setObservacion("");
    onClose();
  };

  return (
    <Modal
      open={cuota !== null}
      onClose={cerrar}
      title={cuota ? `Registrar pago — cuota ${cuota.nroCuota}/${cuota.cantidadCuotas}` : ""}
      className="max-w-md"
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {cuota && (
          <div className="rounded-card border border-line bg-panel-soft p-3 text-sm">
            <div className="font-semibold">
              {cuota.banco} · {cuota.linea}
            </div>
            <div className="text-ink-soft">
              {cuota.nroOperacion ? `Operación ${cuota.nroOperacion} · ` : ""}
              vence {fecha(cuota.fechaVencimiento)}
            </div>
            <div className="mt-1 tabular">
              Capital {importe(cuota.capital)} · Interés {importe(cuota.interes)} · IVA{" "}
              {importe(cuota.iva)} · <strong>Total {importe(cuota.total)}</strong>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="fechaPago">Fecha de pago</Label>
          <DateField id="fechaPago" value={fechaPago} onChange={setFechaPago} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="importePagado">Importe pagado (opcional)</Label>
          <Input
            id="importePagado"
            inputMode="decimal"
            placeholder={cuota ? importe(cuota.total) : ""}
            value={importePagado}
            onChange={(e) => setImportePagado(e.target.value)}
          />
          <p className="text-xs text-ink-soft">
            Si lo dejás vacío se registra el total de la cuota.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="obsPago">Observación (opcional)</Label>
          <Textarea
            id="obsPago"
            rows={2}
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={cerrar} disabled={pagar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="accent" disabled={pagar.isPending}>
            {pagar.isPending ? "Guardando…" : "Registrar pago"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
