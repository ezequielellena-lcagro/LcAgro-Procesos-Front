import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        // `w-full` para que se comporte igual que Input: un <select> sin ancho es inline y se
        // acomoda al lado del <label>, que también lo es. Por eso en los formularios los campos
        // con desplegable quedaban con el rótulo al costado y los de texto no.
        "flex h-10 w-full rounded-md border border-input bg-panel px-3 text-sm text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
