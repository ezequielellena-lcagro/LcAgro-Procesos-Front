import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Los componentes Tabs.* deben usarse dentro de <Tabs>.");
  return ctx;
}

interface TabsProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
  children: ReactNode;
}

export function Tabs<T extends string>({ value, onValueChange, className, children }: TabsProps<T>) {
  return (
    <TabsContext.Provider value={{ value, onValueChange: onValueChange as (v: string) => void }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div role="tablist" className={cn("flex gap-1", className)}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useTabsContext();
  const active = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${value}`}
      aria-selected={active}
      aria-controls={`tabpanel-${value}`}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        "rounded-md border px-4 py-2 text-sm font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-panel text-ink-soft hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useTabsContext();
  if (ctx.value !== value) return null;
  return (
    <div role="tabpanel" id={`tabpanel-${value}`} aria-labelledby={`tab-${value}`}>
      {children}
    </div>
  );
}
