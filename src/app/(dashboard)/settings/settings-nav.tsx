"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  // Rótulos de uma palavra: com "DNA da Marca" e "Blog e Domínio" a barra
  // não cabia a 371px e quebrava em duas linhas.
  { href: "/settings/brand", label: "Marca" },
  { href: "/settings/blog", label: "Blog" },
  { href: "/settings/integrations", label: "Integrações" },
  { href: "/settings/interface", label: "Interface" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    // Rolagem horizontal própria: se um dia faltar espaço, a barra rola por
    // dentro em vez de quebrar linha ou empurrar a página para o lado.
    <nav
      aria-label="Seções das configurações"
      className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200 [scrollbar-width:none] dark:border-slate-800"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              // 44px no toque: a aba tinha 38 e é o único caminho entre as
              // quatro telas de configuração.
              "flex shrink-0 items-center whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium pointer-coarse:min-h-11",
              active
                ? "border-cobalto-600 dark:border-cobalto-400 text-cobalto-700 dark:text-cobalto-300"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
