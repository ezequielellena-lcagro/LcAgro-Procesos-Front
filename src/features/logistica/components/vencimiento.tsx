import { diaArgentina, hoy } from "../format";

/** Días entre una fecha ISO y hoy: positivo = ya pasó, negativo = falta. */
function diasDesde(dia: string): number {
  return Math.round(
    (Date.parse(`${hoy()}T12:00:00Z`) - Date.parse(`${dia.slice(0, 10)}T12:00:00Z`)) / 86400000,
  );
}
const dias = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

/**
 * Vencimiento de una preventa: el fin de su período de entrega. Semáforo con los cortes del mockup
 * del área usuaria: rojo con más de 180 días vencida, naranja entre 90 y 180.
 */
export function Vencimiento({ hasta }: { hasta: string | null | undefined }) {
  if (!hasta) return <span className="text-ink-soft">Sin período</span>;
  const d = diasDesde(hasta);
  if (d > 0) {
    const tono = d > 180 ? "text-rojo" : d >= 90 ? "text-clementina-deep" : "text-ink";
    return (
      <span className={`whitespace-nowrap font-medium ${tono}`}>
        {d >= 90 ? "● " : ""}Vencida hace {dias(d)}
      </span>
    );
  }
  if (d === 0) return <span className="whitespace-nowrap font-medium text-ink">Vence hoy</span>;
  return (
    <span className={`whitespace-nowrap ${-d <= 15 ? "font-medium text-ink" : "text-ink-soft"}`}>
      Vence en {dias(-d)}
    </span>
  );
}

/** Hace cuánto se cargó el pedido del cliente, por día argentino. */
export function PedidoHace({ desde }: { desde: string | null | undefined }) {
  if (!desde) return <span className="text-ink-soft">—</span>;
  const d = diasDesde(diaArgentina(desde));
  return (
    <span className="whitespace-nowrap">{d <= 0 ? "Pedido hoy" : `Pedido hace ${dias(d)}`}</span>
  );
}
