import { http, HttpResponse } from "msw";
import {
  CATEGORIAS,
  type ArticuloMapeoDto,
  type CultivoSemilla,
  type MapeoVariedadInput,
  type VentaSemillaDto,
} from "@/features/semilla/types";
import { env } from "@/lib/env";

const API = env.apiUrl;

/** Nombre del enum (lo que viaja en el PUT) → texto Sembra (lo que se muestra/exporta). */
function categoriaLabel(value: string): string {
  return CATEGORIAS.find((c) => c.value === value)?.label ?? value;
}

// --- Maestro INASE ficticio (cultivares por cultivo) ---
const VARIEDADES: Record<CultivoSemilla, string[]> = {
  Trigo: ["PEHUEN", "MS INTA 521", "BAGUETTE 610", "BASILIO", "KLEIN RAYO", "ALGARROBO"],
  Soja: ["DM 53i54", "NIDERA 4619", "DM 40R16", "NIDERA 5009", "ACA 360"],
};

// --- Artículos de semilla (texto al estilo MacroGest) ---
const ARTICULOS: Array<{ codigoArticulo: number; nombreArticulo: string; cultivo: CultivoSemilla }> = [
  { codigoArticulo: 2005, nombreArticulo: "TRIGO DM PEHUEN Fiscaliz 1ra X 40 KGS", cultivo: "Trigo" },
  { codigoArticulo: 2060, nombreArticulo: "TRIGO MS INTA 521 Fiscaliz Original", cultivo: "Trigo" },
  { codigoArticulo: 2145, nombreArticulo: "TRIGO 610 BAGUETTE Fiscaliz 2da", cultivo: "Trigo" },
  { codigoArticulo: 3010, nombreArticulo: "SOJA DM 53I54 Fiscaliz 1ra", cultivo: "Soja" },
  { codigoArticulo: 3025, nombreArticulo: "SOJA NIDERA 4619 Fiscaliz Original", cultivo: "Soja" },
];

// Sugerencias del matcher para los artículos que aún no se mapearon (pre-llenado a confirmar).
const SUGERENCIAS: Record<number, { cultivarInase: string; categoria: string }> = {
  2060: { cultivarInase: "MS INTA 521", categoria: "Original" },
  2145: { cultivarInase: "BAGUETTE 610", categoria: "Segunda Multiplicación" },
  3025: { cultivarInase: "NIDERA 4619", categoria: "Original" },
};

// Mapeos confirmados en memoria (upsert por código). Se siembran dos para ver el ida y vuelta.
const MAPEOS: Record<number, MapeoVariedadInput> = {
  2005: { cultivo: "Trigo", nombreArticulo: "TRIGO DM PEHUEN", cultivarInase: "PEHUEN", categoria: "PrimeraMultiplicacion" },
  3010: { cultivo: "Soja", nombreArticulo: "SOJA DM 53I54", cultivarInase: "DM 53i54", categoria: "PrimeraMultiplicacion" },
};

// Ventas base (un comprobante por fila) por cultivo. CUIT/razón ficticios (nunca PII real).
const VENTAS_BASE: Record<
  CultivoSemilla,
  Array<{ cod: number; tipo: string; numero: string; bolsas: number; cuit: string; razon: string; dia: number }>
> = {
  Trigo: [
    { cod: 2005, tipo: "FC", numero: "12819", bolsas: 25, cuit: "30677538992", razon: "AGRO MATORRALES S.A.", dia: 3 },
    { cod: 2060, tipo: "FC", numero: "12820", bolsas: 40, cuit: "30543210981", razon: "ESTABLECIMIENTO SAN JORGE", dia: 5 },
    { cod: 2145, tipo: "FC", numero: "12821", bolsas: 18, cuit: "30688112233", razon: "DON RAMÓN E HIJOS", dia: 9 },
    { cod: 2005, tipo: "Remito", numero: "45110", bolsas: 10, cuit: "30677538992", razon: "AGRO MATORRALES S.A.", dia: 14 },
    { cod: 2005, tipo: "Remito de Devolución", numero: "45111", bolsas: 5, cuit: "30677538992", razon: "AGRO MATORRALES S.A.", dia: 20 },
  ],
  Soja: [
    { cod: 3010, tipo: "FC", numero: "12990", bolsas: 30, cuit: "30599887766", razon: "SIEMBRAS DEL OESTE S.A.", dia: 4 },
    { cod: 3025, tipo: "FC", numero: "12991", bolsas: 22, cuit: "30622114455", razon: "CAMPOS DEL NORTE SRL", dia: 11 },
    { cod: 3010, tipo: "FC", numero: "12992", bolsas: 16, cuit: "30599887766", razon: "SIEMBRAS DEL OESTE S.A.", dia: 18 },
  ],
};

