import { useCallback, useEffect } from "react";
import { useBlocker } from "react-router-dom";

const MENSAJE_SALIDA = "Tenés cambios sin guardar. ¿Querés descartarlos y salir?";
const MENSAJE_CAMBIO = "Tenés cambios sin guardar. ¿Querés descartarlos y cambiar la selección?";

/** Protege navegación/recarga y expone una confirmación para cambiar filtros que reemplazan el borrador. */
export function useAvisoCambiosSinGuardar(hayCambios: boolean) {
  const blocker = useBlocker(hayCambios);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm(MENSAJE_SALIDA)) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!hayCambios) return;
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      evento.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [hayCambios]);

  const confirmarCambio = useCallback(
    () => !hayCambios || window.confirm(MENSAJE_CAMBIO),
    [hayCambios],
  );

  return { confirmarCambio };
}
