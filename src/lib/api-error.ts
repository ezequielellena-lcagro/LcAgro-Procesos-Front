import { AxiosError } from "axios";

/** ProblemDetails (RFC 7807) tal como lo emite la API .NET. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>; // validación: campo → mensajes
  fieldErrors?: Record<string, string[]>;
  cuits?: string[];
  traceId?: string;
  /** Código estable del error de negocio (p. ej. "varios_vendedores"), para ramificar sin parsear el texto. */
  codigo?: string;
}

/** Error normalizado para que toda la UI lo consuma igual. */
export interface AppError {
  status: number;
  /** Mensaje listo para mostrar en un toast. */
  message: string;
  /** Errores por campo, para mapear a react-hook-form. */
  fieldErrors?: Record<string, string[]>;
  cuits?: string[];
  traceId?: string;
  /** Código estable del error de negocio, cuando la API lo informa. */
  codigo?: string;
}

const FALLBACK = "Ocurrió un error inesperado. Probá de nuevo.";
/** Falla del propio navegador (bug nuestro), no una respuesta de la API. */
export const FALLO_CLIENTE = "fallo_cliente";

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
      fieldErrors: pd?.errors ?? pd?.fieldErrors,
      cuits: pd?.cuits,
      traceId: pd?.traceId,
      codigo: pd?.codigo,
    };
  }

  // No es un error de la API: reventó nuestro propio código antes o después de la llamada.
  // Decirlo así evita el "probá de nuevo" que no arregla nada y manda a recargar, que sí.
  return {
    status: 0,
    codigo: FALLO_CLIENTE,
    message:
      "Falló la pantalla en el navegador. Recargá y verificá si la operación quedó guardada antes de repetirla.",
  };
}

function mensajePorStatus(status: number): string {
  switch (status) {
    case 400:
      return "La operación no pasó las validaciones del servidor.";
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
    // 502/503/504 los puede emitir la API o el servidor que la publica; sin estos casos caían en
    // el texto genérico y el operador no sabía si esperar, reintentar o avisar.
    case 502:
      return "No se pudo contactar con la API. Avisale al equipo.";
    case 503:
      return "MacroGest no está disponible. Reintentá en unos segundos.";
    case 504:
      return "El servidor tardó demasiado en responder.";
    default:
      return FALLBACK;
  }
}
