/** Entrada del log de auditoría (espeja AuditDto del backend). */
export interface AuditDto {
  id: number;
  usuarioId: number | null;
  accion: string;
  entidad: string;
  entidadId: string | null;
  datos: string | null;
  ip: string | null;
  fecha: string;
}

export interface AuditoriaFiltros {
  desde?: string;
  hasta?: string;
  usuarioId?: number;
  page: number;
  pageSize: number;
}
