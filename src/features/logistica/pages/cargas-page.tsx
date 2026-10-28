import { FileSpreadsheet, History, Truck } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-context";
import { apiClient } from "@/lib/api-client";
import { toAppError } from "@/lib/api-error";
import { FilterField } from "@/shared/components/filter-bar";
import { PageHeader } from "@/shared/components/page-header";
import { downloadBlob, filenameFromContentDisposition } from "@/shared/export/download-blob";
import { diaArgentina, fecha, hoy, kg, sumarDias } from "../format";
import { useListado } from "../queries/use-logistica";
import type { CargaLogistica, EstadoCarga } from "../types";
import { AvisoDemo } from "../components/aviso-demo";
import { CargaDialog } from "../components/carga-dialog";
import { CatalogoSelect } from "../components/catalogo-select";
import { FiltrosComercialesCampos } from "../components/filtros-comerciales";
import {
  filtrosComercialesIniciales,
  filtrosComercialesVacios,
  paramsComerciales,
} from "../lib/filtros-comerciales";
import { HistorialDialog } from "../components/historial-dialog";
import { PeriodoFiltro } from "../components/periodo-filtro";
import { BotonIcono } from "../components/boton-icono";
import { PlanCargaBoton } from "../components/plan-carga-boton";
import { TablaLogistica } from "../components/tabla-logistica";

/** Cómo se lee cada estado; sale de MacroGest en cada consulta. */
const ESTADO_CARGA: Record<EstadoCarga, string> = {
  falta_pasar: "Falta pasarlo en MacroGest",
  por_cargar: "Por cargar",
  en_viaje: "En viaje",
  descargado: "Descargado",
  revisar: "Revisar en MacroGest",
  no_esta: "Ya no está en MacroGest",
  sin_verificar: "Sin verificar",
};
const filtrosVacios = { contrato: "", clienteNumero: 0, estado: "", ...filtrosComercialesVacios };
/** Arranca en la campaña vigente; «Limpiar filtros» muestra todas. */
const filtrosIniciales = () => ({ ...filtrosVacios, ...filtrosComercialesIniciales() });
/** Kilos de MacroGest: vienen como texto exacto; vacío es guion. */
const kgErp = (v: string | number | null | undefined) =>
  v == null || v === "" ? "—" : kg(Number(v));
const oDash = (v: string | null | undefined) => (v && v.trim() ? v.trim() : "—");

/**
 * Cargas a puerto, leyendo MacroGest (devolución del 2026-10-23, tramo 5). Cada cupo otorgado
 * muestra carta de porte, CTG, patente y kilos de carga y descarga de MacroGest, y el estado sale
 * de ahí. Lo propio es el camión de Flete y una observación.
 */
