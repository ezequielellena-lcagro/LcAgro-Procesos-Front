import { fechaHora } from "../format";
import type { EstadoCopiaClientesDto } from "../types";

export type NivelCopiaClientes = "ok" | "desactualizada" | "sinCopia";

export interface AvisoCopiaClientes {
  nivel: NivelCopiaClientes;
  mensaje: string;
}

/**
 * Texto puro del aviso de la copia local de clientes de MacroGest (R2.3/R2.4). Las fechas son
 * siempre absolutas —nunca "hace 2 días"—, siguiendo la convención del proyecto.
 */
export function avisoCopiaClientes(copia: EstadoCopiaClientesDto): AvisoCopiaClientes {
  if (copia.sinCopia) {
    return {
      nivel: "sinCopia",
      mensaje: copia.ultimoError
        ? `Todavía no hay clientes sincronizados desde MacroGest (${copia.ultimoError}).`
        : "Todavía no hay clientes sincronizados desde MacroGest.",
    };
  }

  const fecha = copia.ultimaSincronizacion ? fechaHora(copia.ultimaSincronizacion) : null;

  if (copia.desactualizada) {
    return {
      nivel: "desactualizada",
      mensaje: fecha
        ? `Datos de clientes desactualizados (última sincronización: ${fecha}).`
        : "Datos de clientes desactualizados.",
    };
  }

  return {
    nivel: "ok",
    mensaje: fecha ? `Clientes actualizados (última sincronización: ${fecha}).` : "Clientes actualizados.",
  };
}
