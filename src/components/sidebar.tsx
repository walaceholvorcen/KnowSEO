"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  FileText,
  Search,
  BarChart3,
  Settings,
  LogOut,
  Bot,
  Stethoscope,
  MapPin,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Início", icon: LayoutGrid },
  { href: "/contents", label: "Conteúdos", icon: FileText },
  { href: "/audit", label: "Auditoria", icon: Stethoscope },
  { href: "/strategy", label: "Estratégia", icon: Search },
  { href: "/visibility", label: "Visibilidade IA", icon: Bot },
  { href: "/gbp", label: "Google Meu Negócio", icon: MapPin },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
  { href: "/settings/brand", label: "Configurações", icon: Settings },
];

export function Sidebar({
  workspaceName,
  credits,
}: {
  workspaceName: string;
  credits: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-5">
        <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Know<span className="text-cobalto-600 dark:text-cobalto-400">SEO</span>
        </span>
        <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
          {workspaceName}
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-cobalto-50 dark:bg-cobalto-900/40 text-cobalto-700 dark:text-cobalto-300"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 px-5 py-4">
        <div className="rounded-lg bg-cobalto-50 dark:bg-cobalto-900/40 px-3 py-2 text-xs text-cobalto-700 dark:text-cobalto-300">
          <span className="font-semibold">{credits}</span>{" "}
          {credits === 1 ? "crédito" : "créditos"} disponíveis
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  );
}
