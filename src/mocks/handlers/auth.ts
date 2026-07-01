import { http, HttpResponse } from "msw";
import type { AuthResponse, User } from "@/features/auth/types";
import { env } from "@/lib/env";

const API = env.apiUrl;

// Usuarios de demo con distintos juegos de pantallas (clave: cualquiera no vacía).
const USUARIOS: Record<string, User> = {
  "admin@lcagro.local": {
    id: 1, nombre: "Admin Demo", email: "admin@lcagro.local",
    roles: ["dashboard", "posicion", "cuentas", "semilla", "stock", "usuarios", "config", "auditoria"],
  },
  "operador@lcagro.local": {
    id: 2, nombre: "Operador Acopio", email: "operador@lcagro.local",
    roles: ["dashboard", "posicion", "semilla", "stock"],
  },
  "cobranzas@lcagro.local": {
    id: 3, nombre: "Cobranzas Demo", email: "cobranzas@lcagro.local",
    roles: ["dashboard", "cuentas"],
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
