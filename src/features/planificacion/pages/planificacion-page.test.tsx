import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  SnapshotPlanificacionDto,
  TableroFiltros,
  TableroPlanificacionDto,
} from "../types";
import { useSnapshotsPlanificacion } from "../queries/use-snapshots-planificacion";
import { useTableroPlanificacion } from "../queries/use-tablero-planificacion";
import { PlanificacionPage } from "./planificacion-page";

vi.mock("../queries/use-snapshots-planificacion", () => ({
  useSnapshotsPlanificacion: vi.fn(),
}));

vi.mock("../queries/use-tablero-planificacion", () => ({
  useTableroPlanificacion: vi.fn(),
}));

// La página consulta qué campañas tienen plan para abrir donde hay datos. Acá no interesa la
// sugerencia: estos casos fijan la campaña a mano, y sin el mock el hook pide un QueryClient.
vi.mock("../queries/use-campanias-con-plan", async () => ({
  ...(await vi.importActual<typeof import("../queries/use-campanias-con-plan")>(
    "../queries/use-campanias-con-plan",
  )),
  useCampaniasConPlan: () => ({ data: undefined }),
}));

vi.mock("../components/comparacion-fuentes", () => ({
  ComparacionFuentes: () => <div>Tablero visible</div>,
}));
vi.mock("../components/cartera-tab", () => ({
  CarteraTab: ({ onFiltros }: { onFiltros: (filtros: Partial<TableroFiltros>) => void }) => (
    <div>
      Cartera
      <button
        type="button"
        onClick={() => onFiltros({ segmento: "A", canal: "Ambos", page: 3 })}
      >
        Activar filtros de prueba
      </button>
    </div>
  ),
}));
vi.mock("../components/objetivos-tab", () => ({ ObjetivosTab: () => <div>Objetivos</div> }));
vi.mock("../components/segmentacion-modal", () => ({ SegmentacionModal: () => null }));

const FOTO: SnapshotPlanificacionDto = {
  id: 41,
  loteId: "f4b29685-3067-4dd6-b26f-08093e8513f6",
  fecha: "2026-08-27",
  campania: "2026-2027",
  capturadoEn: "2026-08-27T08:30:00-03:00",
  versionEsquema: 1,
  productores: 425,
  bayerImportacionId: 12,
  matrizRevision: 3,
  objetivosRevision: 4,
  sha256: "a".repeat(64),
};

const TABLERO = {
  campania: "2026-2027",
  generadoEn: "2026-08-27T08:30:00-03:00",
  objetivos: { revision: 4 },
} as TableroPlanificacionDto;

function resultadoTablero(
  cambios: Partial<ReturnType<typeof useTableroPlanificacion>> = {},
) {
  return {
    data: TABLERO,
    error: null,
    isError: false,
    isFetching: false,
    isPending: false,
    refetch: vi.fn(),
    ...cambios,
  } as unknown as ReturnType<typeof useTableroPlanificacion>;
}

function resultadoSnapshots(
  cambios: Partial<ReturnType<typeof useSnapshotsPlanificacion>> = {},
) {
  return {
    data: [FOTO],
    error: null,
    isError: false,
    isFetching: false,
    isPending: false,
    refetch: vi.fn(),
    ...cambios,
  } as unknown as ReturnType<typeof useSnapshotsPlanificacion>;
}