function ventasDe(cultivo: CultivoSemilla, anio: number, mes: number): VentaSemillaDto[] {
  const mm = String(mes).padStart(2, "0");
  return VENTAS_BASE[cultivo].map((b) => {
    const mapeo = MAPEOS[b.cod];
    const art = ARTICULOS.find((a) => a.codigoArticulo === b.cod)!;
    return {
      campanaAgricola: String(anio),
      kilosTotales: Math.abs(b.bolsas) * 40,
      categoria: mapeo ? categoriaLabel(mapeo.categoria) : "",
      cuitDestinatario: b.cuit,
      razonSocialDestinatario: b.razon,
      fechaComprobante: `${anio}-${mm}-${String(b.dia).padStart(2, "0")}`,
      lineaComprobante: 1,
      numeroComprobante: b.numero,
      tipoComprobante: b.tipo,
      variedad: mapeo ? mapeo.cultivarInase : "",
      codigoArticulo: b.cod,
      nombreArticuloMacroGest: art.nombreArticulo,
      requiereMapeo: !mapeo,
    };
  });
}

function articulosConEstado(): ArticuloMapeoDto[] {
  return ARTICULOS.map((a) => {
    const mapeo = MAPEOS[a.codigoArticulo];
    if (mapeo) {
      return {
        ...a,
        mapeado: true,
        cultivarInase: mapeo.cultivarInase,
        categoria: categoriaLabel(mapeo.categoria),
        esSugerencia: false,
      };
    }
    const sug = SUGERENCIAS[a.codigoArticulo] ?? { cultivarInase: "", categoria: "" };
    return { ...a, mapeado: false, cultivarInase: sug.cultivarInase, categoria: sug.categoria, esSugerencia: true };
  });
}

