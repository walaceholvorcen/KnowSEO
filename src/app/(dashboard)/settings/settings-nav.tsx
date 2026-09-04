"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/brand", label: "DNA da Marca" },
  { href: "/settings/blog", label: "Blog e Domínio" },
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
                ? "border-navy-600 dark:border-navy-400 text-navy-700 dark:text-navy-300"
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