describe("cortes del tablero de planificación", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T12:00:00-03:00"));
    vi.clearAllMocks();
    vi.mocked(useTableroPlanificacion).mockReturnValue(resultadoTablero());
    vi.mocked(useSnapshotsPlanificacion).mockReturnValue(resultadoSnapshots());
  });

  afterEach(() => vi.useRealTimers());

  it("cambia a una foto, lo informa y vuelve al vivo al cambiar de campaña", () => {
    render(<PlanificacionPage />);

    fireEvent.change(screen.getByLabelText("Corte"), { target: { value: "41" } });

    expect(useTableroPlanificacion).toHaveBeenLastCalledWith(
      expect.objectContaining({ campania: "2026-2027" }),
      { modo: "snapshot", snapshot: FOTO },
    );
    expect(screen.getByText(/Foto guardada/)).toBeInTheDocument();
    expect(screen.getByText(/Sólo lectura/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Campaña"), {
      target: { value: "2025-2026" },
    });

    expect(screen.getByLabelText("Corte")).toHaveValue("vivo");
    expect(useTableroPlanificacion).toHaveBeenLastCalledWith(
      expect.objectContaining({ campania: "2025-2026" }),
      { modo: "vivo" },
    );
    expect(screen.queryByText(/Foto guardada/)).not.toBeInTheDocument();
  });

  it("mantiene visible el tablero vivo si falla el listado de fotos", () => {
    vi.mocked(useSnapshotsPlanificacion).mockReturnValue(
      resultadoSnapshots({ data: undefined, isError: true, error: new Error("Sin conexión") }),
    );

    render(<PlanificacionPage />);

    // La conciliación vive en su propia solapa; lo que tiene que seguir en pie es la cartera.
    expect(screen.getByText("Cartera")).toBeInTheDocument();
    expect(screen.getByText(/No se pudieron cargar las fotos guardadas/)).toBeInTheDocument();
  });

  it("actualiza tablero y detalle al SHA autoritativo del listado sin cambiar el id", () => {
    const vista = render(<PlanificacionPage />);
    fireEvent.change(screen.getByLabelText("Corte"), { target: { value: "41" } });

    const fotoActualizada = { ...FOTO, sha256: "b".repeat(64) };
    vi.mocked(useSnapshotsPlanificacion).mockReturnValue(
      resultadoSnapshots({ data: [fotoActualizada] }),
    );
    vista.rerender(<PlanificacionPage />);

    expect(useTableroPlanificacion).toHaveBeenLastCalledWith(
      expect.objectContaining({ campania: "2026-2027" }),
      { modo: "snapshot", snapshot: fotoActualizada },
    );
  });

  it("limpia segmento, canal y página al cambiar de corte", () => {
    render(<PlanificacionPage />);
    fireEvent.click(screen.getByRole("button", { name: "Activar filtros de prueba" }));

    expect(useTableroPlanificacion).toHaveBeenLastCalledWith(
      expect.objectContaining({ segmento: "A", canal: "Ambos", page: 3 }),
      { modo: "vivo" },
    );

    fireEvent.change(screen.getByLabelText("Corte"), { target: { value: "41" } });

    expect(useTableroPlanificacion).toHaveBeenLastCalledWith(
      expect.objectContaining({ segmento: undefined, canal: undefined, page: 1 }),
      { modo: "snapshot", snapshot: FOTO },
    );
  });

  it("muestra un estado recuperable cuando la foto seleccionada pierde sus metadatos", () => {
    const reintentar = vi.fn();
    const vista = render(<PlanificacionPage />);
    fireEvent.change(screen.getByLabelText("Corte"), { target: { value: "41" } });

    vi.mocked(useSnapshotsPlanificacion).mockReturnValue(
      resultadoSnapshots({ data: [], refetch: reintentar }),
    );
    vi.mocked(useTableroPlanificacion).mockReturnValue(
      resultadoTablero({ data: undefined, isPending: true }),
    );
    vista.rerender(<PlanificacionPage />);

    expect(useTableroPlanificacion).toHaveBeenLastCalledWith(
      expect.objectContaining({ campania: "2026-2027" }),
      { modo: "snapshot-pendiente", snapshotId: 41 },
    );
    expect(screen.getByText(/metadatos no disponibles/i)).toBeInTheDocument();
    expect(screen.getByText(/No se pudo recuperar la foto seleccionada/i)).toBeInTheDocument();
    expect(screen.queryByText("Tablero visible")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar metadatos" }));
    expect(reintentar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Volver a datos vivos" }));
    expect(useTableroPlanificacion).toHaveBeenLastCalledWith(
      expect.objectContaining({ campania: "2026-2027" }),
      { modo: "vivo" },
    );
  });

  it("inicia la campaña y muestra los cortes con hora de Buenos Aires", () => {
    vi.setSystemTime(new Date("2026-04-01T02:30:00Z"));
    const fotoBorde = {
      ...FOTO,
      campania: "2025-2026",
      capturadoEn: "2026-04-01T02:30:00Z",
    };
    vi.mocked(useSnapshotsPlanificacion).mockReturnValue(
      resultadoSnapshots({ data: [fotoBorde] }),
    );

    render(<PlanificacionPage />);

    expect(screen.getByLabelText("Campaña")).toHaveValue("2025-2026");
    expect(screen.getByRole("option", { name: /31\/3\/26.*23:30/ })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Corte"), { target: { value: "41" } });
    expect(screen.getByText(/Capturada el 31\/3\/26.*23:30/)).toBeInTheDocument();
  });
});
