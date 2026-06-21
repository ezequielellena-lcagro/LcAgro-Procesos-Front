import { http, HttpResponse } from "msw";
import type { ConfigDto } from "@/features/config/types";
import { env } from "@/lib/env";

const API = env.apiUrl;

const CONFIG: ConfigDto[] = [
  { clave: "campania_minima", valor: "20232024", tipo: "int", descripcion: "Campaña mínima (filtro de posición)" },
  { clave: "precio_min", valor: "50", tipo: "int", descripcion: "Precio mínimo plausible (USD)" },
  { clave: "precio_max", valor: "700", tipo: "int", descripcion: "Precio máximo plausible (USD)" },
  { clave: "umbral_saldo", valor: "50", tipo: "int", descripcion: "Umbral de saldo en cuentas (USD)" },
  { clave: "zona", valor: "4", tipo: "int", descripcion: "Zona de clientes" },
];

export const configHandlers = [
  http.get(`${API}/config`, () => HttpResponse.json(CONFIG)),

  http.put(`${API}/config`, async ({ request }) => {
    const body = (await request.json()) as { items: { clave: string; valor: string }[] };
    for (const it of body.items) {
      const c = CONFIG.find((x) => x.clave === it.clave);
      if (c) c.valor = it.valor;
    }
    return HttpResponse.json(CONFIG);
  }),
];
