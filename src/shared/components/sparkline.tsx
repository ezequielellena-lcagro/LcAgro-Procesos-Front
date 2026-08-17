import { cn } from "@/lib/utils";

/**
 * Mini-línea de tendencia, sin dependencias. Toma la historia de un dato (valor por período, en orden)
 * y dibuja su trayectoria: sirve para ver "venía subiendo y cayó" de un vistazo, al lado de la fila.
 * Con menos de dos puntos no dibuja nada.
 */
export function Sparkline({
  values,
  width = 72,
  height = 22,
  className,
  tone = "slate",
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  tone?: "slate" | "verde" | "rojo" | "clementina";
}) {
  if (values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const pad = 2;
  const usableH = height - pad * 2;

  const puntos = values.map((v, i) => {
    const x = i * stepX;
    const y = pad + usableH - ((v - min) / span) * usableH; // más alto = más arriba
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const stroke = {
    slate: "var(--color-slate-brand)",
    verde: "var(--color-verde)",
    rojo: "var(--color-rojo)",
    clementina: "var(--color-clementina-deep)",
  }[tone];

  const last = puntos.at(-1)!.split(",").map(Number);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0", className)}
      role="img"
      aria-hidden
    >
      <polyline points={puntos.join(" ")} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2} fill={stroke} />
    </svg>
  );
}
