import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { kg, unidades } from "../format";
import { duenioEtiqueta, recortar } from "../lib/etiquetas-lote";
import {
  agruparElegibles,
  filtrarElegibles,
  filtrosDeFila,
  mismaClave,
  variedadesDeElegibles,
  type FiltrosElegibles,
  type LoteElegible,
  type RenglonEditable,
} from "../lib/orden";
import { ENVASES, type EnvaseSemillero, type StockFilaDto } from "../types";

/** Largo de las observaciones dentro de una opción: el texto completo se ve al elegirla (R2.2). */
const LARGO_OBSERVACIONES_EN_OPCION = 40;

const claveDe = (l: { loteId: number; ubicacionId: number }) => `${l.loteId}:${l.ubicacionId}`;

const kgMaximo = (e: LoteElegible) => kg(e.maximo * e.pesoUnitarioKg);

function etiquetaOpcion(e: LoteElegible): string {
  const disponible = `disp. ${unidades(e.maximo)} (${kgMaximo(e)})`;
  const base = `Lote ${e.loteCodigo} · ${e.ubicacion} · ${duenioEtiqueta(e)} · ${disponible}`;
  return e.observaciones
    ? `${base} · ${recortar(e.observaciones, LARGO_OBSERVACIONES_EN_OPCION)}`
    : base;
}

function mensajeSinOpciones(
  cantidadPorAgregar: number,
  cantidadVisibles: number,
  hayCliente: boolean,
): string | null {
  if (cantidadPorAgregar === 0) {
    return hayCliente
      ? "No hay lotes con disponible."
      : "No hay lotes con disponible. La semilla de clientes aparece al elegir el cliente.";
  }
  return cantidadVisibles === 0 ? "No hay lotes disponibles con esos filtros." : null;
}

/** Id del detalle bajo el selector: lo anuncia el lector de pantalla al pasar por él (R2.2). */
const ID_DETALLE = "nuevoRenglonDetalle";

interface Props {
  /** Lotes × ubicación que la orden admite, con la regla de dueño y el máximo ya aplicados. */
  elegibles: LoteElegible[];
  /** Lo ya cargado en la orden: no se vuelve a ofrecer. */
  renglones: RenglonEditable[];
  hayCliente: boolean;
  /** Fila de Stock con la que arranca: sus filtros y ese lote × ubicación ya elegido (R4.2). */
  loteInicial?: StockFilaDto | null;
  onAgregar: (renglon: RenglonEditable) => void;
}

/**
 * Selector de renglones de la orden con sus propios filtros (R3): variedad, tratamiento y envase
 * acotan SÓLO lo que se ofrece para agregar; los renglones ya cargados y los totales no dependen de
 * ellos. Las opciones van agrupadas por producto y cada lote muestra su disponible (R2.1), para no
 * cargar, por ejemplo, semilla tratada cuando la pidieron sin tratar.
 */
