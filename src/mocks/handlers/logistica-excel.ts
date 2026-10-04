import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import writeXlsxFile, { type Cell, type SheetData } from "write-excel-file/browser";
import { datoVigente, decimalErp } from "@/features/logistica/lib/seguimiento";
import type { ConciliacionFila, DatoOperativo } from "@/features/logistica/types";

type Columna = [string, (f: ConciliacionFila) => string | number | null | undefined];
const instante = (valor: string | null | undefined) =>
  valor
    ? `${new Date(Date.parse(valor) - 3 * 3600000).toISOString().slice(0, 19).replace("T", " ")} -03:00`
    : null;
const fecha = (valor: string | null | undefined) => valor?.slice(0, 10) ?? null;
const siNo = (valor: boolean | null | undefined) => (valor == null ? null : valor ? "Sí" : "No");
function peso(valor: string | number | null | undefined) {
  if (valor == null) return null;
  const canonico = decimalErp(valor);
  if (canonico == null) return null;
  const [entero, decimales = ""] = canonico.split(".");
  // Sólo formato sin pérdida. Los fixtures nunca se redondean para fabricar un peso.
  if (decimales.length > 4)
    throw new Error("El peso ficticio no se puede expresar con cuatro decimales sin pérdida.");
  return `${entero}.${decimales.padEnd(4, "0")}`;
}
function revisionFlota(valor: number | undefined) {
  if (valor === undefined) return null;
  if (!Number.isSafeInteger(valor) || valor < 1)
    throw new Error("La revisión de flota no se puede exportar sin pérdida de precisión.");
  return String(valor);
}
function columnas(consultadoAl: string): Columna[] {
  const columnas: Columna[] = [
    ["Cupo ID", (f) => f.seguimiento.cupoId],
    ["Seguimiento revisión", (f) => f.seguimiento.revision],
    ["Cupo revisión", (f) => f.seguimiento.cupo.revision],
    ["Recepción ID", (f) => f.seguimiento.cupo.tandaId],
    ["Recepción referencia", (f) => f.seguimiento.referenciaRecepcion],
    ["Recepción ordinal", (f) => f.seguimiento.cupo.ordinal],
    ["Contrato venta", (f) => f.seguimiento.cupo.contratoVenta],
    ["Código terminal", (f) => f.seguimiento.cupo.codigoTerminal],
    ["Fecha carga prevista", (f) => fecha(f.seguimiento.cupo.fechaCarga)],
    [
      "Asignación",
      (f) =>
        f.seguimiento.cupo.otorgamientoVigente?.destinatarioTipo === "propio"
          ? "Propio"
          : f.seguimiento.cupo.otorgamientoVigente
            ? "Cliente"
            : "Sin asignar",
    ],
    ["Cliente número", (f) => f.seguimiento.cupo.otorgamientoVigente?.clienteNumero],
    [
      "Cliente nombre",
      (f) =>
        f.seguimiento.cupo.otorgamientoVigente?.destinatarioTipo === "propio"
          ? "Propio"
          : f.seguimiento.cupo.otorgamientoVigente
            ? f.seguimiento.cupo.otorgamientoVigente.clienteNombre
            : "Sin asignar",
    ],
    ["Otorgamiento ID", (f) => f.seguimiento.cupo.otorgamientoVigente?.id],
    ["Otorgamiento revisión", (f) => f.seguimiento.cupo.otorgamientoVigente?.revision],
    ["Pedido ID", (f) => f.seguimiento.cupo.otorgamientoVigente?.pedidoId],
    ["Preventa operación", (f) => f.seguimiento.cupo.otorgamientoVigente?.preventa?.operacion],
    ["Preventa número", (f) => f.seguimiento.cupo.otorgamientoVigente?.preventa?.numero],
    ["Producto código", (f) => f.seguimiento.cupo.producto],
    ["Producto nombre", (f) => f.seguimiento.cupo.productoNombre],
    ["Campaña", (f) => f.seguimiento.cupo.campania],
    ["Destino código", (f) => f.seguimiento.cupo.destinoCodigo],
    ["Destino nombre", (f) => f.seguimiento.cupo.destinoNombre],
    ["Circuito", (f) => f.seguimiento.cupo.circuito],
    ["Lugar tipo", (f) => f.seguimiento.cupo.lugarTipo],
    ["Lugar referencia", (f) => f.seguimiento.cupo.lugarReferencia],
    ["Estado observado", (f) => f.seguimiento.estadoObservado],
    ["Estado fuente", (f) => f.seguimiento.estadoFuente],
    ["Estado observado al (UTC-3)", (f) => instante(f.seguimiento.estadoObservadoAl)],
    ["Estado referencia", (f) => f.seguimiento.estadoReferencia],
  ];
  function agregarDato(
    tipo: DatoOperativo["tipo"],
    titulo: string,
    valor: (dato: DatoOperativo) => string | null,
  ) {
    const dato = (f: ConciliacionFila) => datoVigente(f.seguimiento, tipo);
    columnas.push(
      [titulo, (f) => (dato(f) ? valor(dato(f)!) : null)],
      [`${titulo} fuente`, (f) => dato(f)?.fuente],
      [`${titulo} observado al (UTC-3)`, (f) => instante(dato(f)?.observadoAl)],
      [`${titulo} referencia`, (f) => dato(f)?.referencia],
      [`${titulo} dato ID`, (f) => dato(f)?.id],
      [`${titulo} registrado al (UTC-3)`, (f) => instante(dato(f)?.registradoAl)],
      [`${titulo} registrado por ID`, (f) => dato(f)?.registradoPorId],
      [`${titulo} reemplaza ID`, (f) => dato(f)?.reemplazaId],
      [`${titulo} motivo corrección`, (f) => dato(f)?.motivoCorreccion],
    );
  }
  agregarDato("patente", "Patente operativa", (d) => d.texto);
  agregarDato("kg_carga", "Kg carga operativos", (d) => peso(d.kilogramos));
  agregarDato("kg_descarga", "Kg descarga operativos", (d) => peso(d.kilogramos));
  columnas.push(
    ["Anulado al (UTC-3)", (f) => instante(f.seguimiento.anuladoAl)],
    ["Anulado por ID", (f) => f.seguimiento.anuladoPorId],
    ["Motivo anulación", (f) => f.seguimiento.motivoAnulacion],
    ["Observación", (f) => f.seguimiento.observacion],
    ["Vínculo ERP ID", (f) => f.seguimiento.vinculoErpVigente?.id],
    ["Vínculo ERP contrato", (f) => f.seguimiento.vinculoErpVigente?.contrato],
    ["Vínculo ERP grupo", (f) => f.seguimiento.vinculoErpVigente?.grupo],
    ["Vínculo ERP cupo", (f) => f.seguimiento.vinculoErpVigente?.cupo],
    [
      "Vínculo ERP vigente desde (UTC-3)",
      (f) => instante(f.seguimiento.vinculoErpVigente?.vigenteDesde),
    ],
    ["Vínculo ERP evidencia", (f) => f.seguimiento.vinculoErpVigente?.evidencia],
    ["Vínculo ERP registrado por ID", (f) => f.seguimiento.vinculoErpVigente?.registradoPorId],
    ["Consulta ERP diagnóstico", (f) => f.estadoConsulta],
    [
      "Consulta ERP al (UTC-3)",
      (f) => (f.seguimiento.vinculoErpVigente ? instante(consultadoAl) : null),
    ],
    ["ERP contrato", (f) => f.erp?.contrato],
    ["ERP grupo", (f) => f.erp?.grupo],
    ["ERP cupo", (f) => f.erp?.cupo],
    ["Código terminal ERP", (f) => f.erp?.codigoTerminal],
    ["Fecha carga ERP", (f) => fecha(f.erp?.fechaCarga)],
    ["Destino código ERP", (f) => f.erp?.destinoCodigo],
    ["Destino nombre ERP", (f) => f.erp?.destinoNombre],
    ["Cabecera ERP", (f) => siNo(f.erp?.tieneCabecera)],
    ["Carta de porte ERP", (f) => siNo(f.erp?.tieneCartaPorte)],
    ["Descarga ERP", (f) => siNo(f.erp?.tieneDescarga)],
    ["CP código ERP", (f) => f.erp?.codigoCp],
    ["CP sucursal ERP", (f) => f.erp?.sucursalCp],
    ["CP número ERP", (f) => f.erp?.numeroCp],
    ["CP orden ERP", (f) => f.erp?.ordenCp],
    ["CTG ERP", (f) => f.erp?.ctg],
    ["Patente chasis ERP", (f) => f.erp?.patenteChasis],
    ["Patente acoplado ERP", (f) => f.erp?.patenteAcoplado],
    ["Kg carga ERP", (f) => peso(f.erp?.kgCargaErp)],
    ["Kg descarga ERP", (f) => peso(f.erp?.kgDescargaErp)],
    ["Fecha descarga ERP", (f) => fecha(f.erp?.fechaDescarga)],
    ["Incidencias", (f) => f.incidencias.join("; ")],
    ["Ficha flota ID", (f) => f.seguimiento.flotaVigente?.fichaId],
    ["Versión flota ID", (f) => f.seguimiento.flotaVigente?.versionId],
    ["Revisión flota", (f) => revisionFlota(f.seguimiento.flotaVigente?.revision)],
    ["Patente chasis elegida", (f) => f.seguimiento.flotaVigente?.patenteChasis],
    ["Patente acoplado elegida", (f) => f.seguimiento.flotaVigente?.patenteAcoplado],
    ["Conductor elegido", (f) => f.seguimiento.flotaVigente?.conductor],
    ["Transportista elegido", (f) => f.seguimiento.flotaVigente?.transportista],
    ["Importe referencia flota", (f) => f.seguimiento.flotaVigente?.importeReferencia],
    ["Moneda referencia flota", (f) => f.seguimiento.flotaVigente?.moneda],
    ["Vigente desde flota", (f) => f.seguimiento.flotaVigente?.vigenteDesde],
  );
  return columnas;
}
const texto = (valor: string | number | null | undefined): Cell =>
  valor == null ? null : { type: String, value: String(valor) };
