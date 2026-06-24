import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";

const API = env.apiUrl;

// Devoluciones en memoria para el demo.
const DEVOL: Record<number, string> = {};

const ITEMS = [
  { cuenta: 6572, denominacion: "R J GAGLIARDO S.A", saldoVencido: 2500.37, saldoAVencer: 0, saldo: 2500.37 },
  { cuenta: 6215, denominacion: "CARNES DEL INTERIOR S.R.L.", saldoVencido: 655.15, saldoAVencer: 0, saldo: 655.15 },
  { cuenta: 5778, denominacion: "AROLD SERGIO DAMIAN", saldoVencido: 520.39, saldoAVencer: 0, saldo: 520.39 },
];

export const devolucionHandlers = [
  http.get(`${API}/devolucion/:token`, ({ params }) => {
    if (params.token !== "demo") return new HttpResponse(null, { status: 404 });
    return HttpResponse.json({
      vendedor: "ASL",
      expiraUtc: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      items: ITEMS.map((i) => ({ ...i, devolucion: DEVOL[i.cuenta] ?? null })),
    });
  }),
  http.put(`${API}/devolucion/:token`, async ({ params, request }) => {
    if (params.token !== "demo") return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as { items: { cuenta: number; devolucion: string | null }[] };
    let actualizadas = 0;
    for (const it of body.items) {
      if (it.devolucion && it.devolucion.trim()) {
        DEVOL[it.cuenta] = it.devolucion.trim();
        actualizadas++;
      }
    }
    return HttpResponse.json({ actualizadas });
  }),
];
