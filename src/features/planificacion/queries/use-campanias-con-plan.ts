import { useQuery } from "@tanstack/react-query";
import { listarCampaniasConPlan } from "../api";
import { planificacionKeys } from "./keys";

/**
 * Campañas que ya tienen plan de siembra cargado, de la más reciente a la más vieja.
 *
 * Existe para que el tablero abra donde hay datos. La campaña vigente por almanaque arranca el
 * 1 de abril y suele quedar vacía durante meses: abrir ahí muestra "0 con plan · US$ 0,00" y hace
 * parecer que el módulo no funciona, cuando el dato está en la campaña anterior.
 */
export function useCampaniasConPlan() {
  return useQuery({
    queryKey: planificacionKeys.campaniasConPlan(),
    queryFn: listarCampaniasConPlan,
    // Cambia sólo cuando alguien importa un plan: no hace falta refrescarla seguido.
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Campaña con la que conviene abrir: la más reciente que tenga plan y esté dentro de las opciones
 * ofrecidas. Si ninguna lo tiene —módulo recién instalado— cae en la vigente por almanaque.
 */
export function campaniaInicial(
  campaniasConPlan: string[] | undefined,
  opciones: readonly string[],
  porAlmanaque: string,
): string {
  const conPlan = campaniasConPlan?.find((c) => opciones.includes(c));
  return conPlan ?? porAlmanaque;
}
