import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";
import type { StockCerealDto } from "@/features/stockfisico/types";

const API = env.apiUrl;

// Stock físico de cereal ficticio (NUNCA datos reales). El detalle de planta 10 suma exactamente el
// P10 del consolidado por cereal, para que la pantalla cuadre. Silobolsa en 0 (pendiente de carga).
const DATA: StockCerealDto = {
  fecha: "2026-07-27",
  silobolsaPendiente: true,
  consolidado: [
    { cereal: "Soja", p15: 12283, p20: 2461, p10: 15552, silobolsa: 0, total: 30296 },
    { cereal: "Maíz", p15: 8141, p20: 0, p10: 10381, silobolsa: 0, total: 18522 },
    { cereal: "Trigo", p15: 4258, p20: 1087, p10: 10303, silobolsa: 0, total: 15648 },
  ],
  totales: {
    p15: 24682, p20: 3548, p10: 36236, silobolsa: 0, total: 64466,
    vencidoTn: 5781, vencidoContratos: 2,
    proximo30Tn: 6100, proximo30Contratos: 1,
  },
  detallePlanta10: [
    { comprador: "EXPORTADORA DEMO S.A.", cereal: "Soja", contrato: "C-1001", campania: "20252026", aFijarTn: 10000, vtoFijacion: "2026-11-30", diasParaVto: 126, estado: "Verde", directo: true },
    { comprador: "ACOPIO DEMO S.R.L.", cereal: "Soja", contrato: "C-1002", campania: "20252026", aFijarTn: 5552, vtoFijacion: "2026-09-10", diasParaVto: 45, estado: "Amarillo", directo: false },
    { comprador: "MOLINO DEMO S.A.", cereal: "Maíz", contrato: "C-2001", campania: "20252026", aFijarTn: 6100, vtoFijacion: "2026-08-16", diasParaVto: 20, estado: "Naranja", directo: true },
    { comprador: "TRADER DEMO", cereal: "Maíz", contrato: "C-2002", campania: "20242025", aFijarTn: 4281, vtoFijacion: "2026-07-17", diasParaVto: -10, estado: "Vencido", directo: false },
    { comprador: "TRADER DEMO", cereal: "Trigo", contrato: "C-3002", campania: "20242025", aFijarTn: 1500, vtoFijacion: "2026-06-20", diasParaVto: -37, estado: "Vencido", directo: false },
    { comprador: "MOLINERA DEMO S.A.", cereal: "Trigo", contrato: "C-3001", campania: "20252026", aFijarTn: 8803, vtoFijacion: "2027-02-15", diasParaVto: 203, estado: "Verde", directo: true },
  ],
  alertasDescarga: [
    { contrato: "vital2025", comprador: "VITALCROPS DEMO SA", cereal: "Soja", campania: "20252026", fijadoTn: 320.5 },
    { contrato: "mz-nestle25", comprador: "LA CLEMENTINA (retiro)", cereal: "Maíz", campania: "20252026", fijadoTn: 210 },
  ],
};

export const stockfisicoHandlers = [
  http.get(`${API}/stock-cereal`, () => HttpResponse.json(DATA)),

  http.get(`${API}/stock-cereal/export`, () =>
    new HttpResponse(new Blob(["demo"]), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Stock_Fisico_Cereal_demo.xlsx"',
      },
    }),
  ),
];
