import { Button } from "@/components/ui/button";

export const LEYENDA_CONSOLIDADO = "Facturación LC: comprobantes del 1-abr al 31-mar (misma regla que Comisiones) · Originación: certificados 1116 A (CEG) de la campaña asignada en MacroGest · Mercado y potencial: plan de siembra × Market Share";
export const LEYENDA_AJUSTE = "Ajuste de redondeo: diferencia entre importes por CUIT y renglones del motor de facturación. Se suma sólo al TOTAL.";
export const NOTA_D10 = "LC anterior 2025/26 incluye 12 renglones facturados en pesos en 2024/25; la conversión de moneda D10 sigue pendiente.";

export function FuenteDatos({
  campania,
  datosMacroGestAl,
  onActualizar,
  actualizando,
}: {
  campania: string;
  datosMacroGestAl: string | null;
  onActualizar: () => void;
  actualizando: boolean;
}) {
  const hora = datosMacroGestAl
    ? new Date(datosMacroGestAl).toLocaleTimeString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  return (
    <aside className="rounded-card border border-line bg-panel-soft px-4 py-3 text-xs leading-relaxed text-ink-soft">
      <p>{LEYENDA_CONSOLIDADO}</p>
      <p className="mt-1">{LEYENDA_AJUSTE}</p>
      {campania === "2025-2026" && <p className="mt-1 text-ink">{NOTA_D10}</p>}
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-2">
        <span>{hora ? `Datos de MacroGest al ${hora}` : "Sin datos de MacroGest"}</span>
        <Button type="button" variant="ghost" size="sm" onClick={onActualizar} disabled={actualizando}>
          Actualizar
        </Button>
      </div>
    </aside>
  );
}
