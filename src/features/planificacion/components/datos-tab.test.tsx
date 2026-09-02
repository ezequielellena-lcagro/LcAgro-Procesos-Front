import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatosTab } from "./datos-tab";
import type { ImportacionBayerDto, ImportacionPlanSiembraDto } from "../types";

const sincronizar = vi.fn();
const previewPlan = vi.fn();
const confirmarPlan = vi.fn();
const previewBayer = vi.fn();

let planPreview: ImportacionPlanSiembraDto | undefined;
let planConfirmado: ImportacionPlanSiembraDto | undefined;
let bayerPreview: ImportacionBayerDto | undefined;
let shareDisponible: boolean | undefined;

vi.mock("../queries/use-sincronizar-padron", () => ({
  useSincronizarPadron: () => ({ mutate: sincronizar, isPending: false, data: undefined }),
}));

vi.mock("../queries/use-importacion", () => ({
  usePreviewPlanSiembra: () => ({
    mutate: previewPlan,
    reset: vi.fn(),
    isPending: false,
    data: planPreview,
  }),
  useConfirmarPlanSiembra: () => ({
    mutate: confirmarPlan,
    reset: vi.fn(),
    isPending: false,
    data: planConfirmado,
  }),
  usePreviewBayer: () => ({
    mutate: previewBayer,
    reset: vi.fn(),
    isPending: false,
    data: bayerPreview,
  }),
  useConfirmarBayer: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, data: undefined }),
  usePreviewBayerShare: () => ({
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    data: undefined,
  }),
  useConfirmarBayerShare: () => ({
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    data: undefined,
  }),
  useEstadoShareBayer: () => ({
    data:
      shareDisponible === undefined
        ? undefined
        : {
            estado: shareDisponible ? "Disponible" : "NoDisponible",
            habilitado: true,
            disponible: shareDisponible,
            detalle: shareDisponible ? "" : "no se encontró la carpeta.",
            tamanioBytes: null,
            ultimaModificacionUtc: null,
          },
  }),
}));

function vistaPlan(cambios: Partial<ImportacionPlanSiembraDto> = {}): ImportacionPlanSiembraDto {
  return {
    confirmado: false,
    puedeConfirmar: true,
    formato: "legacy",
    campania: "2025-2026",
    vigenteDesde: "2025-04-01T00:00:00-03:00",
    tokenPreview: "tok-1",
    filasLeidas: 425,
    filasAccionables: 278,
    filasResueltas: 278,
    productoresModificados: 278,
    planesAabrir: 834,
    planesAcerrar: 0,
    costosAabrir: 3,
    costosAcerrar: 0,
    errores: [],
    advertencias: [],
    pendientes: [],
    mercadoAntes: {
      hectareasTotales: 0,
      mercadoUsd: 0,
      completo: true,
      hectareasSinCosto: 0,
      cultivosSinCosto: [],
    },
    mercadoDespues: {
      hectareasTotales: 264140,
      mercadoUsd: 98030001,
      completo: true,
      hectareasSinCosto: 0,
      cultivosSinCosto: [],
    },
    ...cambios,
  };
}

