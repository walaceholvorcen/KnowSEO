"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  applyTheme,
  getStoredTheme,
  getServerTheme,
  setTheme,
  subscribeTheme,
  type ThemePreference,
} from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

export function ThemeSelector() {
  // useSyncExternalStore evita el mismatch de hidratación (usa
  // getServerTheme en el render del servidor) y re-renderiza este
  // componente cuando setTheme() cambia la preferencia, sin necesitar
  // setState dentro de un efecto.
  const theme = useSyncExternalStore(
    subscribeTheme,
    getStoredTheme,
    getServerTheme,
  );

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme]);

  function handleSelect(value: ThemePreference) {
    setTheme(value);
  }

  return (
    <div className="flex gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleSelect(opt.value)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition",
              active
                ? "border-cobalto-600 dark:border-cobalto-400 bg-cobalto-50 dark:bg-cobalto-900/40 text-cobalto-700 dark:text-cobalto-300"
                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
            )}
          >
            <Icon size={16} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
