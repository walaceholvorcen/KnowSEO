export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "know-seo-theme";

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

export function applyTheme(theme: ThemePreference) {
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.classList.toggle("dark", isDark);
}

type Listener = () => void;
let listeners: Listener[] = [];

// Pub/sub en memoria para que useSyncExternalStore re-renderice el
// selector de tema en la MISMA pestaña que hizo el cambio - el evento
// nativo "storage" del navegador solo dispara en otras pestañas.
export function subscribeTheme(listener: Listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function setTheme(theme: ThemePreference) {
  window.localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
  listeners.forEach((l) => l());
}

export function getServerTheme(): ThemePreference {
  return "system";
}

// Script inyectado inline en <head> (ver layout.tsx) para aplicar el modo
// oscuro ANTES del primer paint - sin esto habría un flash del tema
// incorrecto al cargar la página.
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var t = localStorage.getItem('${STORAGE_KEY}') || 'system';
    var isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;
