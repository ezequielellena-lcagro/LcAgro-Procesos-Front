import { apiClient } from "@/lib/api-client";
import type {
  AcuerdoObjetivoVendedorRequest,
  BayerShareEstadoDto,
  ImportacionBayerDto,
  ImportacionPlanSiembraDto,
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
  SincronizacionProductoresDto,
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

/**
 * Campañas que ya tienen plan de siembra cargado, de la más reciente a la más vieja.
 * Sirve para abrir el tablero donde hay datos: la campaña vigente por almanaque arranca en abril
 * y suele estar vacía durante meses, y abrir ahí hace parecer que el módulo no anda.
 */
export async function listarCampaniasConPlan(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>(`${BASE}/plan-siembra/campanias-con-plan`);
  return data;
}

/**
 * Copia el padrón de clientes de MacroGest a la base propia. Es un upsert por cuenta: pisa los
 * datos que manda el ERP y respeta los locales (si el productor participa del proceso, la
 * sucursal). Nunca escribe en MacroGest.
 */
export async function sincronizarPadronProductores(): Promise<SincronizacionProductoresDto> {
  const { data } = await apiClient.post<SincronizacionProductoresDto>(
    `${BASE}/productores/sincronizar`,
  );
  return data;
}

/* ── Importación del PLAN DE VENTAS.xlsx ─────────────────────────────────── */

/**
 * Analiza el Excel sin escribir nada y devuelve un token. El backend reconoce el archivo del
 * cliente tal cual viene: razón social en A, CUIT en B y los cultivos en D:G de la hoja de ventas
 * consolidadas, más los costos de la hoja "Market Share.".
 */
export async function previsualizarPlanSiembra(
  archivo: File,
  campania: string,
  vigenteDesde: string,
  resoluciones?: Record<string, number>,
): Promise<ImportacionPlanSiembraDto> {
  const cuerpo = new FormData();
  cuerpo.append("file", archivo);
  if (resoluciones && Object.keys(resoluciones).length > 0) {
    cuerpo.append("resolucionesJson", JSON.stringify(resoluciones));
  }
  const { data } = await apiClient.post<ImportacionPlanSiembraDto>(
    `${BASE}/plan-siembra/import`,
    cuerpo,
    { params: { campania, vigenteDesde } },
  );
  return data;
}

/**
 * Escribe el plan y los costos. Exige el token de una vista previa vigente: si el archivo cambió
 * entre el análisis y la confirmación, el backend rechaza la operación en vez de importar otra cosa.
 *
 * `vigenteDesde` tiene que ser EL MISMO que se usó al previsualizar, porque entra en el cálculo del
 * token. Sale de `vigenteDesde` de la respuesta anterior, no de un `new Date()` nuevo.
 */
export async function confirmarPlanSiembra(
  archivo: File,
  campania: string,
  vigenteDesde: string,
  tokenPreview: string,
  resoluciones?: Record<string, number>,
): Promise<ImportacionPlanSiembraDto> {
  const cuerpo = new FormData();
  cuerpo.append("file", archivo);
  if (resoluciones && Object.keys(resoluciones).length > 0) {
    cuerpo.append("resolucionesJson", JSON.stringify(resoluciones));
  }
  const { data } = await apiClient.post<ImportacionPlanSiembraDto>(
    `${BASE}/plan-siembra/import`,
    cuerpo,
    { params: { campania, vigenteDesde, confirmar: true, tokenPreview } },
  );
  return data;
}

export async function previsualizarBayer(archivo: File): Promise<ImportacionBayerDto> {
  const cuerpo = new FormData();
  cuerpo.append("file", archivo);
  const { data } = await apiClient.post<ImportacionBayerDto>(
    `${BASE}/ventas/bayer/import`,
    cuerpo,
  );
  return data;
}

export async function confirmarBayer(
  archivo: File,
  tokenPreview: string,
): Promise<ImportacionBayerDto> {
  const cuerpo = new FormData();
  cuerpo.append("file", archivo);
  const { data } = await apiClient.post<ImportacionBayerDto>(
    `${BASE}/ventas/bayer/import`,
    cuerpo,
    { params: { confirmar: true, tokenPreview } },
  );
  return data;
}

/** Si la app llega al archivo de comisiones del share, se puede importar sin subir nada. */
export async function obtenerEstadoShareBayer(): Promise<BayerShareEstadoDto> {
  const { data } = await apiClient.get<BayerShareEstadoDto>(`${BASE}/ventas/bayer/share/estado`);
  return data;
}

export async function previsualizarBayerDesdeShare(): Promise<ImportacionBayerDto> {
  const { data } = await apiClient.post<ImportacionBayerDto>(`${BASE}/ventas/bayer/share/import`);
  return data;
}

export async function confirmarBayerDesdeShare(
  tokenPreview: string,
): Promise<ImportacionBayerDto> {
  const { data } = await apiClient.post<ImportacionBayerDto>(
    `${BASE}/ventas/bayer/share/import`,
    null,
    { params: { confirmar: true, tokenPreview } },
  );
  return data;
}