export const semillaHandlers = [
  http.get(`${API}/semilla/ventas`, ({ request }) => {
    const u = new URL(request.url);
    const anio = Number(u.searchParams.get("anio") ?? new Date().getFullYear());
    const mes = Number(u.searchParams.get("mes") ?? 1);
    const cultivo = (u.searchParams.get("cultivo") ?? "Trigo") as CultivoSemilla;
    return HttpResponse.json(ventasDe(cultivo, anio, mes));
  }),

  http.get(`${API}/semilla/articulos`, () => HttpResponse.json(articulosConEstado())),

  http.get(`${API}/semilla/variedades`, ({ request }) => {
    const cultivo = (new URL(request.url).searchParams.get("cultivo") ?? "Trigo") as CultivoSemilla;
    return HttpResponse.json(VARIEDADES[cultivo] ?? []);
  }),

  http.put(`${API}/semilla/mapeos/:codigo`, async ({ request, params }) => {
    const codigo = Number(params.codigo);
    const body = (await request.json()) as MapeoVariedadInput;

    // Valida que la variedad exista en el maestro (igual que el backend real).
    if (!(VARIEDADES[body.cultivo] ?? []).includes(body.cultivarInase)) {
      return HttpResponse.json(
        { detail: `La variedad '${body.cultivarInase}' no existe en el maestro INASE de ${body.cultivo}.` },
        { status: 400 },
      );
    }

    MAPEOS[codigo] = body;
    return HttpResponse.json({
      codigoArticulo: codigo,
      nombreArticulo: body.nombreArticulo,
      cultivo: body.cultivo,
      cultivarInase: body.cultivarInase,
      categoria: categoriaLabel(body.categoria),
      fechaActualizacion: new Date().toISOString(),
    });
  }),

  // Export (demo): genera un .xlsx válido con las 10 columnas de Sembra para que la descarga funcione
  // sin backend. El backend real arma el formato fiel (colores, anchos, hoja "CARGA").
  http.get(`${API}/semilla/export`, async ({ request }) => {
    const u = new URL(request.url);
    const anio = Number(u.searchParams.get("anio") ?? new Date().getFullYear());
    const mes = Number(u.searchParams.get("mes") ?? 1);
    const cultivo = (u.searchParams.get("cultivo") ?? "Trigo") as CultivoSemilla;
    const filas = ventasDe(cultivo, anio, mes);

    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    const blob = await writeXlsxFile(filas, {
      sheet: "CARGA",
      columns: [
        { header: "Campaña Agrícola", width: 16, cell: (r: VentaSemillaDto) => ({ type: String, value: r.campanaAgricola }) },
        { header: "Kilos Totales", width: 13, cell: (r: VentaSemillaDto) => ({ type: Number, value: r.kilosTotales, format: "#,##0" }) },
        { header: "Categoría", width: 22, cell: (r: VentaSemillaDto) => ({ type: String, value: r.categoria || undefined }) },
        { header: "CUIT Destinatario", width: 16, cell: (r: VentaSemillaDto) => ({ type: String, value: r.cuitDestinatario || undefined }) },
        { header: "Razón Social Destinatario", width: 34, cell: (r: VentaSemillaDto) => ({ type: String, value: r.razonSocialDestinatario || undefined }) },
        { header: "Fecha Comprobante", width: 16, cell: (r: VentaSemillaDto) => ({ type: Date, value: new Date(r.fechaComprobante), format: "dd/mm/yyyy" }) },
        { header: "Línea Comprobante", width: 14, cell: (r: VentaSemillaDto) => ({ type: Number, value: r.lineaComprobante }) },
        { header: "N° Comprobante", width: 16, cell: (r: VentaSemillaDto) => ({ type: String, value: r.numeroComprobante }) },
        { header: "Tipo Comprobante", width: 18, cell: (r: VentaSemillaDto) => ({ type: String, value: r.tipoComprobante }) },
        { header: "Variedad", width: 22, cell: (r: VentaSemillaDto) => ({ type: String, value: r.variedad || undefined }) },
      ],
    }).toBlob();

    return new HttpResponse(blob, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Ventas_Informadas_demo.xlsx"',
      },
    });
  }),

  // Plantilla de mapeo (demo): la lista de artículos con variedad/categoría (confirmada o sugerida).
  http.get(`${API}/semilla/mapeos/export`, async () => {
    const filas = articulosConEstado();
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    const blob = await writeXlsxFile(filas, {
      sheet: "MAPEO",
      columns: [
        { header: "Código", width: 10, cell: (a: ArticuloMapeoDto) => ({ type: Number, value: a.codigoArticulo }) },
        { header: "Artículo", width: 42, cell: (a: ArticuloMapeoDto) => ({ type: String, value: a.nombreArticulo }) },
        { header: "Cultivo", width: 12, cell: (a: ArticuloMapeoDto) => ({ type: String, value: a.cultivo }) },
        { header: "Variedad INASE", width: 22, cell: (a: ArticuloMapeoDto) => ({ type: String, value: a.cultivarInase || undefined }) },
        { header: "Categoría", width: 22, cell: (a: ArticuloMapeoDto) => ({ type: String, value: a.categoria || undefined }) },
        {
          header: "Estado",
          width: 16,
          cell: (a: ArticuloMapeoDto) => ({
            type: String,
            value: a.mapeado ? "Mapeado" : a.cultivarInase ? "Sugerido" : "Sin sugerencia",
          }),
        },
      ],
    }).toBlob();

    return new HttpResponse(blob, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Mapeo_de_variedades_demo.xlsx"',
      },
    });
  }),

  // Import de mapeo (demo): no parsea el .xlsx; confirma las sugerencias disponibles para ver el ida y vuelta.
  http.post(`${API}/semilla/mapeos/import`, async ({ request }) => {
    await request.formData(); // consume el archivo subido
    let mapeados = 0;
    for (const a of ARTICULOS) {
      if (MAPEOS[a.codigoArticulo]) continue;
      const sug = SUGERENCIAS[a.codigoArticulo];
      const value = CATEGORIAS.find((c) => c.label === sug?.categoria)?.value;
      if (!sug?.cultivarInase || !value) continue;
      MAPEOS[a.codigoArticulo] = {
        cultivo: a.cultivo,
        nombreArticulo: a.nombreArticulo,
        cultivarInase: sug.cultivarInase,
        categoria: value,
      };
      mapeados++;
    }
    return HttpResponse.json({ filasLeidas: ARTICULOS.length, mapeados, omitidos: 0, errores: [] });
  }),
];
