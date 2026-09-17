import { http, HttpResponse } from "msw";
import type { AuthResponse, User } from "@/features/auth/types";
import { env } from "@/lib/env";

const API = env.apiUrl;

// Usuarios de demo con distintos juegos de pantallas (clave: cualquiera no vacía).
const USUARIOS: Record<string, User> = {
  "admin@lcagro.local": {
    id: 1, nombre: "Admin Demo", email: "admin@lcagro.local",
    // Todas las pantallas de Pantallas.cs: es el usuario con el que se recorre el demo entero.
    roles: ["dashboard", "posicion", "cuentas", "semilla", "stock", "stockfisico", "produccionpropia", "volumenacopiado", "comisiones", "proveedores", "prestamos", "semillero", "planificacionventas", "planificacionventasgestion", "usuarios", "config", "auditoria"],
  },
  "vendedor@lcagro.local": {
    id: 5, nombre: "Vendedor Demo", email: "vendedor@lcagro.local",
    roles: ["planificacionventas"],
  },
  "gestion@lcagro.local": {
    id: 6, nombre: "Gestión Demo", email: "gestion@lcagro.local",
    roles: ["planificacionventasgestion"],
  },
  "operador@lcagro.local": {
    id: 2, nombre: "Operador Acopio", email: "operador@lcagro.local",
    roles: ["dashboard", "posicion", "stockfisico", "produccionpropia", "volumenacopiado", "semilla", "stock"],
  },
  "cobranzas@lcagro.local": {
    id: 3, nombre: "Cobranzas Demo", email: "cobranzas@lcagro.local",
    roles: ["dashboard", "cuentas", "proveedores"],
  },
  "lectura@lcagro.local": {
    id: 4, nombre: "Solo Lectura", email: "lectura@lcagro.local",
    roles: ["dashboard"],
  },
};

function sesion(user: User): AuthResponse {
  return {
    accessToken: `mock-access-${user.id}`,
    refreshToken: `mock-refresh.${user.id}`,
    expiresAtUtc: new Date(Date.now() + 15 * 60_000).toISOString(),
    user,
  };
}

function unauthorized() {
  return HttpResponse.json(
    { type: "https://httpstatuses.io/401", title: "Credenciales inválidas.", status: 401 },
    { status: 401 },
  );
}

export const authHandlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const user = USUARIOS[email];
    if (!user || !body.password) return unauthorized();
    return HttpResponse.json(sesion(user));
  }),

  http.post(`${API}/auth/refresh`, async ({ request }) => {
    const body = (await request.json()) as { refreshToken?: string };
    const match = /^mock-refresh\.(\d+)$/.exec(body.refreshToken ?? "");
    const id = match ? Number(match[1]) : null;
    const user = id ? Object.values(USUARIOS).find((u) => u.id === id) : undefined;
    if (!user) return unauthorized();
    return HttpResponse.json(sesion(user));
  }),
];
