import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

interface Props {
  prestamoId: number;
  nroOperacion: string | null;
  cantidadCuotas: number;
  onEliminar: (id: number, confirmacion: string) => void;
  eliminando: boolean;
}

/**
 * Eliminar un préstamo, de verdad.
 *
 * <p>Es la operación más peligrosa del módulo: borra la <b>única copia</b> del dato — los
 * cronogramas viven sólo en nuestra base, MacroGest no los tiene. Por eso pide escribir el número
 * de operación: el error probable no es querer borrar, es borrar <b>el equivocado</b>.</p>
 *
 * <p>Es otra cosa que <i>anular</i>: anular es "existió y ya no va" y deja el préstamo con su
 * historia; esto es "no debería haberse cargado nunca".</p>
 */
export function EliminarPrestamo({
  prestamoId,
  nroOperacion,
  cantidadCuotas,
  onEliminar,
  eliminando,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [escrito, setEscrito] = useState("");

  // Sin número de operación se confirma con el Id: es lo único que identifica al préstamo, y es
  // justo el caso más fácil de confundir como para dejarlo sin protección.
  const esperado = nroOperacion?.trim() || String(prestamoId);
  const coincide = escrito.trim().toLowerCase() === esperado.toLowerCase();

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-md border border-destructive/25 bg-destructive/5 p-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-ink">Eliminar este préstamo</p>
          <p className="text-xs text-ink-soft">
            Se borra con todo su cronograma y no se puede deshacer. Si el préstamo existió y ya no
            va, conviene dejarlo y marcarlo cancelado.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setEscrito("");
            setAbierto(true);
          }}
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="mr-1 size-3.5" />
          Eliminar préstamo
        </Button>
      </div>

      <Modal
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Eliminar préstamo"
        className="max-w-md"
      >
        <p className="text-sm text-ink">
          Se borran el préstamo y sus <strong>{cantidadCuotas} cuotas</strong>. Esto no está en
          MacroGest: es la única copia, y no hay forma de recuperarlo.
        </p>

        <div className="mt-4">
          <Label htmlFor="confirmacion">
            Escribí <strong className="tabular">{esperado}</strong> para confirmar
          </Label>
          <Input
            id="confirmacion"
            value={escrito}
            onChange={(e) => setEscrito(e.target.value)}
            placeholder={esperado}
            className="mt-1"
            autoComplete="off"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!coincide || eliminando}
            onClick={() => onEliminar(prestamoId, escrito.trim())}
          >
            {eliminando ? "Eliminando…" : "Eliminar"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
