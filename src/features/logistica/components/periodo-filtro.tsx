import { useState, type FormEventHandler, type ReactNode } from "react";
import { DateField } from "@/components/ui/date-field";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import type { Periodo } from "../types";
import { sumarDias } from "../format";

function dias(desde: string, hasta: string) {
  return (Date.parse(hasta) - Date.parse(desde)) / 86400000 + 1;
}

/**
 * Rango de fechas que acota una consulta de Logística.
 *
 * Filtra al elegir la fecha, sin botón de confirmar: es como filtra el resto de la app
 * (Auditoría, Semillero, Semilla Fiscalizada) y el botón "Consultar" era un paso de más que
 * sólo existía acá.
 *
 * <p>Puede hacerlo sin castigar a la base porque el `DateField` avisa una sola vez, cuando la
 * fecha está completa: escribiendo, "04/1" y "04/10" no son fechas y no disparan nada; del
 * calendario sale una consulta por día elegido. Con un `input type="date"` suelto, en cambio,
 * cada tecla sería una consulta contra producción.</p>
 *
 * <p>Un rango dado vuelta o más largo que `maxDias` no se aplica: se avisa y queda vigente el
 * último rango válido, así la tabla nunca muestra algo que no corresponde a los campos.</p>
 *
 * <p>`children` deja meter los filtros propios de cada pantalla en la MISMA barra, que es lo que
 * hace que se lean como un solo bloque. Dejarlos en un bloque aparte los desparrama: sin la barra
 * que los contiene se estiran a lo ancho de la pantalla y dejan de leerse como filtros.</p>
 *
 * <p>`onSubmit` es para los `children` que NO se aplican al tipear sino con un botón: hace que la
 * barra sea un `<form>` y que Enter en cualquiera de sus campos valga lo mismo que ese botón. El
 * período se sigue aplicando solo, sin pasar por acá.</p>
 */
export function PeriodoFiltro({
  value,
  onChange,
  maxDias = 366,
  children,
  onSubmit,
}: {
  value: Periodo;
  onChange: (v: Periodo) => void;
  maxDias?: number;
  children?: ReactNode;
  onSubmit?: FormEventHandler<HTMLFormElement>;
}) {
  const [desde, setDesde] = useState(value.desde);
  const [hasta, setHasta] = useState(sumarDias(value.hastaExclusivo, -1));
  const valido = (d: string, h: string) => dias(d, h) > 0 && dias(d, h) <= maxDias;

  const cambiar = (nuevoDesde: string, nuevoHasta: string) => {
    setDesde(nuevoDesde);
    setHasta(nuevoHasta);
    if (valido(nuevoDesde, nuevoHasta))
      onChange({ desde: nuevoDesde, hastaExclusivo: sumarDias(nuevoHasta, 1) });
  };

  return (
    <FilterBar onSubmit={onSubmit}>
      <FilterField label="Fecha desde">
        <div className="w-40">
          <DateField value={desde} onChange={(v) => cambiar(v, hasta)} />
        </div>
      </FilterField>
      <FilterField label="Fecha hasta">
        <div className="w-40">
          <DateField value={hasta} onChange={(v) => cambiar(desde, v)} />
        </div>
      </FilterField>
      {children}
      {!valido(desde, hasta) && (
        <p role="alert" className="basis-full text-sm text-rojo">
          Elegí un período de hasta {maxDias} días; sigue vigente el anterior.
        </p>
      )}
    </FilterBar>
  );
}
