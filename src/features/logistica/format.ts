export function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function sumarDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
export function fecha(d: string | null): string {
  return d ? d.slice(0, 10).split("-").reverse().join("/") : "Sin fecha";
}
export function fechaInstanteArgentina(instante: string | null): string {
  if (!instante) return "Sin fecha";
  const dia = new Date(instante);
  if (Number.isNaN(dia.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dia);
}
export function campania(c: number | null): string {
  const s = String(c ?? "");
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : "Sin campaña";
}
export function kg(n: number | null): string {
  return n === null
    ? "Sin dato"
    : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 }).format(n)} kg`;
}
export function periodoInicial(erp = false) {
  return {
    desde: sumarDias(hoy(), erp ? -365 : -7),
    hastaExclusivo: sumarDias(hoy(), erp ? 1 : 16),
  };
}
export function ahoraLocal(): string {
  const d = new Date();
  return `${hoy()}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function fechaHoraArgentina(instante: string | null): string {
  if (!instante || Number.isNaN(Date.parse(instante))) return "Pendiente";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instante));
}
export function ahoraArgentinaInput(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}T${parte("hour")}:${parte("minute")}`;
}
export function instanteArgentinaUtc(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(valor)) return null;
  const instante = new Date(`${valor}-03:00`);
  if (Number.isNaN(instante.getTime())) return null;
  // Impide normalizar silenciosamente una fecha inválida como 31 de febrero.
  const local = new Date(instante.getTime() - 3 * 3600000).toISOString().slice(0, valor.length);
  return local === valor ? instante.toISOString() : null;
}
/** Día argentino (AAAA-MM-DD) de un instante: el que usa el servidor para paginar otorgamientos. */
export function diaArgentina(instante: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instante));
}