export function AgregarRenglon({
  elegibles,
  renglones,
  hayCliente,
  loteInicial,
  onAgregar,
}: Props) {
  const [filtros, setFiltros] = useState<FiltrosElegibles>(() =>
    loteInicial ? filtrosDeFila(loteInicial) : {},
  );
  // La cantidad no se precarga: la tipea el usuario.
  const [clave, setClave] = useState(() => (loteInicial ? claveDe(loteInicial) : ""));
  const [cantidadTexto, setCantidadTexto] = useState("");
  const [error, setError] = useState<string | null>(null);

  const variedades = variedadesDeElegibles(elegibles);
  const quedanPorAgregar = elegibles.filter((e) => !renglones.some((r) => mismaClave(r, e)));
  // Una variedad que ya no está entre los elegibles (p. ej. al cambiar el cliente) no filtra: el
  // selector la mostraría como "Todas" y la lista quedaría vacía sin explicación.
  const efectivos = (f: FiltrosElegibles): FiltrosElegibles =>
    variedades.some((v) => v.id === f.variedadId) ? f : { ...f, variedadId: undefined };
  const visiblesCon = (f: FiltrosElegibles) => filtrarElegibles(quedanPorAgregar, efectivos(f));

  const visibles = visiblesCon(filtros);
  // Nunca queda elegido un lote que no se ve (R3.3): ni para mostrarlo ni para agregarlo.
  const elegido = visibles.find((e) => claveDe(e) === clave);
  const mensaje = mensajeSinOpciones(quedanPorAgregar.length, visibles.length, hayCliente);

  const cambiarFiltros = (cambio: FiltrosElegibles) => {
    const nuevos = { ...filtros, ...cambio };
    setFiltros(nuevos);
    if (!visiblesCon(nuevos).some((e) => claveDe(e) === clave)) setClave("");
  };

  const agregar = () => {
    setError(null);
    if (!elegido) {
      setError("Elegí un lote y una ubicación.");
      return;
    }
    const cantidad = Number(cantidadTexto);
    if (cantidadTexto.trim() === "" || Number.isNaN(cantidad) || cantidad <= 0) {
      setError("La cantidad tiene que ser mayor a 0.");
      return;
    }
    if (cantidad > elegido.maximo) {
      setError(`Hay ${unidades(elegido.maximo)} disponibles para ese lote y ubicación.`);
      return;
    }
    onAgregar({ loteId: elegido.loteId, ubicacionId: elegido.ubicacionId, cantidad });
    setClave("");
    setCantidadTexto("");
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <Filtro id="filtroVariedad" label="Variedad">
          <Select
            id="filtroVariedad"
            value={efectivos(filtros).variedadId ?? ""}
            onChange={(e) =>
              cambiarFiltros({ variedadId: e.target.value ? Number(e.target.value) : undefined })
            }
          >
            <option value="">Todas</option>
            {variedades.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </Select>
        </Filtro>
        <Filtro id="filtroTratamiento" label="Tratamiento">
          <Select
            id="filtroTratamiento"
            value={filtros.tratada === undefined ? "" : String(filtros.tratada)}
            onChange={(e) =>
              cambiarFiltros({
                tratada: e.target.value === "" ? undefined : e.target.value === "true",
              })
            }
          >
            <option value="">Tratada y sin tratar</option>
            <option value="true">Tratada</option>
            <option value="false">Sin tratar</option>
          </Select>
        </Filtro>
        <Filtro id="filtroEnvase" label="Envase">
          <Select
            id="filtroEnvase"
            value={filtros.envase ?? ""}
            onChange={(e) =>
              cambiarFiltros({
                envase: (e.target.value || undefined) as EnvaseSemillero | undefined,
              })
            }
          >
            <option value="">Todos</option>
            {ENVASES.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.etiqueta}
              </option>
            ))}
          </Select>
        </Filtro>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor="nuevoRenglon">Agregar renglón</Label>
          <Select
            id="nuevoRenglon"
            aria-describedby={elegido || mensaje ? ID_DETALLE : undefined}
            value={elegido ? clave : ""}
            onChange={(e) => setClave(e.target.value)}
          >
            <option value="">Elegí un lote y una ubicación…</option>
            {agruparElegibles(visibles).map((grupo) => (
              <optgroup key={grupo.clave} label={grupo.etiqueta}>
                {grupo.lotes.map((e) => (
                  <option key={claveDe(e)} value={claveDe(e)}>
                    {etiquetaOpcion(e)}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <div className="w-28 space-y-1">
          <Label htmlFor="nuevaCantidad">Cantidad</Label>
          <Input
            id="nuevaCantidad"
            type="number"
            min="0.01"
            step="0.01"
            value={cantidadTexto}
            onChange={(e) => setCantidadTexto(e.target.value)}
          />
        </div>
        <Button type="button" variant="outline" onClick={agregar}>
          Agregar
        </Button>
      </div>

      {elegido ? (
        <div id={ID_DETALLE} className="text-xs text-ink-soft">
          <p>{`Disponible: ${unidades(elegido.maximo)} unidades · ${kgMaximo(elegido)}`}</p>
          {elegido.observaciones && (
            <p className="whitespace-pre-line text-ink">{elegido.observaciones}</p>
          )}
        </div>
      ) : (
        mensaje && (
          <p id={ID_DETALLE} className="text-xs text-ink-soft">
            {mensaje}
          </p>
        )
      )}
      {error && <p className="text-xs text-rojo">{error}</p>}
    </div>
  );
}

function Filtro({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-ink-soft">
        {label}
      </Label>
      {children}
    </div>
  );
}
