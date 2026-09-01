import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { acordarObjetivo, guardarObjetivos, previsualizarObjetivos } from "../api";
import type { ObjetivosDto } from "../types";
import { ObjetivosTab } from "./objetivos-tab";

vi.mock("../api", () => ({
  acordarObjetivo: vi.fn(),
  guardarObjetivos: vi.fn(),
  obtenerObjetivos: vi.fn(),
  previsualizarObjetivos: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function objetivos(valor = 0.13): ObjetivosDto {
  return {
    campania: "2025-2026",
    campaniaBase: "2024-2025",
    revision: 3,
    configurado: true,
    modoReparto: "plano",
    factorOportunidadFraccion: 0.15,
    avanceEsperadoFraccion: 0.4,
    vigenteDesde: "2026-08-26T12:00:00Z",
    vigenteHasta: null,
    fuenteOperativa: {
      tipo: "operativa",
      campaniaBase: "2024-2025",
      campaniaAvance: "2025-2026",
      desdeBase: "2024-04-01",
      hastaBaseExclusivo: "2025-04-01",
      desdeAvance: "2025-04-01",
      hastaAvanceExclusivo: "2026-04-01",
      consultadoEn: "2026-08-26T12:00:00Z",
      bayerBaseDisponible: true,
      bayerAvanceDisponible: true,
      bayerBaseImportacionId: 1,
      bayerBaseImportadoEn: null,
      bayerBaseArchivo: null,
      bayerAvanceImportacionId: 2,
      bayerAvanceImportadoEn: null,
      bayerAvanceArchivo: null,
      facturacionLcBaseUsd: 100,
      facturacionBayerBaseUsd: 0,
      facturacionTotalBaseUsd: 100,
      mercadoAvanceConocidoUsd: 200,
      mercadoAvanceCompleto: true,
      productoresAvance: 1,
      productoresConPlanAvance: 1,
      productoresMercadoIncompletoAvance: 0,
      descripcion: "Fuente de prueba",
    },
    referenciaHistorica: {
      disponible: false,
      campaniaBase: null,
      facturacionLcUsd: null,
      facturacionBayerUsd: null,
      facturacionTotalUsd: null,
      mercadoUsd: null,
      objetivoLcMasTreceUsd: null,
      estado: "sin_referencia",
    },
    coherencia: {
      evaluable: false,
      hayContradiccion: false,
      toleranciaFraccion: 0.05,
      baseGeneralUsd: null,
      objetivoGeneralUsd: null,
      baseBayerDetalleUsd: null,
      objetivoBayerDetalleUsd: null,
      crecimientoBayerGeneralFraccion: null,
      crecimientoBayerDetalleFraccion: null,
      motivoNoEvaluable: null,
    },
    avisos: [],
    lineas: [
      {
        linea: "facturacion_lc",
        nombre: "Facturación LC",
        unidad: "USD",
        tipo: "crecimiento_porcentual",
        valor,
        base: "lc",
        proporcionBase: 1,
        fuenteProporcion: null,
        esAgregada: false,
        medible: true,
        motivoNoMedible: null,
        baseCompaniaUsd: 100,
        realCompaniaUsd: 40,
        objetivoCompaniaUsd: 113,
        objetivoEfectivoUsd: 113,
        diferenciaAcordadaUsd: 0,
        vendedores: [
          {
            vendedorCodigo: 8,
            vendedor: "Vendedor de prueba",
            fueraDeReparto: false,
            productores: 1,
            mercadoCarteraUsd: 200,
            baseAnteriorUsd: 100,
            realAcumuladoUsd: 40,
            participacionFraccion: 0.2,
            crecimientoAplicadoFraccion: valor,
            objetivoPlanoUsd: 113,
            objetivoDerivadoUsd: 113,
            objetivoAcordadoUsd: null,
            objetivoEfectivoUsd: 113,
            avanceFraccion: 40 / 113,
            nota: null,
            acordadoPorUsuarioId: null,
            acordadoPor: null,
            acordadoEn: null,
            vigenteDesde: "2026-08-26T12:00:00Z",
            vigenteHasta: null,
          },
        ],
      },
    ],
  };
}

function renderizar(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("ObjetivosTab", () => {
  beforeEach(() => vi.clearAllMocks());

  it("descarta preview y borrador cuando guardar informa que no hubo cambios", async () => {
    const persistidos = objetivos();
    vi.mocked(previsualizarObjetivos).mockResolvedValue(objetivos(0.14));
    vi.mocked(guardarObjetivos).mockResolvedValue({
      objetivos: persistidos,
      sinCambios: true,
    });
    renderizar(<ObjetivosTab objetivos={persistidos} />);

    const acordar = screen.getByRole("button", { name: "Acordar" });
    fireEvent.change(screen.getByLabelText("Crecimiento de Facturación LC"), {
      target: { value: "14" },
    });
    expect(acordar).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Previsualizar" }));
    await waitFor(() => expect(previsualizarObjetivos).toHaveBeenCalledOnce());
    fireEvent.click(await screen.findByRole("button", { name: "Guardar objetivos" }));
    await waitFor(() => expect(guardarObjetivos).toHaveBeenCalledOnce());

    await waitFor(() => expect(acordar).toBeEnabled());
    expect(screen.queryByText("Cambios sin previsualizar")).not.toBeInTheDocument();
  });

  it("explica un importe acordado inválido y no llama a la API", async () => {
    renderizar(<ObjetivosTab objetivos={objetivos()} />);
    fireEvent.click(screen.getByRole("button", { name: "Acordar" }));
    fireEvent.change(screen.getByLabelText("Objetivo acordado (USD)"), {
      target: { value: "-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar acuerdo" }));

    expect(
      await screen.findByText("Ingresá un importe válido mayor o igual a cero."),
    ).toBeInTheDocument();
    expect(acordarObjetivo).not.toHaveBeenCalled();
  });

  it("presenta un snapshot como sólo lectura sin acciones de escritura", () => {
    renderizar(<ObjetivosTab objetivos={objetivos()} soloLectura />);

    expect(screen.getByText("Sólo lectura")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previsualizar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar objetivos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Acordar" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Crecimiento de Facturación LC")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mismo % para todos" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ajustado por oportunidad" })).toBeDisabled();
    expect(screen.getAllByText("Real al corte")).toHaveLength(2);
    expect(screen.queryByText("Real a hoy")).not.toBeInTheDocument();
  });
});
