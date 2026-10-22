import type { ReactNode } from "react";
import { FilterActions } from "@/shared/components/filter-bar";
import type { FiltrosComerciales } from "../lib/filtros-comerciales";
import { CampaniaSelect } from "./campania-select";
import { CatalogoSelect } from "./catalogo-select";

/**
 * Cereal y campaña, los dos filtros que el área usuaria pide **en toda pantalla**: «siempre campaña
 * y cereal, en todas, siempre; es un filtro que usamos mucho para acotar la búsqueda».
 *
 * Va DENTRO de la barra del `PeriodoFiltro`, que es la que arma el `<form>` y recibe el `onSubmit`:
 * suelto se estiraba a lo ancho y dejaba de leerse como filtro. Se aplica con el botón y no al
 * tipear, porque cada tecla sería una consulta contra producción.
 */
export function FiltrosComercialesCampos({
  value,
  onChange,
  onClear,
  children,
}: {
  value: FiltrosComerciales;
  onChange: (v: FiltrosComerciales) => void;
  onClear: () => void;
  /** Filtros propios de la pantalla, entre la campaña y los botones. */
  children?: ReactNode;
}) {
  return (
    <>
      <CatalogoSelect
        className="w-56"
        tipo="productos"
        titulo="Cereal"
        value={Number(value.producto)}
        required={false}
        modoFiltro
        onChange={(v) => onChange({ ...value, producto: v ? String(v) : "" })}
      />
      <CampaniaSelect
        value={value.campania}
        onChange={(campania) => onChange({ ...value, campania })}
      />
      {children}
      <FilterActions onClear={onClear} />
    </>
  );
}
