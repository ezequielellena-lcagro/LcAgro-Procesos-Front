import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ErrorState } from "@/shared/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useEnviarSeguimiento, useSeguimiento } from "../queries/use-volumen-acopiado";

/**
 * Previsualiza el mail de seguimiento y recién ahí lo envía. Los vendedores no entran al portal: este
 * mail es todo lo que ven, y una vez enviado no se puede deshacer — por eso se muestra el destinatario
 * y el cuerpo exacto antes de confirmar.
 */
export function SeguimientoDialog({
  open,
  onClose,
  vendedor,
  campania,
}: {
  open: boolean;
  onClose: () => void;
  vendedor: string;
  campania: string;
}) {
  const previa = useSeguimiento(open ? vendedor : undefined, campania);
  const enviar = useEnviarSeguimiento();
  const [confirmando, setConfirmando] = useState(false);

  function enviarAhora() {
    if (!previa.data?.email) return;
    enviar.mutate(
      { vendedor, campania, email: previa.data.email },
      {
        onSuccess: () => {
          toast.success(`Seguimiento enviado a ${previa.data!.email}`);
          setConfirmando(false);
          onClose();
        },
      },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={`Seguimiento de ${vendedor}`} className="max-w-3xl">
      {previa.isError ? (
        <ErrorState error={previa.error} onRetry={() => void previa.refetch()} />
      ) : !previa.data ? (
        <Skeleton className="h-64 w-full rounded-card" />
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-soft">Para</dt>
            <dd className="text-ink">
              {previa.data.email ?? (
                <span className="text-rojo">
                  Sin email cargado — cargalo en Cuentas para poder enviarle.
                </span>
              )}
              {previa.data.email && (
                <span className="ml-2 text-xs text-ink-soft">
                  ({previa.data.origenEmail === "propia" ? "cargado en la app" : "de MacroGest"})
                </span>
              )}
            </dd>
            <dt className="text-ink-soft">Asunto</dt>
            <dd className="text-ink">{previa.data.asunto}</dd>
          </dl>

          {previa.data.dormidosListados > 0 && (
            <p className="rounded-card bg-panel-soft px-3 py-2 text-xs text-ink-soft">
              El mail lista <b>{previa.data.dormidosListados}</b> clientes para recuperar. Revisá que
              ninguno esté en una situación delicada antes de enviarlo.
            </p>
          )}

          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-ink-soft">Vista previa</p>
            <div
              className="max-h-80 overflow-y-auto rounded-card border border-line bg-white p-4"
              // El cuerpo lo genera el backend a partir de datos de MacroGest, con el texto escapado.
              dangerouslySetInnerHTML={{ __html: previa.data.cuerpoHtml }}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            {confirmando ? (
              <>
                <span className="text-sm text-ink-soft">¿Enviar a {previa.data.email}?</span>
                <Button type="button" onClick={enviarAhora} disabled={enviar.isPending}>
                  {enviar.isPending ? "Enviando…" : "Sí, enviar"}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={() => setConfirmando(true)}
                disabled={!previa.data.enviable}
              >
                Enviar seguimiento
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
