import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { ErrorState } from "@/shared/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useEnviarSeguimiento,
  useGuardarContactoVendedor,
  useSeguimiento,
} from "../queries/use-volumen-acopiado";

/** De dónde salió el email que se está mostrando. Mismos textos que el envío de link de cuentas. */
const ORIGEN_HINT: Record<string, string> = {
  propia: "Email guardado en el sistema. Sirve también para el link de cuentas corrientes.",
  macrogest:
    "Email tomado de MacroGest (suele ser el de la oficina, no el del vendedor). Corregilo y guardá.",
  sin: "Este vendedor no tiene email cargado. Escribilo y guardá.",
};

/**
 * Previsualiza el mail de seguimiento y recién ahí lo envía. Los vendedores no entran al portal: este
 * mail es todo lo que ven, y una vez enviado no se puede deshacer — por eso se muestra el destinatario
 * y el cuerpo exacto antes de confirmar.
 * <p>
 * El destinatario es editable: el de MacroGest suele ser el de la oficina. Lo que se guarda acá es el
 * contacto ÚNICO del vendedor, el mismo que usa el link de devolución de cuentas corrientes.
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
  const guardarContacto = useGuardarContactoVendedor();
  // Lo tipeado se guarda junto al vendedor al que corresponde: si se cambia de vendedor vuelve a valer
  // el email que resolvió el backend, sin necesidad de resetear nada.
  const [edicion, setEdicion] = useState<{ vendedor: string; email: string } | null>(null);
  // El envío se confirma para UN destinatario: si se edita el email hay que volver a confirmar.
  const [confirmandoPara, setConfirmandoPara] = useState<string | null>(null);

  const emailEditado = edicion?.vendedor === vendedor ? edicion.email : null;
  const email = (emailEditado ?? previa.data?.email ?? "").trim();
  const emailValido = email.length > 2 && email.includes("@");
  const confirmando = confirmandoPara !== null && confirmandoPara === email;
  // Sin código de viajante no hay dónde guardar el contacto (vendedor fuera del padrón de MacroGest).
  const puedeGuardar = (previa.data?.vendNro ?? 0) > 0 && emailValido;
  const ocupado = enviar.isPending || guardarContacto.isPending;

  function handleClose() {
    setEdicion(null);
    setConfirmandoPara(null);
    onClose();
  }

  function guardarAhora() {
    if (!puedeGuardar) return;
    guardarContacto.mutate(
      { vendNro: previa.data!.vendNro, email },
      { onSuccess: () => setEdicion(null) }, // queda el email resuelto, ya con origen "propia"
    );
  }

  function enviarAhora() {
    if (!emailValido) return;
    enviar.mutate(
      { vendedor, campania, email },
      {
        onSuccess: () => {
          toast.success(`Seguimiento enviado a ${email}`);
          handleClose();
        },
      },
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Seguimiento de ${vendedor}`} className="max-w-3xl">
      {previa.isError ? (
        <ErrorState error={previa.error} onRetry={() => void previa.refetch()} />
      ) : !previa.data ? (
        <Skeleton className="h-64 w-full rounded-card" />
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email-seguimiento">Email del vendedor</Label>
            <Input
              id="email-seguimiento"
              type="email"
              value={emailEditado ?? previa.data.email ?? ""}
              onChange={(e) => setEdicion({ vendedor, email: e.target.value })}
              placeholder="vendedor@ejemplo.com"
            />
            <p className="text-xs text-ink-soft">
              {previa.data.vendNro > 0
                ? ORIGEN_HINT[previa.data.origenEmail]
                : "Este vendedor no figura en el padrón de viajantes de MacroGest: se puede enviar, pero el email no queda guardado."}
            </p>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
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

          <div className="space-y-2">
            {/* El destinatario se repite acá: es lo último que se lee antes de mandar algo irreversible. */}
            {confirmando && (
              <p className="text-right text-sm text-ink-soft">
                ¿Enviar a <b className="text-ink">{email}</b>?
              </p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={ocupado}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={guardarAhora}
                disabled={!puedeGuardar || ocupado}
              >
                {guardarContacto.isPending ? "Guardando…" : "Guardar email"}
              </Button>
              {confirmando ? (
                <Button type="button" onClick={enviarAhora} disabled={ocupado}>
                  {enviar.isPending ? "Enviando…" : "Sí, enviar"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => setConfirmandoPara(email)}
                  disabled={!emailValido || ocupado}
                >
                  Enviar seguimiento
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
