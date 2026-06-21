import { useEffect, useState } from "react";

/** Flag booleano persistido en localStorage (para recordar el colapso de los sidebars). */
export function usePersistedFlag(key: string, initial = false) {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as boolean);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
