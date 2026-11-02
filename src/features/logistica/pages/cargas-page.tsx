import { FileSpreadsheet, History, Pencil } from "lucide-react";
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
import { fecha, hoy, kg, sumarDias } from "../format";
import { cuerpoCarga, estadoElegido } from "../lib/carga";
import { ESTADOS_CARGA, tonoEstado } from "../lib/estados-carga";
import { filtrosComercialesVacios, paramsComerciales } from "../lib/filtros-comerciales";
import { usePaginacion } from "../lib/paginacion";
import { useListado, useOperacion } from "../queries/use-logistica";
import type { CargaLogistica, CargaPropia } from "../types";
import { AvisoDemo } from "../components/aviso-demo";
import { BotonIcono } from "../components/boton-icono";
import { CargaDialog } from "../components/carga-dialog";
import { CatalogoSelect } from "../components/catalogo-select";
import { FiltrosComercialesCampos } from "../components/filtros-comerciales";
import { HistorialDialog } from "../components/historial-dialog";
import { Paginacion } from "../components/paginacion";
import { PeriodoFiltro } from "../components/periodo-filtro";
import { PlanCargaBoton } from "../components/plan-carga-boton";
import { TablaLogistica } from "../components/tabla-logistica";

const filtrosVacios = {
  ...filtrosComercialesVacios,
  contrato: "",
  productorNumero: 0,
  planta: "",
  estado: "",
};
const kilos = (v: number | null) => (v == null ? "—" : kg(v));
const guion = (v: string | null | undefined) => (v && v.trim() ? v.trim() : "—");

/**
 * Cargas a puerto como la planilla de logística (pedido de Ezequiel, 2026-10-29): una fila por cupo
 * de MacroGest en planta 10 (DIRECTO) o 15 (PLANTA), con las mismas columnas. Lo que MacroGest
 * tiene se completa solo; el estado se elige del desplegable y, si nadie lo toca, sale de
 * MacroGest. Camión, humedad y observaciones se cargan acá.
 */
