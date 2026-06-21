/** Usuario de administración (espeja UsuarioListItemDto del backend; nunca trae el hash). */
export interface UsuarioDto {
  id: number;
  nombre: string;
  email: string;
  activo: boolean;
  roles: string[];
  fechaAlta: string;
}

export interface CrearUsuarioInput {
  nombre: string;
  email: string;
  password: string;
  roles: string[];
}

export interface ActualizarUsuarioInput {
  nombre: string;
  email: string;
  activo: boolean;
  password?: string | null; // si viene no vacío, cambia la contraseña
  roles: string[];
}
