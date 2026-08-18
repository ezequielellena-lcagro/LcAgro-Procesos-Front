import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { numero, pct, usd } from "@/shared/format/format";
import {
  CRECIMIENTO_BASE,
  estadoDe,
  notaDe,
  objetivoDe,
  objetivoSugerido,
  previoDe,
  validarObjetivo,
} from "../lib/objetivo";
import type { ContextoCampania, LineaCalendario, LineaObjetivo, Vendedor } from "../types";

interface Props {
  vendedores: Vendedor[];
  ctx: Record<LineaCalendario, ContextoCampania>;
  /** Persiste los objetivos editados. En el mockup solo actualiza el estado en memoria. */
  onGuardar: (cambios: Vendedor[]) => void;
}

/**
 * Reemplazo de `objetivos.xlsx`.
 *
 * La diferencia con el Excel no es el formulario: es que acá el sistema **propone** un número,
 * **valida** que no sea un retroceso, y deja **rastro** de quién acordó qué y cuándo.
 */
export function CargaObjetivos({ vendedores, ctx, onGuardar }: Props) {
  const [linea, setLinea] = useState<LineaObjetivo>("insumos");
  const [base, setBase] = useState(CRECIMIENTO_BASE);
  /** Copia de trabajo. `null` = sin cambios pendientes. */
  const [borrador, setBorrador] = useState<Vendedor[] | null>(null);

  const datos = borrador ?? vendedores;
  const filas = useMemo(() => datos.filter((v) => !v.excluido), [datos]);
  const hayCambios = borrador !== null;

  const esInsumos = linea === "insumos";
  const fmt = esInsumos ? usd : (n: number) => `${numero(n)} tn`;
  const campania = esInsumos ? ctx.insumos.clave : ctx.granos.clave;
  const campoObjetivo = esInsumos ? "objetivoInsumos" : "objetivoGranos";
  const campoNota = esInsumos ? "notaInsumos" : "notaGranos";
  const campoEstado = esInsumos ? "estadoInsumos" : "estadoGranos";

  /** Abre (o reusa) la copia de trabajo y aplica un cambio sobre un vendedor. */
  const editar = (cod: number, cambio: Partial<Vendedor>) => {
    setBorrador((prev) =>
      (prev ?? vendedores).map((v) =>
        v.cod === cod ? { ...v, ...cambio, [campoEstado]: "borrador" as const } : v,
      ),
    );
  };

  const cambiarLinea = (nueva: LineaObjetivo) => {
    if (hayCambios && !confirm("Hay objetivos sin guardar en esta línea. ¿Cambiar igual y descartarlos?")) return;
    setBorrador(null);
    setLinea(nueva);
  };

  const aplicarSugeridos = () => {
    const partida = borrador ?? vendedores;
    let n = 0;
    const siguiente = partida.map((v) => {
      if (v.excluido) return v;
      if (estadoDe(v, linea) !== "borrador" && objetivoDe(v, linea) > 0) return v;
      n++;
      return { ...v, [campoObjetivo]: Math.round(objetivoSugerido(v, linea, base)) };
    });
    setBorrador(siguiente);
    toast[n ? "success" : "info"](
      n
        ? `Se aplicó el sugerido a ${n} objetivo${n === 1 ? "" : "s"} en borrador. Revisá y guardá.`
        : "No hay objetivos en borrador en esta línea.",
    );
  };

  const guardar = () => {
    if (!borrador) return;
    // Solo se da por acordado lo que el usuario tocó: un borrador que quedó pendiente de
    // reunión no se confirma solo porque se guardó la pantalla.
    const tocados = borrador.filter((v, i) => {
      const orig = vendedores[i];
      return objetivoDe(v, linea) !== objetivoDe(orig, linea) || notaDe(v, linea) !== notaDe(orig, linea);
    });
    const siguiente = borrador.map((v) => {
      const tocado = tocados.some((t) => t.cod === v.cod);
      if (!tocado) return v;
      return { ...v, [campoEstado]: objetivoDe(v, linea) > 0 ? ("acordado" as const) : ("borrador" as const) };
    });
    onGuardar(siguiente);
    setBorrador(null);
    toast.success(
      `${tocados.length} objetivo${tocados.length === 1 ? "" : "s"} guardado${tocados.length === 1 ? "" : "s"}. ` +
        "En la app real esto escribe en ObjetivoVendedor (BD propia) con sugerido, acordado, nota, usuario y fecha.",
    );
  };

  const totalObjetivo = filas.reduce((a, v) => a + objetivoDe(v, linea), 0);
  const totalSugerido = filas.reduce((a, v) => a + objetivoSugerido(v, linea, base), 0);
  const totalPrevio = filas.reduce((a, v) => a + previoDe(v, linea), 0);
  const acordados = filas.filter((v) => estadoDe(v, linea) === "acordado").length;
  const conAviso = filas.filter((v) => validarObjetivo(v, linea, base)).length;

  const columnas: Column<Vendedor>[] = [
    {
      key: "vendedor",
      header: "Vendedor",
      cell: (v) => (
        <span className="whitespace-nowrap font-medium">
          {v.nombre}
          {v.dudoso && <Badge tono="warn">¿es vendedor?</Badge>}
        </span>
      ),
      sortBy: (v) => v.nombre,
    },
    {
      key: "penetracion",
      header: "Penetración",
      align: "right",
      cell: (v) => pct(v.penetracion * 100),
      sortBy: (v) => v.penetracion,
    },
    {
      key: "previo",
      header: "Campaña anterior",
      align: "right",
      cell: (v) => fmt(previoDe(v, linea)),
      sortBy: (v) => previoDe(v, linea),
    },
    {
      key: "sugerido",
      header: "Sugerido",
      align: "right",
      cell: (v) => (
        <button
          type="button"
          onClick={() => editar(v.cod, { [campoObjetivo]: Math.round(objetivoSugerido(v, linea, base)) })}
          title="Usar este valor"
          className="rounded border border-dashed border-line bg-panel-soft px-2 py-1 text-xs tabular transition hover:border-solid hover:border-clementina-deep hover:bg-clementina/10"
        >
          {fmt(objetivoSugerido(v, linea, base))}
        </button>
      ),
      sortBy: (v) => objetivoSugerido(v, linea, base),
    },
    {
      key: "objetivo",
      header: "Objetivo acordado",
      align: "right",
      cell: (v) => {
        const aviso = validarObjetivo(v, linea, base);
        return (
          <div className="flex flex-col items-end gap-1">
            <Input
              inputMode="numeric"
              value={numero(objetivoDe(v, linea))}
              aria-label={`Objetivo acordado de ${v.nombre}`}
              onChange={(e) =>
                editar(v.cod, { [campoObjetivo]: Number(e.target.value.replace(/[^\d-]/g, "")) || 0 })
              }
              className={cn(
                "h-9 w-32 text-right tabular",
                aviso?.nivel === "error" && "border-rojo bg-rojo/5",
                aviso?.nivel === "warn" && "border-clementina-deep bg-clementina/5",
              )}
            />
            {aviso && (
              <span className={cn("text-[11px] leading-tight", aviso.nivel === "error" ? "text-rojo" : "text-clementina-deep")}>
                {aviso.texto}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "delta",
      header: "Δ vs. anterior",
      align: "right",
      cell: (v) => {
        const previo = previoDe(v, linea);
        if (!previo) return <span className="text-ink-soft">—</span>;
        const d = (objetivoDe(v, linea) / previo - 1) * 100;
        return (
          <span className={cn("text-xs font-medium tabular", d >= 0 ? "text-verde" : "text-rojo")}>
            {d >= 0 ? "+" : ""}
            {pct(d)}
          </span>
        );
      },
      sortBy: (v) => (previoDe(v, linea) ? objetivoDe(v, linea) / previoDe(v, linea) : null),
    },
    {
      key: "nota",
      header: "Nota — por qué se acordó",
      cell: (v) => (
        <Input
          value={notaDe(v, linea)}
          placeholder="Opcional — queda registrado"
          aria-label={`Nota del objetivo de ${v.nombre}`}
          onChange={(e) => editar(v.cod, { [campoNota]: e.target.value })}
          className="h-9 min-w-44 border-transparent bg-transparent text-xs hover:border-line hover:bg-panel-soft"
        />
      ),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (v) => {
        const acordado = estadoDe(v, linea) === "acordado";
        return (
          <div>
            <Badge tono={acordado ? "ok" : "warn"}>{acordado ? "Acordado" : "Borrador"}</Badge>
            {acordado && <div className="mt-0.5 text-[10px] text-ink-soft">E. Ellena · 04-abr-2026</div>}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-card border border-line bg-panel p-4 shadow-card">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
            Línea a cargar — cada una tiene su propio calendario
          </div>
          <div className="flex gap-2">
            <LineaTab activa={esInsumos} onClick={() => cambiarLinea("insumos")} titulo="Insumos (USD)"
              detalle={`campaña abr–mar · ${ctx.insumos.clave}`} />
            <LineaTab activa={!esInsumos} onClick={() => cambiarLinea("granos")} titulo="Granos (Tn)"
              detalle={`campaña jul–jun · ${ctx.granos.clave}`} />
          </div>
        </section>

        <section className="rounded-card border border-line bg-panel p-4 shadow-card">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
            Crecimiento base de la compañía
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range" min={-10} max={40} step={1} value={Math.round(base * 100)}
              onChange={(e) => setBase(Number(e.target.value) / 100)}
              aria-label="Crecimiento base de la compañía"
              className="h-1 flex-1 accent-clementina-deep"
            />
            <span className="min-w-14 text-right font-display text-xl font-semibold tabular text-ink">
              {base >= 0 ? "+" : ""}
              {Math.round(base * 100)} %
            </span>
          </div>
          <p className="mt-2 border-t border-line pt-2 text-xs leading-relaxed text-ink-soft">
            Sugerido = <b>cierre de la campaña anterior</b> × (1 + crecimiento base +{" "}
            <b>(1 − penetración) × 15 %</b>). Al vendedor con la cartera menos penetrada se le pide más, porque
            tiene más lugar para crecer. Los dos parámetros salen de <code>appsettings.json</code>.
          </p>
        </section>
      </div>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">
              Objetivos de {esInsumos ? "Insumos (USD)" : "Granos (Tn)"}
            </h2>
            <p className="text-xs text-ink-soft">
              Campaña {campania} · {filas.length} vendedores (lista blanca de Cuentas − excluidos de Volumen
              Acopiado) · {filas.filter((v) => v.dudoso).length} pendientes de confirmar
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={aplicarSugeridos}>
            Aplicar sugeridos a los borradores
          </Button>
        </div>

        <DataTable columns={columnas} rows={filas} getRowKey={(v) => v.cod} empty="Sin vendedores." />
      </section>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-4 rounded-card border border-line border-t-2 border-t-clementina-deep bg-panel p-3.5 shadow-card">
        <div className="flex flex-1 flex-wrap gap-6">
          <Resumen k="Acordados" v={`${acordados} / ${filas.length}`} />
          <Resumen k="Total objetivo" v={fmt(totalObjetivo)} />
          <Resumen
            k="Vs. sugerido"
            v={`${totalObjetivo >= totalSugerido ? "+" : ""}${pct((totalObjetivo / totalSugerido - 1) * 100)}`}
            tono={totalObjetivo >= totalSugerido ? "verde" : "rojo"}
          />
          <Resumen
            k="Vs. campaña anterior"
            v={`${totalObjetivo >= totalPrevio ? "+" : ""}${pct((totalObjetivo / totalPrevio - 1) * 100)}`}
            tono={totalObjetivo >= totalPrevio ? "verde" : "rojo"}
          />
          <Resumen k="Con aviso" v={String(conAviso)} tono={conAviso ? "clementina" : undefined} />
        </div>
        <Button type="button" variant="outline" disabled={!hayCambios} onClick={() => setBorrador(null)}>
          Descartar cambios
        </Button>
        <Button type="button" disabled={!hayCambios} onClick={guardar}>
          Guardar objetivos
        </Button>
      </div>

      <p className="text-center text-xs leading-relaxed text-ink-soft">
        En la app real esto persiste en la BD propia (entidad <b>ObjetivoVendedor</b>), no en un Excel: queda el
        sugerido, el acordado, la nota, el usuario y la fecha. El Excel de hoy no guarda nada de eso y no avisa
        cuando un objetivo queda por debajo del año anterior.
      </p>
    </div>
  );
}

function LineaTab({
  activa, onClick, titulo, detalle,
}: {
  activa: boolean;
  onClick: () => void;
  titulo: string;
  detalle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md border p-2.5 text-left transition",
        activa
          ? "border-clementina-deep bg-clementina/10 ring-2 ring-clementina/30"
          : "border-line bg-panel-soft hover:border-slate-brand/40",
      )}
    >
      <span className="block text-sm font-semibold text-ink">{titulo}</span>
      <span className="mt-0.5 block text-[10px] text-ink-soft">{detalle}</span>
    </button>
  );
}

function Resumen({ k, v, tono }: { k: string; v: string; tono?: "verde" | "rojo" | "clementina" }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-ink-soft">{k}</div>
      <div
        className={cn(
          "font-display text-lg font-semibold tabular text-ink",
          tono === "verde" && "text-verde",
          tono === "rojo" && "text-rojo",
          tono === "clementina" && "text-clementina-deep",
        )}
      >
        {v}
      </div>
    </div>
  );
}

function Badge({ tono, children }: { tono: "ok" | "warn"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold",
        tono === "ok" ? "bg-verde/10 text-verde" : "bg-clementina/15 text-clementina-deep",
      )}
    >
      {children}
    </span>
  );
}