function archivo(nombre = "PLAN DE VENTAS.xlsx") {
  return new File(["x"], nombre, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("solapa de carga de datos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planPreview = undefined;
    planConfirmado = undefined;
    bayerPreview = undefined;
    shareDisponible = undefined;
  });

  it("sincroniza el padron a pedido", () => {
    render(<DatosTab campania="2025-2026" />);

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar padrón" }));

    expect(sincronizar).toHaveBeenCalledTimes(1);
  });

  it("no deja analizar hasta que hay un archivo elegido", () => {
    render(<DatosTab campania="2025-2026" />);

    for (const boton of screen.getAllByRole("button", { name: "Analizar archivo" })) {
      expect(boton).toBeDisabled();
    }
  });

  it("muestra en cuanto queda el mercado antes de confirmar", () => {
    planPreview = vistaPlan();
    render(<DatosTab campania="2025-2026" />);

    // El análisis no escribió nada: sólo dice en cuánto quedaría el mercado si se confirma.
    expect(screen.getByText("US$ 98.030.001,00")).toBeInTheDocument();
    expect(screen.getByText("264.140")).toBeInTheDocument();
    expect(screen.getByText(/US\$ 0,00/)).toBeInTheDocument();
  });

  it("deja elegir el productor de una fila ambigua, con la pista de MacroGest a la vista", () => {
    planPreview = vistaPlan({
      puedeConfirmar: false,
      pendientes: [
        {
          filaId: "legacy:ventas:65",
          hoja: "Ventas consolidado Clientes",
          fila: 65,
          razonSocialArchivo: "CAMURRI S.A.",
          cuitEnmascarado: "*******5153",
          candidatos: [
            { productorId: 769, cuentaMacroGest: 769, razonSocial: "CAMURRI S.A." },
            { productorId: 3131, cuentaMacroGest: 3153, razonSocial: "CAMURRI HERMANOS (NO USAR)" },
          ],
        },
      ],
    });
    render(<DatosTab campania="2025-2026" />);

    expect(screen.queryByRole("button", { name: "Confirmar importación" })).not.toBeInTheDocument();
    expect(screen.getByText("CAMURRI S.A.")).toBeInTheDocument();
    // El nombre de MacroGest suele decir cuál no usar: se muestra entero, sin recortar.
    expect(screen.getByRole("option", { name: /CAMURRI HERMANOS \(NO USAR\)/ })).toBeInTheDocument();

    const selector = screen.getByRole("combobox", { name: /Productor para CAMURRI/i });
    expect(screen.getByText(/Falta 1/)).toBeInTheDocument();

    fireEvent.change(selector, { target: { value: "769" } });
    expect(screen.queryByText(/Falta 1/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Listo\. Volvé a analizar para que el archivo entre completo/i),
    ).toBeInTheDocument();
  });

  it("reenvia las elecciones al volver a analizar", () => {
    planPreview = vistaPlan({
      puedeConfirmar: false,
      pendientes: [
        {
          filaId: "legacy:ventas:65",
          hoja: "Ventas consolidado Clientes",
          fila: 65,
          razonSocialArchivo: "CAMURRI S.A.",
          cuitEnmascarado: "*******5153",
          candidatos: [
            { productorId: 769, cuentaMacroGest: 769, razonSocial: "CAMURRI S.A." },
          ],
        },
      ],
    });
    render(<DatosTab campania="2025-2026" />);

    const entrada = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(entrada, { target: { files: [archivo()] } });
    fireEvent.change(screen.getByRole("combobox", { name: /Productor para CAMURRI/i }), {
      target: { value: "769" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analizar de nuevo" }));

    expect(previewPlan).toHaveBeenCalledWith(
      expect.objectContaining({ resoluciones: { "legacy:ventas:65": 769 } }),
    );
  });

  it("avisa cuando quedan hectareas sin costo, que dejan el mercado incompleto", () => {
    planPreview = vistaPlan({
      mercadoDespues: {
        hectareasTotales: 264140,
        mercadoUsd: 90000000,
        completo: false,
        hectareasSinCosto: 7416,
        cultivosSinCosto: ["otro"],
      },
    });
    render(<DatosTab campania="2025-2026" />);

    expect(screen.getByText(/7\.416 hectáreas quedan sin valorizar/i)).toBeInTheDocument();
  });

  it("confirma el plan con el token de la vista previa", () => {
    planPreview = vistaPlan();
    render(<DatosTab campania="2025-2026" />);

    const entrada = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(entrada, { target: { files: [archivo()] } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar importación" }));

    expect(confirmarPlan).toHaveBeenCalledWith(
      expect.objectContaining({ campania: "2025-2026", tokenPreview: "tok-1" }),
    );
  });

  it("ofrece leer Bayer del share cuando la app llega al archivo", () => {
    shareDisponible = true;
    render(<DatosTab campania="2025-2026" />);

    expect(screen.getByRole("button", { name: "Leer del share" })).toBeInTheDocument();
  });

  it("si no llega al share explica por que y deja subir el archivo a mano", () => {
    shareDisponible = false;
    render(<DatosTab campania="2025-2026" />);

    expect(screen.queryByRole("button", { name: "Leer del share" })).not.toBeInTheDocument();
    expect(screen.getByText(/no se encontró la carpeta/i)).toBeInTheDocument();
  });

  it("avisa cuando filas de Bayer no cruzan con el padron", () => {
    bayerPreview = {
      confirmado: false,
      yaImportado: false,
      puedeConfirmar: true,
      tokenPreview: "tok-b",
      nombreArchivo: "PLAN DE VENTAS.xlsx",
      formato: "plan-ventas",
      campanias: ["2025-2026"],
      filas: 1062,
      filasConProductor: 1000,
      filasConPlanAlImportar: 900,
      filasSinCoincidencia: 62,
      filasAmbiguas: 0,
      filasProductorDeshabilitado: 0,
      filasCuitInvalido: 0,
      filasVendedorPendiente: 0,
      filasSinVendedorPorDefinicion: 0,
      filasVendedorDiferente: 0,
      totalArchivoUsd: 7195518.78,
      totalConProductorUsd: 7000000,
      totalConPlanAlImportarUsd: 6800000,
      pendientes: [],
    };
    render(<DatosTab campania="2025-2026" />);

    expect(screen.getByText(/62 filas no encontraron productor/i)).toBeInTheDocument();
    expect(screen.getByText("US$ 7.195.518,78")).toBeInTheDocument();
  });

  it("dice en que campania va a quedar el plan antes de confirmar", () => {
    planPreview = vistaPlan({ campania: "2026-2027" });
    render(<DatosTab campania="2026-2027" />);

    expect(screen.getByText(/Se va a cargar en la campaña/i)).toBeInTheDocument();
    expect(screen.getByText("2026-2027")).toBeInTheDocument();
  });

  it("explica que hojas del Excel se leen, sin tener que preguntar", () => {
    render(<DatosTab campania="2025-2026" />);

    expect(screen.getByText("Ventas consolidado Clientes")).toBeInTheDocument();
    expect(screen.getByText("Market Share.")).toBeInTheDocument();
  });

  it("para una fila que MacroGest no conoce, la unica salida es no importarla", () => {
    planPreview = vistaPlan({
      puedeConfirmar: false,
      pendientes: [
        {
          filaId: "legacy:ventas:305",
          hoja: "Ventas consolidado Clientes",
          fila: 305,
          razonSocialArchivo: "FOCO RAMIRO",
          cuitEnmascarado: null,
          candidatos: [],
        },
      ],
    });
    render(<DatosTab campania="2025-2026" />);

    const entrada = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(entrada, { target: { files: [archivo()] } });
    const selector = screen.getByRole("combobox", { name: /Productor para FOCO RAMIRO/i });
    fireEvent.change(selector, { target: { value: "0" } });

    // Cero es "omitir" en el contrato del backend, y cuenta como decidida.
    expect(screen.queryByText(/Falta/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Analizar de nuevo" }));
    expect(previewPlan).toHaveBeenCalledWith(
      expect.objectContaining({ resoluciones: { "legacy:ventas:305": 0 } }),
    );
  });
});
