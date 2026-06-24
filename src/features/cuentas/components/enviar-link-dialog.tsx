import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useEnviarLink, useGuardarContacto, useVendedores } from "../queries/use-enviar-link";

interface EnviarLinkDialogProps {
  open: boolean;
  onClose: () => void;
}

const ORIGEN_HINT: Record<string, string> = {
  propia: "Email guardado en el sistema.",
  macrogest: "Email tomado de MacroGest. Editalo y guardá si querés conservarlo.",
  sin: "Este vendedor no tiene email cargado. Escribilo y guardá.",
};

export function EnviarLinkDialog({ open, onClose }: EnviarLinkDialogProps) {
  const [vendNro, setVendNro] = useState<number | null>(null);
  // null = sin editar (mostramos el email resuelto del vendedor); string = lo editó el usuario.
  const [emailEditado, setEmailEditado] = useState<string | null>(null);

  const vendedores = useVendedores(open);
  const guardarContacto = useGuardarContacto();
  const enviarLink = useEnviarLink();

  const seleccionado = vendedores.data?.find((v) => v.vendNro === vendNro) ?? null;
  const email = emailEditado ?? seleccionado?.email ?? "";

  const reset = () => {
    setVendNro(null);
    setEmailEditado(null);
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const onSelectVendedor = (value: string) => {
    setVendNro(value ? Number(value) : null);
    setEmailEditado(null); // mostrar el email resuelto del nuevo vendedor
  };

  const puedeOperar = vendNro !== null && email.trim().length > 0;
  const ocupado = guardarContacto.isPending || enviarLink.isPending;

  const handleGuardar = () => {
    if (!puedeOperar) return;
    guardarContacto.mutate(
      { vendNro: vendNro!, email: email.trim() },
      { onSuccess: () => setEmailEditado(null) }, // queda reflejado el guardado (origen "propia")
    );
  };

  const handleEnviar = () => {
    if (!puedeOperar) return;
    enviarLink.mutate({ vendNro: vendNro!, email: email.trim() }, { onSuccess: handleClose });
  };

  return (
    <Modal open={open} onClose={handleClose} title="Enviar link de devolución" className="max-w-md">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="vendedor-link">Vendedor</Label>
          <Select
            id="vendedor-link"
            className="w-full"
            value={vendNro ?? ""}
            onChange={(e) => onSelectVendedor(e.target.value)}
            disabled={vendedores.isPending}
          >
            <option value="">{vendedores.isPending ? "Cargando vendedores…" : "Elegí un vendedor…"}</option>
            {vendedores.data?.map((v) => (
              <option key={v.vendNro} value={v.vendNro}>
                {v.vendedor}
                {v.origen === "sin" ? " — (sin email)" : ""}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email-link">Email del vendedor</Label>
          <Input
            id="email-link"
            type="email"
            value={email}
            onChange={(e) => setEmailEditado(e.target.value)}
            placeholder="vendedor@ejemplo.com"
            disabled={vendNro === null}
          />
          {seleccionado && (
            <p className="text-xs text-ink-soft">{ORIGEN_HINT[seleccionado.origen]}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={handleClose} disabled={ocupado}>
            Cancelar
          </Button>
          <Button type="button" variant="outline" onClick={handleGuardar} disabled={!puedeOperar || ocupado}>
            {guardarContacto.isPending ? "Guardando…" : "Guardar email"}
          </Button>
          <Button type="button" variant="accent" onClick={handleEnviar} disabled={!puedeOperar || ocupado}>
            {enviarLink.isPending ? "Enviando…" : "Enviar link"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
