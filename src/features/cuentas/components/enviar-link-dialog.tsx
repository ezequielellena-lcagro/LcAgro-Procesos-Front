import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useEnviarLink, useResolverContacto } from "../queries/use-enviar-link";

interface EnviarLinkDialogProps {
  /** Cuando es null el dialog está cerrado. */
  vendNro: number | null;
  vendedor: string;
  onClose: () => void;
}

export function EnviarLinkDialog({ vendNro, vendedor, onClose }: EnviarLinkDialogProps) {
  // email editado por el usuario; se rellena desde onSuccess de resolverContacto.
  const [email, setEmail] = useState("");

  const resolverContacto = useResolverContacto();
  const enviarLink = useEnviarLink();

  const resolverMutate = resolverContacto.mutate;

  // Disparar la resolución del contacto cuando se abre el dialog.
  // El setState NO se llama directamente en el efecto: se pasa como callback de onSuccess.
  useEffect(() => {
    if (vendNro === null) return;
    resolverMutate(vendNro, {
      onSuccess: (data) => setEmail(data.email ?? ""),
    });
  }, [vendNro, resolverMutate]);

  const handleClose = () => {
    setEmail("");
    onClose();
  };

  const handleEnviar = () => {
    if (vendNro === null || !email.trim()) return;
    enviarLink.mutate(
      { vendNro, email: email.trim() },
      { onSuccess: handleClose },
    );
  };

  const isPending = resolverContacto.isPending || enviarLink.isPending;

  return (
    <Modal
      open={vendNro !== null}
      onClose={handleClose}
      title={`Enviar link de devolución a ${vendedor}`}
      className="max-w-md"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email-link">Email del vendedor</Label>
          <Input
            id="email-link"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vendedor@ejemplo.com"
            disabled={resolverContacto.isPending}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={handleEnviar}
            disabled={isPending || !email.trim()}
          >
            {enviarLink.isPending ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
