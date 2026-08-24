import { describe, expect, it } from "vitest";
import type { AnalisisVendedorDto, ClienteCartera, VendedorResumen, VolumenAcopiadoDto } from "../types";
import { specFichaVendedor, specObjetivosPorVendedor } from "./export-vendedores";

const HOY = new Date(2026, 7, 18); // 18/08/2026 (mes 0-based)

function vendedor(p: Partial<VendedorResumen> & Pick<VendedorResumen, "vendedor">): VendedorResumen {
  return {
    tn: 0,
    excluido: false,
    activos: 0,
    universo: 0,
    dormidos: 0,
    penetracion: 0,
    tnPorActivo: 0,
    objetivoSugerido: 0,
    objetivoAcordado: null,
    cumplimiento: null,
    ...p,
  };
}

function cliente(p: Partial<ClienteCartera> & Pick<ClienteCartera, "numero" | "cliente">): ClienteCartera {
  return { tn: 0, tnPico: 0, campaniaPico: "2023-2024", estado: "Dormido", historia: {}, ...p };
}

/** Valor formateado de una columna, como lo escribe el exportador. */
const celda = <T,>(spec: { columns: { header: string; get: (r: T) => unknown }[] }, header: string, row: T) =>
  spec.columns.find((c) => c.header === header)!.get(row);

describe("specObjetivosPorVendedor", () => {
  const data: VolumenAcopiadoDto = {
    campania: "2025-2026",
    campanias: ["2025-2026"],
    vendedores: [
      vendedor({ vendedor: "VINCULADA", tn: 28000, excluido: true }),
      vendedor({
        vendedor: "CERINO",
        tn: 2308,
        activos: 3,
        universo: 9,
        dormidos: 6,
        penetracion: 1 / 3,
        tnPorActivo: 769,
        objetivoSugerido: 2885,
      }),
      vendedor({
        vendedor: "SAN FRANCISCO",
        tn: 1653,
        activos: 8,
        universo: 12,
        dormidos: 4,
        penetracion: 2 / 3,
        objetivoSugerido: 1985,
        objetivoAcordado: 1900,
        cumplimiento: 87,
      }),
    ],
    serie: [],
    efectoPlanta: [],
    totales: { tn: 37818, productores: 132, vendedorLider: "VINCULADA", tnLider: 28000, shareLider: 74, tnDormidas: 12400 },
  };

  const spec = specObjetivosPorVendedor(data, HOY);

  it("lleva la campaña y la fecha de emisión en el subtítulo y el nombre del archivo", () => {
    expect(spec.filename).toBe("Objetivos_por_vendedor_2025-2026");
    expect(spec.subtitle).toContain("2025-2026");
    expect(spec.subtitle).toContain("18/08/2026");
  });

  it("usa el objetivo acordado cuando existe y el sugerido cuando no, y lo dice", () => {
    const cerino = data.vendedores[1];
    const sanfra = data.vendedores[2];
    expect(celda(spec, "Objetivo (tn)", cerino)).toBe(2885);
    expect(celda(spec, "Estado del objetivo", cerino)).toBe("Sugerido");
    expect(celda(spec, "Objetivo (tn)", sanfra)).toBe(1900); // el acordado le gana al sugerido
    expect(celda(spec, "Estado del objetivo", sanfra)).toBe("Acordado");
  });

  it("deja en blanco el análisis comercial de los excluidos pero conserva sus toneladas", () => {
    const vinc = data.vendedores[0];
    expect(celda(spec, "Acopiado (tn)", vinc)).toBe(28000);
    expect(celda(spec, "Objetivo (tn)", vinc)).toBeNull();
    expect(celda(spec, "Penetración", vinc)).toBeNull();
    expect(celda(spec, "Dormidos", vinc)).toBeNull();
  });

  it("exporta la penetración en escala 0-100, como se ve en pantalla", () => {
    expect(celda(spec, "Penetración", data.vendedores[1])).toBeCloseTo(33.33, 1);
  });

  it("aclara que el objetivo es una propuesta a validar", () => {
    expect(spec.notas!.join(" ")).toMatch(/propuesta/i);
  });
});

describe("specFichaVendedor", () => {
  const analisis: AnalisisVendedorDto = {
    vendedor: "CERINO DEMO",
    campania: "2025-2026",
    resumen: vendedor({
      vendedor: "CERINO DEMO",
      tn: 2308,
      activos: 3,
      universo: 9,
      dormidos: 2,
      penetracion: 1 / 3,
      tnPorActivo: 769,
      objetivoSugerido: 2885,
    }),
    evolucion: [],
    clientes: [
      cliente({ numero: 1, cliente: "CRECE", tn: 1250, tnPico: 1250, campaniaPico: "2025-2026", estado: "Creciente" }),
      cliente({ numero: 2, cliente: "CAE", tn: 700, tnPico: 1180, campaniaPico: "2024-2025", estado: "Declinante" }),
      cliente({ numero: 3, cliente: "DORMIDO GRANDE", tn: 0, tnPico: 1300, campaniaPico: "2022-2023", estado: "Dormido" }),
      cliente({ numero: 4, cliente: "DORMIDO CHICO", tn: 0, tnPico: 300, campaniaPico: "2022-2023", estado: "Dormido" }),
    ],
    palanca: "Reactivar: 2 clientes con historia hoy en cero.",
    explicacionObjetivo: "Sobre las 2.308 tn, +25 %. Es una propuesta a acordar.",
    notaObjetivo: null,
  };

  const spec = specFichaVendedor(analisis, "2025-2026", HOY);

  it("titula con el vendedor y arma un nombre de archivo sin espacios", () => {
    expect(spec.title).toContain("CERINO DEMO");
    expect(spec.filename).toBe("Objetivo_CERINO_DEMO_2025-2026");
  });

  it("incluye el fundamento del objetivo y la palanca como notas", () => {
    const notas = spec.notas!.join(" ");
    expect(notas).toContain("Sobre las 2.308 tn");
    expect(notas).toContain("Reactivar");
  });

  it("resume lo recuperable (picos de dormidos) y lo que está en riesgo (brecha de declinantes)", () => {
    const kpis = Object.fromEntries(spec.kpis!.map((k) => [k.titulo, k.metricas[0].valor]));
    expect(kpis["Para reactivar"]).toBe("1.600"); // 1300 + 300
    expect(kpis["Para defender"]).toBe("480"); // 1180 − 700
  });

  it("calcula 'en juego' por cliente: el pico si duerme, la brecha si cae, nada si crece", () => {
    const [crece, cae, dormido] = analisis.clientes;
    expect(celda(spec, "En juego (tn)", crece)).toBeNull();
    expect(celda(spec, "En juego (tn)", cae)).toBe(480);
    expect(celda(spec, "En juego (tn)", dormido)).toBe(1300);
  });

  it("ordena la cartera por toneladas de la campaña, de mayor a menor", () => {
    expect(spec.rows.map((c) => c.cliente)).toEqual(["CRECE", "CAE", "DORMIDO GRANDE", "DORMIDO CHICO"]);
  });

  it("marca el objetivo como sugerido mientras no esté acordado", () => {
    const obj = spec.kpis!.find((k) => k.titulo === "Objetivo")!;
    expect(obj.metricas[0].label).toMatch(/sin acordar/i);
    expect(obj.metricas[0].valor).toBe("2.885 tn");
  });
});
