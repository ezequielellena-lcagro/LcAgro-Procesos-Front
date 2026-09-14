import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { DestinoDto } from "../types";

interface Props {
  destinos: DestinoDto[];
  value: number | null;
  onChange: (destinoId: number | null) => void;
  /** Alta rápida (R1.3): el POST es idempotente (200 existente / 201 nuevo) y siempre devuelve el destino. */
  onAgregar: (nombre: string) => Promise<DestinoDto>;
  id?: string;
  disabled?: boolean;
}

/**
 * Destino/campo del cliente elegido en la orden (R1.3): catálogo propio de cada cliente, no visible
 * para otro. Además de elegir uno existente, permite el alta rápida sin salir del formulario de la
 * orden — al confirmar, selecciona directamente el destino recién creado (o reactivado).
 */
export function DestinoSelect({ destinos, value, onChange, onAgregar, id, disabled }: Props) {
  const [nuevo, setNuevo] = useState("");
  const [agregando, setAgregando] = useState(false);

  const agregar = async () => {
    const nombre = nuevo.trim();
    if (nombre === "") return;
    setAgregando(true);
    try {
      const destino = await onAgregar(nombre);
      onChange(destino.id);
      setNuevo("");
    } catch {
      // El toast global de error (mutationCache.onError) ya le avisa a la planta que
      // falló el alta; acá sólo evitamos dejar la promesa de `onAgregar` sin manejar.
    } finally {
      setAgregando(false);
    }
  };

  return (
    <div className="space-y-2">
      <Select
        id={id}
        aria-label="Destino"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      >
        <option value="">Elegí un destino…</option>
        {destinos.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nombre}
          </option>
        ))}
      </Select>

      <div className="flex items-center gap-2">
        <Input
          aria-label="Nuevo destino"
          placeholder="Agregar destino…"
          value={nuevo}
          disabled={disabled || agregando}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void agregar();
            }
          }}
          className="h-9 flex-1"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void agregar()}
          disabled={disabled || agregando || nuevo.trim() === ""}
        >
          <Plus className="mr-1 size-3.5" />
          {agregando ? "Agregando…" : "Agregar destino"}
        </Button>
      </div>
    </div>
  );
}
