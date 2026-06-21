import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { env } from "./env";

// --- Puente con la capa de Auth (lo completa AuthProvider al montar) ---
// Evita el import circular apiClient <-> AuthContext: el cliente sabe pedir el token / refrescar /
// avisar de un fallo, pero no conoce al provider.
interface TokenBridge {
  getAccessToken: () => string | null;
  /** Devuelve el nuevo access token o null si no se pudo refrescar. */
  refresh: () => Promise<string | null>;
  /** Se llama cuando el refresh falla → forzar logout. */
  onAuthFailure: () => void;
}

let bridge: TokenBridge = {
  getAccessToken: () => null,
  refresh: async () => null,
  onAuthFailure: () => {},
};

export function setTokenBridge(b: TokenBridge) {
  bridge = b;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiUrl, // ya incluye /api
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

// Request: adjunta el Bearer si hay sesión.
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = bridge.getAccessToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

// Response: ante 401 intenta refrescar UNA vez por request, coalesciendo los 401 concurrentes.
type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string | null> | null = null;

const AUTH_PATHS = ["/auth/login", "/auth/refresh"];

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";
    const isAuthCall = AUTH_PATHS.some((p) => url.includes(p));

    if (status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;

      // Un solo refresh para todos los 401 concurrentes.
      refreshPromise ??= bridge.refresh().finally(() => {
        refreshPromise = null;
      });

      const newToken = await refreshPromise;

      if (newToken) {
        original.headers.set("Authorization", `Bearer ${newToken}`);
        return apiClient(original); // reintento
      }

      bridge.onAuthFailure(); // refresh falló → logout
    }

    return Promise.reject(error);
  },
);
