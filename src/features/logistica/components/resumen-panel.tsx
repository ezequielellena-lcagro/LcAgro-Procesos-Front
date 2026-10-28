import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { campaniaVigente } from "@/shared/format/campania";
import { FilterActions, FilterBar } from "@/shared/components/filter-bar";
import { CampaniaSelect } from "./campania-select";
import { CatalogoSelect } from "./catalogo-select";
import { DisponiblesPanel } from "./disponibles-panel";
import { OtorgamientosRegistrados } from "./otorgamientos-registrados";

const filtrosVacios = { producto: 0, campania: "" };

/**
 * Pantalla de entrada de Cupos: los disponibles (cuántos hay en MacroGest de hoy en adelante, por
 * cereal, y cuántos de planta 0 vencieron sin usarse) y los otorgados, con su estado en MacroGest.
 * Juntos y no en solapas aparte: es lo que se pidió ver al abrir Cupos (2026-10-28).
 *
 * El seguimiento de lo pedido a cada terminal salía de los cupos recibidos en la app, que se
 * eliminaron; esa pregunta la contesta el historial de pedidos de cupo.
 */
export function ResumenPanel({ activo, gestionar }: { activo: boolean; gestionar: boolean }) {
  // Arranca en la campaña vigente; «Limpiar filtros» muestra todas.
  const [borrador, setBorrador] = useState(() => ({
    ...filtrosVacios,
    campania: campaniaVigente(),
  }));
  const [aplicados, setAplicados] = useState(borrador);
  // «Ver otorgados» al terminar de otorgar llega con #otorgados: baja directo a esa parte.
  const { hash } = useLocation();
  const otorgados = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (hash === "#otorgados") otorgados.current?.scrollIntoView?.({ block: "start" });
  }, [hash]);
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
      <h2
        id="otorgados"
        ref={otorgados}
        className="scroll-mt-20 border-t border-line pt-6 font-display text-xl text-ink"
      >
        Cupos otorgados
      </h2>
      <OtorgamientosRegistrados gestionar={gestionar} />
    </div>
  );
}
