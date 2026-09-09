"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/brand", label: "DNA da Marca" },
  { href: "/settings/blog", label: "Blog e Domínio" },
  { href: "/settings/integrations", label: "Integrações" },
  { href: "/settings/interface", label: "Interface" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <div className="mt-4 flex gap-1 border-b border-slate-200 dark:border-slate-800">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              active
                ? "border-cobalto-600 dark:border-cobalto-400 text-cobalto-700 dark:text-cobalto-300"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
