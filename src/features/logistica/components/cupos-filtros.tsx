import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FilterActions, FilterField } from "@/shared/components/filter-bar";
import { CampaniaSelect } from "./campania-select";
import { CatalogoSelect } from "./catalogo-select";

import { campaniaValida, type FiltrosCupos } from "../lib/filtros-cupos";

/**
 * Filtros de un listado de cupos.
 *
 * NO es un `<form>` propio: va DENTRO de la barra del `PeriodoFiltro`, que es la que arma el form
 * y recibe el `onSubmit`. Como bloque aparte quedaba una grilla de columnas tan anchas como la
 * pantalla, con los campos desparramados y sin nada que los agrupara como filtros.
 */
export function CuposFiltros({
  value,
  onChange,
  onClear,
  erp = false,
}: {
  value: FiltrosCupos;
  onChange: (v: FiltrosCupos) => void;
  onClear: () => void;
  erp?: boolean;
}) {
  const campaniaOk = campaniaValida(value);
  return (
    <>
      <FilterField label="Contrato">
        <Input
          className="w-40"
          value={value.contrato}
          maxLength={15}
          onChange={(e) => onChange({ ...value, contrato: e.target.value })}
        />
      </FilterField>
      <CatalogoSelect
        className="w-56"
        tipo="productos"
        titulo="Cereal"
        value={Number(value.producto)}
        required={false}
        modoFiltro
        onChange={(v) => onChange({ ...value, producto: v ? String(v) : "" })}
      />
      <CatalogoSelect
        className="w-56"
        tipo="destinos"
        titulo="Destino"
        value={Number(value.destinoCodigo)}
        required={false}
        modoFiltro
        onChange={(v) => onChange({ ...value, destinoCodigo: v ? String(v) : "" })}
      />
      {/* La campaña va en TODAS las solapas, también en la de MacroGest: es el filtro que el área
          usuaria pide siempre para acotar la búsqueda. El circuito no, porque es una clasificación
          propia (directa/propia) que el ERP no guarda. */}
      <CampaniaSelect
        value={value.campania}
        onChange={(campania) => onChange({ ...value, campania })}
      />
      {!erp && (
        <>
          <FilterField label="Circuito">
            <Select
              className="w-40"
              value={value.circuito}
              onChange={(e) => onChange({ ...value, circuito: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="directa">Directa</option>
              <option value="propia">Propia</option>
            </Select>
          </FilterField>
        </>
      )}
      <FilterActions
        aplicarDeshabilitado={!campaniaOk}
        onClear={onClear}
        aviso={
          !campaniaOk && (
            <p role="alert" className="mr-auto text-sm text-rojo">
              Ingresá una campaña como 2025-2026.
            </p>
          )
        }
      />
    </>
  );
}
