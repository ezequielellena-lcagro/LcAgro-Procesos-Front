/**
 * Lo que ya se eligió, arriba de la pantalla.
 *
 * Las operaciones de cupos se arman en dos tiempos: primero se busca un registro en una grilla
 * larga y después se completan los datos. Mientras la elección vivía como una línea de texto entre
 * medio de la grilla y el formulario, no se veía qué contrato se estaba por usar. Acá queda fija
 * arriba, con sus campos rotulados, y con un estado vacío que dice qué falta hacer.
 */
export function ElegidoPanel({
  titulo,
  vacio,
  datos,
}: {
  titulo: string;
  /** Qué hacer cuando todavía no se eligió nada. */
  vacio: string;
  /** Campos del registro elegido, o `null`/`undefined` si no hay ninguno. */
  datos: { rotulo: string; valor: string }[] | null | undefined | false;
}) {
  return (
    <section
      aria-label={titulo}
      className="rounded-card border border-line bg-panel p-4 shadow-card"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{titulo}</h2>
      {datos ? (
        <dl className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {datos.map((d) => (
            <div key={d.rotulo}>
              <dt className="text-xs text-ink-soft">{d.rotulo}</dt>
              <dd className="text-sm font-medium text-ink">{d.valor}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-1.5 text-sm text-ink-soft">{vacio}</p>
      )}
    </section>
  );
}
