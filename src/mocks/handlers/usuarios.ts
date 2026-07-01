import { http, HttpResponse } from "msw";
import type { ActualizarUsuarioInput, CrearUsuarioInput, UsuarioDto } from "@/features/usuarios/types";
import { env } from "@/lib/env";

const API = env.apiUrl;
const ROLES = ["dashboard", "posicion", "cuentas", "semilla", "stock", "usuarios", "config", "auditoria"];

let seq = 4;
const USUARIOS: UsuarioDto[] = [
  { id: 1, nombre: "Admin Demo", email: "admin@lcagro.local", activo: true, roles: ["dashboard", "posicion", "cuentas", "semilla", "stock", "usuarios", "config", "auditoria"], fechaAlta: "2026-01-15T10:00:00Z" },
  { id: 2, nombre: "Operador Acopio", email: "operador@lcagro.local", activo: true, roles: ["dashboard", "posicion", "semilla", "stock"], fechaAlta: "2026-02-03T09:30:00Z" },
  { id: 3, nombre: "Cobranzas Demo", email: "cobranzas@lcagro.local", activo: true, roles: ["dashboard", "cuentas"], fechaAlta: "2026-02-20T14:10:00Z" },
  { id: 4, nombre: "Solo Lectura", email: "lectura@lcagro.local", activo: true, roles: ["dashboard"], fechaAlta: "2026-03-01T08:00:00Z" },
];

const conflict = () =>
  HttpResponse.json({ title: "Ya existe un usuario con ese email.", status: 409 }, { status: 409 });

export const usuariosHandlers = [
  http.get(`${API}/usuarios/roles`, () => HttpResponse.json(ROLES)),

  http.get(`${API}/usuarios`, () => HttpResponse.json(USUARIOS)),

  http.post(`${API}/usuarios`, async ({ request }) => {
    const input = (await request.json()) as CrearUsuarioInput;
    const email = input.email.trim().toLowerCase();
    if (USUARIOS.some((u) => u.email.toLowerCase() === email)) return conflict();
    const nuevo: UsuarioDto = {
      id: ++seq,
      nombre: input.nombre,
      email,
      activo: true,
      roles: input.roles,
      fechaAlta: new Date().toISOString(),
    };
    USUARIOS.push(nuevo);
    return HttpResponse.json(nuevo, { status: 201 });
  }),

  http.put(`${API}/usuarios/:id`, async ({ request, params }) => {
    const id = Number(params.id);
    const idx = USUARIOS.findIndex((u) => u.id === id);
    if (idx === -1) return HttpResponse.json({ title: "No encontrado.", status: 404 }, { status: 404 });
    const input = (await request.json()) as ActualizarUsuarioInput;
    const email = input.email.trim().toLowerCase();
    if (USUARIOS.some((u) => u.id !== id && u.email.toLowerCase() === email)) return conflict();
    USUARIOS[idx] = { ...USUARIOS[idx], nombre: input.nombre, email, activo: input.activo, roles: input.roles };
    return HttpResponse.json(USUARIOS[idx]);
  }),

  http.delete(`${API}/usuarios/:id`, ({ params }) => {
    const idx = USUARIOS.findIndex((u) => u.id === Number(params.id));
    if (idx !== -1) USUARIOS[idx] = { ...USUARIOS[idx], activo: false };
    return new HttpResponse(null, { status: 204 });
  }),
];
