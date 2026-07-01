import { http, HttpResponse } from "msw";
import type { AuditDto } from "@/features/auditoria/types";
import { env } from "@/lib/env";
import type { PagedResult } from "@/shared/types/paged";

const API = env.apiUrl;

const AUDIT: AuditDto[] = [
  { id: 8, usuarioId: 2, accion: "Create", entidad: "AjustePosicion", entidadId: "12", datos: '{"campania":"2025-2026","cereal":"Maíz","tn":1000,"signo":"+"}', ip: "192.168.100.110", fecha: "2026-06-20T18:42:00Z" },
  { id: 7, usuarioId: 3, accion: "Update", entidad: "ObservacionCuenta", entidadId: "1024", datos: '{"devolucion":"Cheque rechazado, regularizar"}', ip: "192.168.100.110", fecha: "2026-06-20T17:10:00Z" },
  { id: 6, usuarioId: 1, accion: "Create", entidad: "Usuario", entidadId: "5", datos: '{"email":"nuevo@lcagro.local","roles":["dashboard","posicion","semilla"]}', ip: "192.168.100.110", fecha: "2026-06-19T11:05:00Z" },
  { id: 5, usuarioId: 1, accion: "Update", entidad: "Configuracion", entidadId: "0", datos: '{"clave":"precio_max","valor":"720"}', ip: "192.168.100.110", fecha: "2026-06-18T16:30:00Z" },
  { id: 4, usuarioId: 2, accion: "Delete", entidad: "AjustePosicion", entidadId: "9", datos: '{"cereal":"Soja","motivo":"baja lógica"}', ip: "192.168.100.110", fecha: "2026-06-18T10:15:00Z" },
  { id: 3, usuarioId: 3, accion: "Create", entidad: "ObservacionCuenta", entidadId: "2011", datos: '{"observaciones":"Acordó plan de pago"}', ip: "192.168.100.110", fecha: "2026-06-17T09:50:00Z" },
  { id: 2, usuarioId: null, accion: "Create", entidad: "AjustePosicion", entidadId: "1", datos: '{"campania":"2025-2026","cereal":"Girasol","tn":300}', ip: null, fecha: "2026-06-15T08:00:00Z" },
  { id: 1, usuarioId: 1, accion: "Update", entidad: "Usuario", entidadId: "3", datos: '{"activo":true,"roles":["dashboard","cuentas"]}', ip: "192.168.100.110", fecha: "2026-06-14T13:20:00Z" },
];

export const auditoriaHandlers = [
  http.get(`${API}/auditoria`, ({ request }) => {
    const u = new URL(request.url);
    const desde = u.searchParams.get("desde");
    const hasta = u.searchParams.get("hasta");
    const usuarioId = u.searchParams.get("usuarioId");
    const page = Number(u.searchParams.get("page") ?? "1");
    const pageSize = Number(u.searchParams.get("pageSize") ?? "20");

    let rows = [...AUDIT];
    if (desde) rows = rows.filter((a) => a.fecha >= desde);
    if (hasta) rows = rows.filter((a) => a.fecha <= `${hasta}T23:59:59Z`);
    if (usuarioId) rows = rows.filter((a) => a.usuarioId === Number(usuarioId));

    const total = rows.length;
    const totalPages = pageSize <= 0 ? 0 : Math.ceil(total / pageSize);
    const items = rows.slice((page - 1) * pageSize, page * pageSize);
    const paged: PagedResult<AuditDto> = {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
    return HttpResponse.json(paged);
  }),
];
