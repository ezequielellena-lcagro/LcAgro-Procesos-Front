import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDevolucionPublica } from "../queries/use-devolucion-publica";
import { useGuardarDevoluciones } from "../queries/use-guardar-devoluciones";

export function DevolucionPage() {
  const { token = "" } = useParams();
  const q = useDevolucionPublica(token);
  const guardar = useGuardarDevoluciones(token);

  // Edits locales del usuario: sólo guarda lo que el usuario modificó; el resto se lee de q.data.
  const [overrides, setOverrides] = useState<Record<number, string>>({});

  if (q.isPending) return <p className="p-8 text-center">Cargando…</p>;
  if (q.isError || !q.data) return <p className="p-8 text-center">Este link no es válido o venció. Pedí uno nuevo.</p>;

  const getDevol = (cuenta: number, defaultVal: string | null) =>
    cuenta in overrides ? overrides[cuenta] : (defaultVal ?? "");

  const usd = (n: number) => `US$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

  const onGuardar = () =>
    guardar.mutate(
      q.data.items.map((i) => ({
        cuenta: i.cuenta,
        devolucion: getDevol(i.cuenta, i.devolucion).trim() || null,
      })),
    );

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-2xl font-bold">Cuentas de {q.data.vendedor}</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Completá la devolución de cada cuenta y guardá. El link vence el{" "}
        {new Date(q.data.expiraUtc).toLocaleString("es-AR")}.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Cuenta</th>
            <th>Cliente</th>
            <th className="text-right">Vencido</th>
            <th className="text-right">A vencer</th>
            <th className="text-right">Saldo</th>
            <th>Devolución</th>
          </tr>
        </thead>
        <tbody>
          {q.data.items.map((i) => (
            <tr key={i.cuenta} className="border-b">
              <td className="py-2">{i.cuenta}</td>
              <td>{i.denominacion}</td>
              <td className="text-right">{usd(i.saldoVencido)}</td>
              <td className="text-right">{usd(i.saldoAVencer)}</td>
              <td className="text-right">{usd(i.saldo)}</td>
              <td>
                <Input
                  value={getDevol(i.cuenta, i.devolucion)}
                  onChange={(e) => setOverrides((prev) => ({ ...prev, [i.cuenta]: e.target.value }))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex justify-end">
        <Button onClick={onGuardar} disabled={guardar.isPending}>
          {guardar.isPending ? "Guardando…" : "Guardar devoluciones"}
        </Button>
      </div>
    </div>
  );
}
