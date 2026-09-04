import { useRef, useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toAppError } from "@/lib/api-error";
import { useImportarCuentas, type ImportacionResultado } from "../queries/use-importar-cuentas";

/** El backend no puede saber de quién es un archivo sin filtrar: lo frena con este código. */
const VARIOS_VENDEDORES = "varios_vendedores";

/**
 * Botón "Importar" del listado: sube el .xlsx que devolvió un vendedor.
 *
 * El archivo que circula es el listado COMPLETO filtrado en Excel, así que trae también las cuentas de
 * los demás con la foto del momento del export. El backend se acota a las filas visibles; cuando el
 * filtro no viaja puesto no puede decidir de quién es el archivo y acá se pide confirmación explícita
 * antes de dejar que pise las cuentas de todos.
 */
export function ImportarCuentasButton() {
  const importar = useImportarCuentas();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aConfirmar, setAConfirmar] = useState<{ file: File; motivo: string } | null>(null);

  const subir = async (file: File, confirmarVariosVendedores: boolean) => {
    try {
      const r = await importar.mutateAsync({ file, confirmarVariosVendedores });
      setAConfirmar(null);
      toast.success(resumen(r));
      r.advertencias.forEach((a) => toast.info(a));
    } catch (e) {
      const error = toAppError(e);
      if (error.codigo === VARIOS_VENDEDORES) setAConfirmar({ file, motivo: error.message });
      else toast.error(error.message);
    }
  };

  const onArchivo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-seleccionar el mismo archivo
    if (file) void subir(file, false);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={onArchivo}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={importar.isPending}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="size-4" /> {importar.isPending ? "Importando…" : "Importar"}
      </Button>

      <Modal
        open={aConfirmar !== null}
        onClose={() => setAConfirmar(null)}
        title="El archivo no está filtrado por vendedor"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink">{aConfirmar?.motivo}</p>
          <p className="text-sm text-ink-soft">
            Si lo importás entero, las cuentas de los demás vendedores vuelven al valor que tenían cuando se
            generó el archivo y se pierde lo que hayas importado después.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAConfirmar(null)} disabled={importar.isPending}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="accent"
              disabled={importar.isPending}
              onClick={() => aConfirmar && void subir(aConfirmar.file, true)}
            >
              {importar.isPending ? "Importando…" : "Importar igual"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** Las filas ignoradas no van acá: las informa el backend por `advertencias`, con el porqué. */
function resumen(r: ImportacionResultado): string {
  const de = r.vendedorDetectado ? ` de ${r.vendedorDetectado}` : "";
  return `Importación lista${de}: ${r.cuentasActualizadas} cuenta(s) con cambios, ${r.sinCambios} sin cambios.`;
}
