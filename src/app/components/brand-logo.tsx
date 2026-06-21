// Marca textual (placeholder). Cuando estén los PNG del mockup en src/assets/brand/, se reemplaza
// por <img> con fallback. Por ahora "LC" + "La Clementina" para no depender de assets faltantes.
export function BrandLogo({ collapsed }: { collapsed: boolean }) {
  const mark = (
    <div className="grid size-9 flex-none place-items-center rounded-[9px] bg-clementina font-display text-base font-bold text-slate-brand">
      LC
    </div>
  );

  if (collapsed) return mark;

  return (
    <div className="flex items-center gap-2.5">
      {mark}
      <span className="font-display text-[15px] font-semibold leading-tight text-white">
        La Clementina
      </span>
    </div>
  );
}
