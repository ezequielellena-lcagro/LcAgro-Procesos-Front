import type { CargaLogistica, GuardarCargaBody } from "../types";

/** Elegir el estado que sugiere MacroGest es volver a seguirlo: no se guarda a mano. */
export function estadoElegido(carga: CargaLogistica, estado: string): string | null {
  return !estado || estado === carga.estadoSugerido ? null : estado;
}

/** Cuerpo para guardar lo propio de una carga, partiendo de lo que ya tiene más los cambios. */
export function cuerpoCarga(
  carga: CargaLogistica,
  cambios: Partial<GuardarCargaBody> = {},
): GuardarCargaBody {
  const p = carga.propio;
  return {
    contrato: carga.contrato,
    plan: carga.plan,
    cupo: carga.cupo,
    revision: p?.revision ?? null,
    fichaId: p?.camion?.fichaId ?? null,
    versionId: p?.camion?.versionId ?? null,
    estado: p?.estado ?? null,
    humedad: p?.humedad ?? null,
    obsCalidad: p?.obsCalidad ?? null,
    observacion: p?.observacion ?? null,
    ...cambios,
  };
}
