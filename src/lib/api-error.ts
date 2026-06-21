import { AxiosError } from "axios";

/** ProblemDetails (RFC 7807) tal como lo emite la API .NET. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>; // validación: campo → mensajes
  traceId?: string;
}

/** Error normalizado para que toda la UI lo consuma igual. */
export interface AppError {
  status: number;
  /** Mensaje listo para mostrar en un toast. */
  message: string;
  /** Errores por campo, para mapear a react-hook-form. */
  fieldErrors?: Record<string, string[]>;
  traceId?: string;
}

const FALLBACK = "Ocurrió un error inesperado. Probá de nuevo.";

export function toAppError(error: unknown): AppError {
  if (error instanceof AxiosError) {
    // Sin respuesta del server (red caída, VPN, CORS).
    if (!error.response) {
      return { status: 0, message: "No se pudo conectar con el servidor." };
    }

    const pd = error.response.data as ProblemDetails | undefined;
    const status = error.response.status;

    if (status === 401) {
      return { status, message: "Tu sesión expiró. Iniciá sesión de nuevo." };
    }

    return {
      status,
      message: pd?.detail ?? pd?.title ?? mensajePorStatus(status),
      fieldErrors: pd?.errors,
      traceId: pd?.traceId,
    };
  }

  return { status: 0, message: FALLBACK };
}

function mensajePorStatus(status: number): string {
  switch (status) {
    case 403:
      return "No tenés permiso para esta acción.";
    case 404:
      return "No se encontró el recurso.";
    case 409:
      return "El recurso entró en conflicto con el estado actual.";
    case 422:
      return "Los datos enviados no son válidos.";
    case 429:
      return "Demasiados intentos. Esperá un momento e intentá de nuevo.";
    case 500:
      return "Error del servidor. Avisale al equipo si persiste.";
    default:
      return FALLBACK;
  }
}