const cabecera = (titulo: string): Cell => ({
  type: String,
  value: titulo,
  fontWeight: "bold",
  backgroundColor: "#E8EEF4",
});
function agregarAutoFiltro(bytes: Uint8Array, columnas: number, filas: number): Uint8Array {
  let ultimaColumna = "";
  for (let codigo = columnas; codigo > 0; codigo = Math.floor((codigo - 1) / 26))
    ultimaColumna = String.fromCharCode(65 + ((codigo - 1) % 26)) + ultimaColumna;
  const archivos = unzipSync(bytes);
  const hoja = "xl/worksheets/sheet1.xml";
  const xml = strFromU8(archivos[hoja]);
  if (!xml.includes("</sheetData>") || xml.includes("<autoFilter"))
    throw new Error("La hoja ficticia no tiene la estructura esperada para el autofiltro.");
  // write-excel-file 4 no declara autofiltro. En este libro sin protección va tras sheetData,
  // antes de merges/formato/impresión, conforme al orden OOXML de la biblioteca instalada.
  const rango = `A1:${ultimaColumna}${filas + 1}`;
  archivos[hoja] = strToU8(xml.replace("</sheetData>", `</sheetData><autoFilter ref="${rango}"/>`));
  return zipSync(archivos);
}
export async function excelLogisticaDemo(
  filas: ConciliacionFila[],
  filtros: URLSearchParams,
  iniciadoAl: string,
  propiosAl: string,
  consultadoAl: string,
) {
  const cols = columnas(consultadoAl);
  const seguimientoData: SheetData = [
    cols.map(([titulo]) => cabecera(titulo)),
    ...filas.map((f) => cols.map(([, valor]) => texto(valor(f)))),
  ];
  const metadata: [string, string | number | null][] = [
    ["Desde (fecha prevista inclusive)", filtros.get("desde")],
    ["Hasta exclusivo (fecha prevista)", filtros.get("hastaExclusivo")],
    ["Contrato", filtros.get("contrato")],
    ["Cliente número", filtros.get("clienteNumero")],
    ["Producto", filtros.get("producto")],
    ["Campaña", filtros.get("campania")],
    ["Destino código", filtros.get("destinoCodigo")],
    ["Circuito", filtros.get("circuito")],
    ["Estado observado", filtros.get("estadoObservado")],
    ["Sólo anulados", siNo(filtros.get("anulados") === "true")],
    ["Lectura iniciada al (Argentina UTC-3)", instante(iniciadoAl)],
    ["Lectura propia finalizada al (Argentina UTC-3)", instante(propiosAl)],
    ["Consulta ERP finalizada al (Argentina UTC-3)", instante(consultadoAl)],
    ["Lectura finalizada al (Argentina UTC-3)", instante(new Date().toISOString())],
    ["Filas exportadas", filas.length],
    ["Límite técnico de filas", 5000],
    [
      "Origen",
      "DEMO: datos propios, catálogos y MacroGest ficticios. No contiene datos de producción.",
    ],
    [
      "Corte de lectura",
      "Corte variable entre lecturas propias, nombres y ERP; no forma una instantánea atómica.",
    ],
    ["Fuente flota", "Ficha y versión propia elegida; importe manual conservado sin cálculos."],
    ["Fuente operativa", "Datos propios del seguimiento: fuente, momento y referencia declarados."],
    [
      "Fuente administrativa",
      "MacroGest ficticio consultado sólo por claves de vínculos vigentes: contrato, grupo y cupo. Pesos de carta de porte y descarga.",
    ],
    [
      "Diagnósticos ERP",
      "sin_vinculo: sin consulta; no_disponible: fallo del lote; no_encontrado: clave ausente; verificado: clave encontrada.",
    ],
    [
      "Pesos reales",
      "Los cuatro pesos reales son texto decimal exacto de cuatro decimales. Vacío significa ausente; 0.0000 significa cero informado.",
    ],
    [
      "Fechas y horarios",
      "Fechas previstas y administrativas como fechas; instantes expresados en Argentina UTC-3.",
    ],
  ];
  const blob = await writeXlsxFile([
    {
      sheet: "Seguimientos",
      data: seguimientoData,
      stickyRowsCount: 1,
      columns: cols.map(([titulo]) => ({ width: Math.min(40, Math.max(18, titulo.length + 3)) })),
    },
    {
      sheet: "Filtros y fuentes",
      data: [
        [cabecera("Filtro o fuente"), cabecera("Valor")],
        ...metadata.map(([key, value]) => [texto(key), texto(value)]),
      ],
      stickyRowsCount: 1,
      columns: [{ width: 48 }, { width: 100 }],
    },
  ]).toBlob();
  const buffer =
    typeof blob.arrayBuffer === "function"
      ? await blob.arrayBuffer()
      : await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(blob);
        });
  return agregarAutoFiltro(new Uint8Array(buffer), cols.length, filas.length);
}
