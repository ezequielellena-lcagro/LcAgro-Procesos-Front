import { http, HttpResponse } from "msw";
import type { AuthResponse, User } from "@/features/auth/types";
import { env } from "@/lib/env";

const API = env.apiUrl;

// Usuarios de demo con distintos juegos de pantallas (clave: cualquiera no vacía).
const USUARIOS: Record<string, User> = {
  "admin@lcagro.local": {
    id: 1,
    nombre: "Admin Demo",
    email: "admin@lcagro.local",
    // Todas las pantallas de Pantallas.cs: es el usuario con el que se recorre el demo entero.
    roles: [
      "dashboard",
      "posicion",
      "cuentas",
      "semilla",
      "stock",
      "stockfisico",
      "produccionpropia",
      "volumenacopiado",
      "tableroacopio",
      "comisiones",
      "proveedores",
      "prestamos",
      "semillero",
      "planificacionventas",
      "planificacionventasgestion",
      "logistica-lectura",
      "logistica-pedidos",
      "logistica-cupos",
      "logistica-cargas",
      "logistica-flete",
      "usuarios",
      "config",
      "auditoria",
    ],
  },
  "logistica@lcagro.local": {
    id: 7,
    nombre: "Logística Demo",
    email: "logistica@lcagro.local",
    roles: ["logistica-pedidos", "logistica-cupos", "logistica-cargas", "logistica-flete"],
  },
  "logistica-flete@lcagro.local": {
    id: 12,
    nombre: "Flete Demo",
    email: "logistica-flete@lcagro.local",
    roles: ["logistica-flete"],
  },
  "logistica-lectura@lcagro.local": {
    id: 8,
    nombre: "Logística Lectura Demo",
    email: "logistica-lectura@lcagro.local",
    roles: ["logistica-lectura"],
  },
  "logistica-cargas@lcagro.local": {
    id: 9,
    nombre: "Cargas Demo",
    email: "logistica-cargas@lcagro.local",
    roles: ["logistica-cargas"],
  },
  "logistica-pedidos@lcagro.local": {
    id: 11,
    nombre: "Pedidos Demo",
    email: "logistica-pedidos@lcagro.local",
    roles: ["logistica-pedidos"],
  },
  "logistica-cupos@lcagro.local": {
    id: 10,
    nombre: "Cupos Demo",
    email: "logistica-cupos@lcagro.local",
    roles: ["logistica-cupos"],
  },
  "vendedor@lcagro.local": {
    id: 5,
    nombre: "Vendedor Demo",
    email: "vendedor@lcagro.local",
    roles: ["planificacionventas"],
  },
  "gestion@lcagro.local": {
    id: 6,
    nombre: "Gestión Demo",
    email: "gestion@lcagro.local",
    roles: ["planificacionventasgestion"],
  },
  "operador@lcagro.local": {
    id: 2,
    nombre: "Operador Acopio",
    email: "operador@lcagro.local",
    roles: [
      "dashboard",
      "posicion",
      "stockfisico",
      "produccionpropia",
      "volumenacopiado",
      "semilla",
      "stock",
    ],
  },
  "cobranzas@lcagro.local": {
    id: 3,
    nombre: "Cobranzas Demo",
    email: "cobranzas@lcagro.local",
    roles: ["dashboard", "cuentas", "proveedores"],
  },
  "lectura@lcagro.local": {
    id: 4,
    nombre: "Solo Lectura",
    email: "lectura@lcagro.local",
    roles: ["dashboard"],
  },
};

export function permisoLogisticaDemo(
  request: Request,
  escritura: boolean,
  rolEscritura = "logistica-cargas",
): 401 | 403 | null {
  const token = request.headers.get("Authorization");
  // Los tests aislados previos ejercitan los handlers sin AuthProvider.
  if (!token && import.meta.env.MODE === "test") return null;
  const id = /^Bearer mock-access-(\d+)$/.exec(token ?? "")?.[1];
  const user = Object.values(USUARIOS).find((u) => u.id === Number(id));
  if (!user) return 401;
  const roles = escritura
    ? [rolEscritura]
    : rolEscritura === "logistica-flete"
      ? ["logistica-lectura", "logistica-flete"]
      : ["logistica-lectura", "logistica-cupos", "logistica-cargas"];
  return roles.some((r) => user.roles.some((rol) => rol === r)) ? null : 403;
}

/** Un único resolver mantiene autoría y permisos alineados para el demo. */
export function usuarioLogisticaDemo(request: Request): User | null {
  const token = request.headers.get("Authorization");
  if (!token && import.meta.env.MODE === "test") return USUARIOS["admin@lcagro.local"];
  const id = /^Bearer mock-access-(\d+)$/.exec(token ?? "")?.[1];
  return Object.values(USUARIOS).find((u) => u.id === Number(id)) ?? null;
}

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
