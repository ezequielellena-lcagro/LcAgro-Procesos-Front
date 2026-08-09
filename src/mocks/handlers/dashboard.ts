import { http, HttpResponse } from "msw";
import type { DashboardDto } from "@/features/dashboard/types";
import { env } from "@/lib/env";

const API = env.apiUrl;

// Cruza la posición 2025-2026 (con ajustes) y la foto de cuentas del demo.
const DASHBOARD: DashboardDto = {
  posicion: {
    campania: "2025-2026",
    tnCompra: 28200,
    tnVenta: 22000,
    tnCalzadas: 21300,
    resultadoUsd: 121934,
    posicionFinalTn: 7000,
    cereales: 4,
  },
  cuentas: {
    totalCuentas: 14,
    saldoTotalUsd: 214833.7,
    saldoVencidoUsd: 142183.45,
    saldoAVencerUsd: 72650.25,
    cuentasConVencido: 11,
  },
  prestamos: {
    saldoUsd: 2601402.3,
    saldoArs: 149551485.68,
    operacionesVigentes: 23,
    proximoVencimiento: "2026-09-10",
    cuotasVencidas: 0,
  },
};

export const dashboardHandlers = [http.get(`${API}/dashboard`, () => HttpResponse.json(DASHBOARD))];
