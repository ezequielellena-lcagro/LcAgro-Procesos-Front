import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useGuardarSaldoCuenta } from "../queries/use-produccion-propia";

/**
 * Carga manual del saldo de cuenta corriente del productor 32. El número sale del reporte oficial
 * "Cuenta Corriente de Productores en Kgs": la tabla cruda de MacroGest no lo reproduce porque cuenta
 * el ticket y el certificado que lo agrupa, y duplica.
 */
export function SaldoCuentaDialog({
  open,
  onClose,
  campania,
  cereales,
}: {
  open: boolean;
  onClose: () => void;
  campania: string;
  cereales: string[];
}) {
  const guardar = useGuardarSaldoCuenta();
  const [cereal, setCereal] = useState(cereales[0] ?? "");
  const [tn, setTn] = useState("");
  const [fechaDato, setFechaDato] = useState(() => new Date().toISOString().slice(0, 10));

  const valido = cereal !== "" && tn.trim() !== "" && Number(tn) >= 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) return;
    guardar.mutate(
      { campania, cereal, tn: Number(tn), fechaDato },
      { onSuccess: () => { setTn(""); onClose(); } },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Cargar saldo de cuenta corriente">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-soft">
          Saldo en toneladas del reporte <b>Cuenta Corriente de Productores en Kgs</b> (cuenta 32), para
          la campaña <b>{campania}</b>. Es un saldo acumulado.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pp-cereal">Cereal</Label>
            <Select id="pp-cereal" value={cereal} onChange={(e) => setCereal(e.target.value)}>
              {cereales.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="pp-tn">Toneladas</Label>
            <Input
              id="pp-tn"
              type="number"
              min="0"
              step="0.001"
              value={tn}
              onChange={(e) => setTn(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="pp-fecha">Fecha del saldo</Label>
          <Input
            id="pp-fecha"
            type="date"
            value={fechaDato}
            onChange={(e) => setFechaDato(e.target.value)}
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
