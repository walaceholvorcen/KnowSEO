import { SettingsNav } from "../settings-nav";
import { ThemeSelector } from "./theme-selector";

export default function InterfaceSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        Configurações
      </h1>
      <SettingsNav />
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Interface
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Gerencie o tema da interface.
        </p>
        <div className="mt-4">
          <ThemeSelector />
        </div>
      </div>
    </div>
  );
}