export function CargasPage() {
  const { user } = useAuth();
  const gestionar = user?.roles.includes("logistica-cargas") ?? false;
  const [periodo, setPeriodo] = useState(() => ({
    desde: sumarDias(hoy(), -7),
    hastaExclusivo: sumarDias(hoy(), 8),
  }));
  const [borrador, setBorrador] = useState(filtrosVacios);
  const [filtros, setFiltros] = useState(borrador);
  const [editar, setEditar] = useState<CargaLogistica | null>(null);
  const [historia, setHistoria] = useState<CargaLogistica | null>(null);
  const params = {
    ...periodo,
    ...paramsComerciales(filtros),
    contrato: filtros.contrato.trim() || undefined,
    productorNumero: filtros.productorNumero || undefined,
    planta: filtros.planta || undefined,
  };
  const q = useListado<CargaLogistica>(
    "cargas",
    params,
    (f) => ({
      despuesFecha: f.fechaCarga,
      despuesContrato: f.contrato,
      despuesPlan: f.plan,
      despuesCupo: f.cupo,
    }),
    true,
    undefined,
    50,
  );
  const paginacion = usePaginacion(q);
  // El estado puede salir de MacroGest al leer, así que se filtra sobre lo leído.
  const filas = paginacion.filas.filter((f) => !filtros.estado || f.estado === filtros.estado);
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
        subtitle="La planilla de cargas: cada cupo otorgado en MacroGest con lo que ya dice MacroGest. Acá se elige el estado, el camión y se anota humedad y calidad."
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
        <FiltrosComercialesCampos
          value={borrador}
          onChange={(v) => setBorrador({ ...borrador, ...v })}
          onClear={() => {
            setBorrador(filtrosVacios);
            setFiltros(filtrosVacios);
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
            titulo="Cargo"
            required={false}
            modoFiltro
            value={borrador.productorNumero}
            onChange={(productorNumero) => setBorrador({ ...borrador, productorNumero })}
          />
          <FilterField label="Carga en">
            <Select
              className="w-36"
              value={borrador.planta}
              onChange={(e) => setBorrador({ ...borrador, planta: e.target.value })}
            >
              <option value="">Todas</option>
              <option value="15">PLANTA</option>
              <option value="10">DIRECTO</option>
            </Select>
          </FilterField>
          <FilterField label="Estado">
            <Select
              className="w-52"
              value={borrador.estado}
              onChange={(e) => setBorrador({ ...borrador, estado: e.target.value })}
            >
              <option value="">Todos</option>
              {ESTADOS_CARGA.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
          </FilterField>
        </FiltrosComercialesCampos>
      </PeriodoFiltro>
      <TablaLogistica
        titulo="Cargas a puerto"
        filas={filas}
        clave={(f) => `${f.contrato}/${f.plan}/${f.cupo}`}
        cargando={q.isLoading}
        error={q.error}
        reintentar={() => void q.refetch()}
        pie={<Paginacion {...paginacion} unidad={{ singular: "carga", plural: "cargas" }} />}
        vacio="No hay cupos otorgados en MacroGest para estas fechas y filtros."
        columnas={[
          { titulo: "Fecha", celda: (f) => fecha(f.fechaCarga) },
          {
            titulo: "Estado",
            celda: (f) => (gestionar ? <EstadoCelda carga={f} /> : <EstadoTexto carga={f} />),
          },
          { titulo: "Producto", celda: (f) => guion(f.productoNombre) },
          { titulo: "Cargo", celda: (f) => guion(f.cargo) },
          {
            titulo: "Camión",
            celda: (f) =>
              f.propio?.camion ? (
                <span>
                  {f.propio.camion.conductor ?? f.propio.camion.patenteChasis}
                  {f.propio.camion.conductor && (
                    <span className="block text-xs text-ink-soft">
                      {f.propio.camion.patenteChasis}
                    </span>
                  )}
                </span>
              ) : (
                "—"
              ),
          },
          {
            titulo: "Valor",
            numero: true,
            celda: (f) =>
              f.propio?.camion?.importeReferencia != null
                ? new Intl.NumberFormat("es-AR").format(f.propio.camion.importeReferencia)
                : "—",
          },
          {
            titulo: "Contrato",
            celda: (f) => (
              <span>
                {f.contrato}
                <span className="block text-xs text-ink-soft">
                  Plan {f.plan} · cupo {f.cupo}
                  {f.codigoOtorgado ? ` · ${f.codigoOtorgado}` : ""}
                </span>
              </span>
            ),
          },
          {
            titulo: "Humedad",
            numero: true,
            celda: (f) => (f.propio?.humedad != null ? `${f.propio.humedad}` : "—"),
          },
          { titulo: "Obs. calidad", celda: (f) => guion(f.propio?.obsCalidad) },
          { titulo: "Puerto", celda: (f) => guion(f.puerto) },
          { titulo: "Carga en", celda: (f) => f.cargaEn },
          {
            titulo: "Patente",
            celda: (f) => guion(f.patente ?? f.propio?.camion?.patenteChasis),
          },
          { titulo: "Kilos carga", numero: true, celda: (f) => kilos(f.kgCarga) },
          { titulo: "Kilos desc.", numero: true, celda: (f) => kilos(f.kgDescarga) },
          {
            titulo: "Dif. kilos",
            numero: true,
            celda: (f) =>
              f.difKilos == null ? (
                "—"
              ) : (
                <span className={f.difKilos < 0 ? "text-rojo" : undefined}>
                  {new Intl.NumberFormat("es-AR").format(f.difKilos)}
                </span>
              ),
          },
          { titulo: "Carta de porte", celda: (f) => guion(f.cartaPorte) },
          {
            titulo: "Acciones",
            celda: (f) => (
              <div className="flex gap-1">
                {gestionar && (
                  <BotonIcono
                    icono={Pencil}
                    etiqueta="Camión, humedad y observaciones"
                    onClick={() => setEditar(f)}
                  />
                )}
                {f.otorgamientoId && <PlanCargaBoton otorgamientoId={f.otorgamientoId} soloIcono />}
                {f.propio && (
                  <BotonIcono icono={History} etiqueta="Historial" onClick={() => setHistoria(f)} />
                )}
              </div>
            ),
          },
        ]}
      />
      {editar && <CargaDialog carga={editar} onClose={() => setEditar(null)} />}
      {historia?.propio && (
        <HistorialDialog
          recurso="cargas"
          id={historia.propio.id}
          descripcion={`Contrato ${historia.contrato} · plan ${historia.plan} · cupo ${historia.cupo}`}
          onClose={() => setHistoria(null)}
        />
      )}
    </>
  );
}

function EstadoTexto({ carga }: { carga: CargaLogistica }) {
  return <span className={`whitespace-nowrap ${tonoEstado(carga.estado)}`}>{carga.estado}</span>;
}

/**
 * El estado se cambia en la misma fila, como el desplegable de la planilla. Muestra el que vale:
 * el elegido o, si nadie eligió o MacroGest ya está más adelante en el ciclo, el de MacroGest.
 */
function EstadoCelda({ carga }: { carga: CargaLogistica }) {
  const mutation = useOperacion<CargaPropia>("cargas", "put");
  return (
    <span className="flex flex-col gap-0.5">
      <Select
        aria-label={`Estado del cupo ${carga.contrato} plan ${carga.plan} cupo ${carga.cupo}`}
        className={`h-8 w-48 text-xs ${tonoEstado(carga.estado)}`}
        disabled={mutation.isPending}
        value={carga.estado}
        onChange={(e) =>
          mutation.mutate(cuerpoCarga(carga, { estado: estadoElegido(carga, e.target.value) }), {
            onError: () => undefined,
          })
        }
      >
        {ESTADOS_CARGA.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </Select>
      {mutation.error && (
        <span role="alert" className="text-xs text-rojo">
          {toAppError(mutation.error).message}
        </span>
      )}
    </span>
  );
}
