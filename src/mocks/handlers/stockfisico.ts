import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";
import type { StockCerealDto } from "@/features/stockfisico/types";

const API = env.apiUrl;

// Stock físico de cereal ficticio (NUNCA datos reales). El detalle de planta 10 suma exactamente el
// P10 del consolidado por cereal, para que la pantalla cuadre. Silobolsa en 0 (pendiente de carga).
const DATA: StockCerealDto = {
  fecha: "2026-07-27",
  campania: null,
  campanias: ["2025-2026", "2024-2025"],
  plantasOtrasCampaniasTn: 0,
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
    { comprador: "EXPORTADORA DEMO S.A.", cereal: "Soja", contrato: "C-1001", campania: "20252026", aFijarTn: 10000, vtoFijacion: "2026-11-30", diasParaVto: 126, estado: "Verde", directo: true, corredor: null },
    { comprador: "ACOPIO DEMO S.R.L.", cereal: "Soja", contrato: "C-1002", campania: "20252026", aFijarTn: 5552, vtoFijacion: "2026-09-10", diasParaVto: 45, estado: "Amarillo", directo: false, corredor: "GRASSI S.A." },
    { comprador: "MOLINO DEMO S.A.", cereal: "Maíz", contrato: "C-2001", campania: "20252026", aFijarTn: 6100, vtoFijacion: "2026-08-16", diasParaVto: 20, estado: "Naranja", directo: true, corredor: null },
    { comprador: "TRADER DEMO", cereal: "Maíz", contrato: "C-2002", campania: "20242025", aFijarTn: 4281, vtoFijacion: "2026-07-17", diasParaVto: -10, estado: "Vencido", directo: false, corredor: "GRASSI S.A." },
    { comprador: "TRADER DEMO", cereal: "Trigo", contrato: "C-3002", campania: "20242025", aFijarTn: 1500, vtoFijacion: "2026-06-20", diasParaVto: -37, estado: "Vencido", directo: false, corredor: "GRASSI S.A." },
    { comprador: "MOLINERA DEMO S.A.", cereal: "Trigo", contrato: "C-3001", campania: "20252026", aFijarTn: 8803, vtoFijacion: "2027-02-15", diasParaVto: 203, estado: "Verde", directo: true, corredor: null },
  ],
  alertasDescarga: [
    { contrato: "vital2025", comprador: "VITALCROPS DEMO SA", cereal: "Soja", campania: "20252026", fijadoTn: 320.5 },
    { contrato: "mz-nestle25", comprador: "LA CLEMENTINA (retiro)", cereal: "Maíz", campania: "20252026", fijadoTn: 210 },
  ],
};

/**
 * Acota la demo a una campaña como lo hace el backend: en el mock solo hay campaña en planta 10 y en
 * las alertas, así que se recalcula el P10 del consolidado y los totales de fijación sobre lo que queda.
 */
function porCampania(campania: string): StockCerealDto {
  const clave = campania.replace("-", "");
  const detallePlanta10 = DATA.detallePlanta10.filter((d) => d.campania === clave);
  const p10De = (cereal: string) =>
    detallePlanta10.filter((d) => d.cereal === cereal).reduce((acc, d) => acc + d.aFijarTn, 0);
  // En la demo todo el saldo de plantas está imputado a la campaña vigente; al mirar una anterior
  // queda afuera y la pantalla lo informa, como pasa con los residuos reales de saldo_planta_v.
  const enPlantas = clave === "20252026";
  const consolidado = DATA.consolidado
    .map((c) => ({
      ...c,
      p15: enPlantas ? c.p15 : 0,
      p20: enPlantas ? c.p20 : 0,
      p10: p10De(c.cereal),
      total: (enPlantas ? c.p15 + c.p20 : 0) + p10De(c.cereal) + c.silobolsa,
    }))
    .filter((c) => c.total !== 0);
  const vencidos = detallePlanta10.filter((d) => d.estado === "Vencido");
  const proximos = detallePlanta10.filter((d) => d.diasParaVto !== null && d.diasParaVto >= 0 && d.diasParaVto <= 30);
  const suma = (get: (c: (typeof consolidado)[number]) => number) => consolidado.reduce((a, c) => a + get(c), 0);

  return {
    ...DATA,
    campania,
    plantasOtrasCampaniasTn: enPlantas ? 0 : DATA.totales.p15 + DATA.totales.p20,
    consolidado,
    detallePlanta10,
    alertasDescarga: DATA.alertasDescarga.filter((a) => a.campania === clave),
    totales: {
      p15: suma((c) => c.p15),
      p20: suma((c) => c.p20),
      p10: suma((c) => c.p10),
      silobolsa: suma((c) => c.silobolsa),
      total: suma((c) => c.total),
      vencidoTn: vencidos.reduce((a, d) => a + d.aFijarTn, 0),
      vencidoContratos: vencidos.length,
      proximo30Tn: proximos.reduce((a, d) => a + d.aFijarTn, 0),
      proximo30Contratos: proximos.length,
    },
  };
}

export const stockfisicoHandlers = [
  http.get(`${API}/stock-cereal`, ({ request }) => {
    const campania = new URL(request.url).searchParams.get("campania");
    return HttpResponse.json(campania ? porCampania(campania) : DATA);
  }),

  http.get(`${API}/stock-cereal/export`, () =>
    new HttpResponse(new Blob(["demo"]), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Stock_Fisico_Cereal_demo.xlsx"',
      },
    }),
  ),
];
