import type { CampaniaTablero, ObjetivosIndicadores } from "../types";

export type IndicadorClave = keyof ObjetivosIndicadores;
export type Estado = "cumple" | "no-cumple" | "en-curso" | "sin-objetivo";

export const INDICADORES: {
  clave: IndicadorClave;
  nombre: string;
  unidad: "pct" | "veces" | "tn" | "cantidad";
}[] = [
  { clave: "gananciaPosicionPct", nombre: "Ganancia de posición", unidad: "pct" },
  { clave: "comisionPct", nombre: "Ganancia de comisiones", unidad: "pct" },
  { clave: "rotacion", nombre: "Rotación de acopio", unidad: "veces" },
  { clave: "tnPreventas", nombre: "Volumen comercializado", unidad: "tn" },
  { clave: "tnAcopiadas", nombre: "Volumen acopiado (1116 A)", unidad: "tn" },
  { clave: "nuevosClientes", nombre: "Nuevos clientes", unidad: "cantidad" },
];

/** Los que acumulan a lo largo de la campaña: debajo del objetivo, en curso, todavía pueden llegar. */
const ACUMULAN: IndicadorClave[] = ["rotacion", "tnPreventas", "tnAcopiadas", "nuevosClientes"];

/** El valor que se juzga: al corte comparable; las comisiones, netas. */
export function valorIndicador(c: CampaniaTablero, clave: IndicadorClave): number | null {
  switch (clave) {
    case "gananciaPosicionPct":
      return c.gananciaPosicionPct;
    case "comisionPct":
      return c.comisionPctNeta;
    case "rotacion":
      return c.rotacion;
    case "tnPreventas":
      return c.tnPreventas;
    case "tnAcopiadas":
      return c.tnAcopiadas;
    case "nuevosClientes":
      return c.nuevosClientes;
  }
}

/**
 * Semáforo (doc 14 §2.2): una campaña antes de su corte no se juzga; un indicador que acumula y viene
 * debajo del objetivo en la campaña en curso está «en curso», no «no cumple». Los dos porcentajes no
 * son monótonos: se juzgan siempre.
 */
export function estadoIndicador(c: CampaniaTablero, clave: IndicadorClave): Estado {
  const objetivo = c.objetivos[clave];
  const valor = valorIndicador(c, clave);
  if (c.preCorte || objetivo == null || valor == null) return "sin-objetivo";
  if (valor >= objetivo) return "cumple";
  if (ACUMULAN.includes(clave) && c.enCurso) return "en-curso";
  return "no-cumple";
}

/** Color del texto de un valor según su estado (para la serie por campaña). */
export const CLASE_ESTADO: Record<Estado, string> = {
  cumple: "text-verde",
  "no-cumple": "text-rojo",
  "en-curso": "text-clementina-deep",
  "sin-objetivo": "",
};

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  cumple: "cumple",
  "no-cumple": "no cumple",
  "en-curso": "en curso",
  "sin-objetivo": "s/obj.",
};