export function CargasPage() {
  const { user } = useAuth();
  const gestionar = user?.roles.includes("logistica-cargas") ?? false;
  const [periodo, setPeriodo] = useState(() => ({
    desde: sumarDias(hoy(), -30),
    hastaExclusivo: sumarDias(hoy(), 1),
  }));
  const [borrador, setBorrador] = useState(filtrosIniciales);
  const [filtros, setFiltros] = useState(borrador);
  const [editar, setEditar] = useState<CargaLogistica | null>(null);
  const [historia, setHistoria] = useState<CargaLogistica | null>(null);
  const params = {
    ...periodo,
    contrato: filtros.contrato.trim() || undefined,
    clienteNumero: filtros.clienteNumero || undefined,
    // Cereal y campaña del pedido al que se otorgó el cupo.
    ...paramsComerciales(filtros),
  };
  const q = useListado<CargaLogistica>("cargas", params, (f) => ({
    despuesDia: diaArgentina(f.otorgamiento.otorgamiento.vigenteDesde),
    despuesId: f.otorgamiento.otorgamiento.id,
  }));
  // El estado sale de MacroGest al leer, así que se filtra sobre lo leído.
  const filas = (q.data?.pages.flatMap((p) => p.filas) ?? []).filter(
    (f) => !filtros.estado || f.estado === filtros.estado,
  );
  const excel = useMutation({
    mutationFn: async () => {
      const res = await apiClient.get("/logistica/cargas/excel", { params, responseType: "blob" });
      downloadBlob(
        res.data as Blob,
        filenameFromContentDisposition(res.headers["content-disposition"], "cargas-a-puerto.xlsx"),
      );
    },
  });
  return (
    <>
      <PageHeader
        title="Cargas a puerto"
        subtitle="Cupos otorgados con lo que dice MacroGest: carta de porte, CTG, patente y kilos. Acá se elige el camión y se anota una observación."
        actions={
          <Button variant="outline" disabled={excel.isPending} onClick={() => excel.mutate()}>
            <FileSpreadsheet className="size-4" aria-hidden />{" "}
            {excel.isPending ? "Generando…" : "Exportar XLSX"}
          </Button>
        }
      />
      <AvisoDemo />
      {excel.error && (
        <p role="alert" className="mb-3 text-sm text-rojo">
          {toAppError(excel.error).message}
        </p>
      )}
      <PeriodoFiltro
        value={periodo}
        onChange={setPeriodo}
        onSubmit={(e) => {
          e.preventDefault();
          setFiltros({ ...borrador });
        }}
      >
        <FilterField label="Contrato">
          <Input
            className="w-40"
            maxLength={15}
            value={borrador.contrato}
            onChange={(e) => setBorrador({ ...borrador, contrato: e.target.value })}
          />
        </FilterField>
        <CatalogoSelect
          className="w-56"
          tipo="clientes"
          titulo="Cliente"
          required={false}
          modoFiltro
          value={borrador.clienteNumero}
          onChange={(clienteNumero) => setBorrador({ ...borrador, clienteNumero })}
        />
        <FiltrosComercialesCampos
          value={borrador}
          onChange={(v) => setBorrador({ ...borrador, ...v })}
          onClear={() => {
            setBorrador(filtrosVacios);
            setFiltros(filtrosVacios);
          }}
        >
          <FilterField label="Estado">
            <Select
              className="w-52"
              value={borrador.estado}
              onChange={(e) => setBorrador({ ...borrador, estado: e.target.value })}
            >
              <option value="">Todos</option>
              {Object.entries(ESTADO_CARGA).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </Select>
          </FilterField>
        </FiltrosComercialesCampos>
      </PeriodoFiltro>
      <TablaLogistica
        titulo="Cargas a puerto"
        filas={filas}
        clave={(f) => f.otorgamiento.otorgamiento.id}
        cargando={q.isLoading}
        error={q.error}
        reintentar={() => void q.refetch()}
        hayMas={q.hasNextPage}
        mas={() => void q.fetchNextPage()}
        cargandoMas={q.isFetchingNextPage}
        vacio="No hay cupos otorgados para estas fechas y filtros."
        columnas={[
          {
            titulo: "Estado",
            celda: (f) => (
              <span
                className={
                  ["revisar", "no_esta", "sin_verificar"].includes(f.estado)
                    ? "font-medium text-rojo"
                    : undefined
                }
              >
                {ESTADO_CARGA[f.estado]}
              </span>
            ),
          },
          {
            titulo: "Contrato · plan / cupo",
            celda: (f) =>
              `${f.otorgamiento.otorgamiento.contrato} · ${f.otorgamiento.otorgamiento.plan} / ${f.otorgamiento.otorgamiento.cupo}`,
          },
          { titulo: "Código otorgado", celda: (f) => oDash(f.otorgamiento.erp?.codigoTerminal) },
          {
            titulo: "Fecha de carga",
            celda: (f) =>
              f.otorgamiento.erp?.fechaCarga ? fecha(f.otorgamiento.erp.fechaCarga) : "—",
          },
          {
            titulo: "Productor",
            celda: (f) =>
              f.otorgamiento.otorgamiento.clienteNombre ??
              `Cliente ${f.otorgamiento.otorgamiento.clienteNumero}`,
          },
          { titulo: "Carta de porte", celda: (f) => f.cartaPorte ?? "—" },
          { titulo: "CTG", celda: (f) => oDash(f.otorgamiento.erp?.ctg) },
          { titulo: "Patente", celda: (f) => oDash(f.otorgamiento.erp?.patenteChasis) },
          { titulo: "Kg carga", numero: true, celda: (f) => kgErp(f.otorgamiento.erp?.kgCargaErp) },
          {
            titulo: "Kg descarga",
            numero: true,
            celda: (f) => kgErp(f.otorgamiento.erp?.kgDescargaErp),
          },
          {
            titulo: "Camión (Flete)",
            celda: (f) =>
              f.propio?.camion ? (
                <span>
                  {f.propio.camion.patenteChasis}
                  {f.propio.camion.conductor && (
                    <span className="block text-xs text-ink-soft">{f.propio.camion.conductor}</span>
                  )}
                </span>
              ) : (
                "—"
              ),
          },
          { titulo: "Observación", celda: (f) => f.propio?.observacion ?? "—" },
          {
            titulo: "Acciones",
            celda: (f) => (
              <div className="flex gap-1">
                {gestionar && (
                  <BotonIcono icono={Truck} etiqueta="Camión" onClick={() => setEditar(f)} />
                )}
                <PlanCargaBoton otorgamientoId={f.otorgamiento.otorgamiento.id} soloIcono />
                {f.propio && (
                  <BotonIcono icono={History} etiqueta="Historial" onClick={() => setHistoria(f)} />
                )}
              </div>
            ),
          },
        ]}
      />
      {editar && <CargaDialog carga={editar} onClose={() => setEditar(null)} />}
      {historia && (
        <HistorialDialog
          recurso="cargas"
          id={historia.otorgamiento.otorgamiento.id}
          descripcion={`Contrato ${historia.otorgamiento.otorgamiento.contrato} · plan ${historia.otorgamiento.otorgamiento.plan} · cupo ${historia.otorgamiento.otorgamiento.cupo}`}
          onClose={() => setHistoria(null)}
        />
      )}
    </>
  );
}
