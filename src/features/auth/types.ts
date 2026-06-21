/** Roles del sistema (coinciden con los del backend / claims del JWT). */
export type RolNombre = "Admin" | "Operador" | "Cobranzas" | "SoloLectura";

/** Usuario autenticado (espeja UserDto del backend). */
export interface User {
  id: number;
  nombre: string;
  email: string;
  roles: RolNombre[];
}

/** Respuesta de /auth/login y /auth/refresh (espeja AuthResponse del backend). */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAtUtc: string;
  user: User;
}
