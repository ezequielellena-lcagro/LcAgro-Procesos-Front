/**
 * Pantallas del sistema. El "rol" de un usuario es la lista de pantallas a las que puede entrar
 * (coincide con los claims de rol del JWT del backend: `Pantallas.Todas`). Acceso = uso completo.
 */
export type RolNombre =
  | "dashboard"
  | "posicion"
  | "cuentas"
  | "proveedores"
  | "semilla"
  | "stock"
  | "stockfisico"
  | "comisiones"
  | "usuarios"
  | "config"
  | "auditoria";

/** Etiqueta legible por pantalla (espeja `Pantallas.Etiqueta` del backend). */
export const ETIQUETA_PANTALLA: Record<RolNombre, string> = {
  dashboard: "Dashboard",
  posicion: "Posición de Cereal",
  cuentas: "Cuentas Corrientes Clientes USD",
  proveedores: "Cuentas Corrientes Proveedores USD",
  semilla: "Semilla Fiscalizada",
  stock: "Stock de Insumos",
  stockfisico: "Stock Físico de Cereal",
  comisiones: "Liquidación de Comisiones",
  usuarios: "Usuarios",
  config: "Configuración",
  auditoria: "Auditoría",
};

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
