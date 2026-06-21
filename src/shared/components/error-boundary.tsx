import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface State {
  hasError: boolean;
}

/** Captura errores de render (fallos de componente) y muestra un fallback en vez de pantalla en blanco. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // En producción solo el mensaje: el componentStack/props podrían arrastrar PII (denominación/saldo).
    if (import.meta.env.DEV) console.error("Error de render no controlado:", error, info);
    else console.error("Error de render no controlado:", error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-screen place-items-center bg-cream p-6 text-center">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Algo salió mal</h1>
            <p className="mt-1 text-sm text-ink-soft">Ocurrió un error inesperado en la pantalla.</p>
            <Button type="button" className="mt-4" onClick={() => window.location.reload()}>
              Recargar
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
