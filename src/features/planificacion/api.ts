import { apiClient } from "@/lib/api-client";
import type {
  AcuerdoObjetivoVendedorRequest,
  GuardadoMatrizSegmentacionDto,
  GuardadoObjetivosDto,
  MatrizSegmentacionDto,
  MatrizSegmentacionRequest,
  ObjetivosConsulta,
  ObjetivosDto,
  ObjetivosRequest,
  ProductorTableroDetalleDto,
  ProductorPlanificacionHistoricoDto,
  PrevisualizacionMatrizSegmentacionDto,
  ReferenciaSnapshotPlanificacion,
  SegmentacionFiltros,
  SegmentacionListadoDto,
  SnapshotPlanificacionDto,
  SnapshotsPlanificacionFiltros,
  TableroFiltros,
  TableroPlanificacionHistoricoDto,
  TableroPlanificacionDto,
} from "./types";

const BASE = "/planificacion-vendedores";

export async function obtenerTablero(filtros: TableroFiltros): Promise<TableroPlanificacionDto> {
  const { data } = await apiClient.get<TableroPlanificacionDto>(`${BASE}/tablero`, {
    params: {
      campania: filtros.campania,
      q: filtros.q || undefined,
      vendedorCodigo: filtros.vendedorCodigo,
      segmento: filtros.segmento,
      canal: filtros.canal,
      orden: filtros.orden ?? "Oportunidad",
      page: filtros.page ?? 1,
      pageSize: filtros.pageSize ?? 50,
    },
  });
  return data;
}

export async function obtenerDetalleProductorTablero(
  productorId: number,
  campania: string,
): Promise<ProductorTableroDetalleDto> {
  const { data } = await apiClient.get<ProductorTableroDetalleDto>(
    `${BASE}/tablero/productores/${productorId}`,
    { params: { campania } },
  );
  return data;
}

export async function listarSnapshotsPlanificacion(
  filtros: SnapshotsPlanificacionFiltros,
): Promise<SnapshotPlanificacionDto[]> {
  const { data } = await apiClient.get<SnapshotPlanificacionDto[]>(`${BASE}/snapshots`, {
    params: {
      campania: filtros.campania || undefined,
      desde: filtros.desde,
      hasta: filtros.hasta,
    },
  });
  return data;
}

export async function obtenerTableroSnapshot(
  snapshot: ReferenciaSnapshotPlanificacion,
  filtros: TableroFiltros,
): Promise<TableroPlanificacionHistoricoDto> {
  const { data } = await apiClient.get<TableroPlanificacionHistoricoDto>(
    `${BASE}/snapshots/${snapshot.id}/tablero`,
    {
      params: {
        sha256: snapshot.sha256,
        q: filtros.q || undefined,
        vendedorCodigo: filtros.vendedorCodigo,
        segmento: filtros.segmento,
        canal: filtros.canal,
        orden: filtros.orden ?? "Oportunidad",
        page: filtros.page ?? 1,
        pageSize: filtros.pageSize ?? 50,
      },
    },
  );
  return data;
}

export async function obtenerDetalleProductorSnapshot(
  snapshot: ReferenciaSnapshotPlanificacion,
  productorId: number,
): Promise<ProductorPlanificacionHistoricoDto> {
  const { data } = await apiClient.get<ProductorPlanificacionHistoricoDto>(
    `${BASE}/snapshots/${snapshot.id}/productores/${productorId}`,
    { params: { sha256: snapshot.sha256 } },
  );
  return data;
}

export async function listarSegmentacion(
  filtros: SegmentacionFiltros,
): Promise<SegmentacionListadoDto> {
  const { data } = await apiClient.get<SegmentacionListadoDto>(`${BASE}/segmentacion`, {
    params: {
      campania: filtros.campania,
      q: filtros.q || undefined,
      vendedorCodigo: filtros.vendedorCodigo,
      segmento: filtros.segmento,
      page: filtros.page ?? 1,
      pageSize: filtros.pageSize ?? 50,
    },
  });
  return data;
}

export async function obtenerMatrizSegmentacion(campania: string): Promise<MatrizSegmentacionDto> {
  const { data } = await apiClient.get<MatrizSegmentacionDto>(`${BASE}/segmentacion/matriz`, {
    params: { campania },
  });
  return data;
}

export async function previsualizarMatrizSegmentacion(
  request: MatrizSegmentacionRequest,
): Promise<PrevisualizacionMatrizSegmentacionDto> {
  const { data } = await apiClient.post<PrevisualizacionMatrizSegmentacionDto>(
    `${BASE}/segmentacion/matriz/preview`,
    request,
  );
  return data;
}

export async function guardarMatrizSegmentacion(
  request: MatrizSegmentacionRequest,
): Promise<GuardadoMatrizSegmentacionDto> {
  const { data } = await apiClient.put<GuardadoMatrizSegmentacionDto>(
    `${BASE}/segmentacion/matriz`,
    request,
  );
  return data;
}

export async function obtenerObjetivos(consulta: ObjetivosConsulta): Promise<ObjetivosDto> {
  const { data } = await apiClient.get<ObjetivosDto>(`${BASE}/objetivos`, {
    params: {
      campania: consulta.campania,
      linea: consulta.linea,
      vigenteEn: consulta.vigenteEn,
    },
  });
  return data;
}

export async function previsualizarObjetivos(request: ObjetivosRequest): Promise<ObjetivosDto> {
  const { data } = await apiClient.post<ObjetivosDto>(`${BASE}/objetivos/preview`, request);
  return data;
}

export async function guardarObjetivos(request: ObjetivosRequest): Promise<GuardadoObjetivosDto> {
  const { data } = await apiClient.put<GuardadoObjetivosDto>(`${BASE}/objetivos`, request);
  return data;
}

export async function acordarObjetivo(
  request: AcuerdoObjetivoVendedorRequest,
): Promise<GuardadoObjetivosDto> {
  const { data } = await apiClient.put<GuardadoObjetivosDto>(`${BASE}/objetivos/acuerdo`, request);
  return data;
}
