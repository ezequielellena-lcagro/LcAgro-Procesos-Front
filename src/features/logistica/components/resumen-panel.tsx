import { useState } from "react";
import { FilterActions, FilterBar } from "@/shared/components/filter-bar";
import { CampaniaSelect } from "./campania-select";
import { CatalogoSelect } from "./catalogo-select";
import { DisponiblesPanel } from "./disponibles-panel";

const filtrosVacios = { producto: 0, campania: "" };

/**
 * Pantalla de entrada de Cupos: cuántos cupos hay en MacroGest de hoy en adelante, por cereal, y
 * cuántos de planta 0 vencieron sin usarse. No tiene período: disponible es "de hoy en adelante".
 *
 * El seguimiento de lo pedido a cada terminal salía de los cupos recibidos en la app, que se
 * eliminaron; esa pregunta la contesta el historial de pedidos de cupo.
 */
export function ResumenPanel({ activo }: { activo: boolean }) {
  const [borrador, setBorrador] = useState(filtrosVacios);
  const [aplicados, setAplicados] = useState(filtrosVacios);
  return (
    <div className="min-w-0 space-y-4">
      <FilterBar
        onSubmit={(e) => {
          e.preventDefault();
          setAplicados({ ...borrador });
        }}
      >
        <CatalogoSelect
          className="w-56"
          tipo="productos"
          titulo="Cereal"
          required={false}
          modoFiltro
          value={borrador.producto}
          onChange={(producto) => setBorrador({ ...borrador, producto })}
        />
        <CampaniaSelect
          value={borrador.campania}
          onChange={(campania) => setBorrador({ ...borrador, campania })}
        />
        <FilterActions
          onClear={() => {
            setBorrador(filtrosVacios);
            setAplicados(filtrosVacios);
          }}
        />
      </FilterBar>
      <DisponiblesPanel
        producto={aplicados.producto || undefined}
        campania={aplicados.campania}
        activo={activo}
      />
    </div>
  );
}
