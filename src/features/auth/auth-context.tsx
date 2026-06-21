import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiClient, setTokenBridge } from "@/lib/api-client";
import { tokenStorage } from "./token-storage";
import type { AuthResponse, RolNombre, User } from "./types";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthState {
  user: User | null;
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** true si el usuario tiene al menos uno de los roles indicados. */
  hasAnyRole: (roles: RolNombre[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Access token en memoria (ref): no re-renderiza ni se persiste.
  const accessRef = useRef<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const setSession = (data: AuthResponse) => {
    accessRef.current = data.accessToken;
    tokenStorage.setRefresh(data.refreshToken);
    setUser(data.user);
    setStatus("authenticated");
  };

  const clearSession = useCallback(() => {
    accessRef.current = null;
    tokenStorage.clear();
    setUser(null);
    setStatus("anonymous");
  }, []);

  // Devuelve el nuevo access token (o null). Lo usa el interceptor del apiClient.
  const refresh = useCallback(async (): Promise<string | null> => {
    const rt = tokenStorage.getRefresh();
    if (!rt) return null;
    try {
      const { data } = await apiClient.post<AuthResponse>("/auth/refresh", { refreshToken: rt });
      setSession(data);
      return data.accessToken;
    } catch {
      clearSession();
      return null;
    }
  }, [clearSession]);

  // Cierra el ciclo apiClient <-> auth (sin import circular).
  useEffect(() => {
    setTokenBridge({
      getAccessToken: () => accessRef.current,
      refresh,
      onAuthFailure: clearSession,
    });
  }, [refresh, clearSession]);

  // Rehidratación al montar: si hay refresh guardado, recupera la sesión. El guard evita que el
  // doble-montaje de StrictMode rote el refresh dos veces (y dispare la detección de reuso real).
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void (async () => {
      const token = await refresh();
      setStatus(token ? "authenticated" : "anonymous");
    })();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const { data } = await apiClient.post<AuthResponse>("/auth/login", { email, password });
    setSession(data);
  };

  const logout = () => clearSession();

  const hasAnyRole = (roles: RolNombre[]) => !!user && roles.some((r) => user.roles.includes(r));

  return (
    <AuthContext.Provider value={{ user, status, login, logout, hasAnyRole }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  return ctx;
}
