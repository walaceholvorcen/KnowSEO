"use client";

import { useEffect, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Logotipo } from "@/components/marca";
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
  Lock,
  Radar,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Prefixo que conta como "estou aqui" - Configurações tem várias abas. */
  match?: string;
  locked?: boolean;
}

// Agrupada pela ordem do trabalho: diagnosticar, produzir, medir o
// resultado. É a mesma corrente que o painel Início percorre, então o menu
// ensina o método sem precisar explicar. Os rótulos de grupo são orientação
// de leitura, em caixa normal - caixa alta acima de conteúdo é regra
// quebrada do projeto.
const GRUPOS: { rotulo: string | null; itens: Item[] }[] = [
  {
    rotulo: null,
    itens: [{ href: "/dashboard", label: "Início", icon: LayoutGrid }],
  },
  {
    rotulo: "Diagnóstico",
    itens: [
      { href: "/audit", label: "Auditoria - SEO", icon: Stethoscope },
      { href: "/visibility", label: "Raio X - GEO", icon: Bot },
      // Antes da Estratégia de propósito: olhar o mercado vem antes de
      // escolher a pauta.
      { href: "/market", label: "Mercado", icon: Radar },
      // Cadeado: recurso construído e pronto, guardado como upsell. A página
      // em /gbp mostra o estado bloqueado, não o painel real.
      { href: "/gbp", label: "Google Meu Negócio", icon: MapPin, locked: true },
    ],
  },
  {
    rotulo: "Produção",
    itens: [
      { href: "/strategy", label: "Estratégia", icon: Search },
      { href: "/contents", label: "Conteúdos", icon: FileText },
    ],
  },
  {
    rotulo: "Resultado",
    itens: [{ href: "/reports", label: "Relatórios", icon: BarChart3 }],
  },
];

const CONFIGURACOES: Item = {
  href: "/settings/brand",
  label: "Configurações",
  icon: Settings,
  match: "/settings",
};

export function Sidebar({
  credits,
  blog,
}: {
  credits: number;
  blog: { nome: string; endereco: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const fecharNoEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", fecharNoEsc);
    return () => window.removeEventListener("keydown", fecharNoEsc);
  }, [aberto]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function ativo(item: Item) {
    const base = item.match ?? item.href;
    return pathname === base || pathname.startsWith(base + "/");
  }

  function renderItem(item: Item) {
    const Icon = item.icon;
    const on = ativo(item);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={() => setAberto(false)}
          aria-current={on ? "page" : undefined}
          className={cn(
            "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none pointer-coarse:py-2.5",
            // O item ativo sobe para a superfície branca: lê como a tecla
            // pressionada de um instrumento, sem precisar de cor de fundo.
            on
              ? "bg-white text-slate-900 shadow-[0_1px_2px_rgb(21_25_28/0.08)] ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
              : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100",
          )}
        >
          <Icon
            size={17}
            aria-hidden="true"
            className={cn(
              "shrink-0",
              on
                ? "text-cobalto-600 dark:text-cobalto-400"
                : "text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300",
            )}
          />
          <span className="truncate">{item.label}</span>
          {!item.locked && <SinalDeCarregando />}
          {item.locked && (
            <Lock
              size={13}
              aria-label="Não incluído no seu plano"
              className="ml-auto shrink-0 text-slate-400 dark:text-slate-600"
            />
          )}
        </Link>
      </li>
    );
  }

  const marca = (
    <Logotipo className="text-base text-slate-900 dark:text-slate-100" />
  );

  return (
    <>
      {/* Celular e tablet: barra no topo com o menu recolhido. A barra lateral
          fixa ocupava a tela inteira numa tela estreita. */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-slate-100 px-4 dark:border-slate-800 dark:bg-slate-950 lg:hidden">
        <Link href="/dashboard">{marca}</Link>
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          aria-expanded={aberto}
          aria-controls="menu-principal"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </header>

      {aberto && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setAberto(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="menu-principal"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950",
          // `invisible` junto com o deslize: fechado, o menu sai também da
          // ordem do Tab. Só transladado, o teclado continuava entrando em
          // links fora da tela.
          "transition-[transform,visibility] duration-200 ease-out motion-reduce:transition-none",
          "lg:visible lg:static lg:z-auto lg:h-full lg:w-60 lg:shrink-0 lg:translate-x-0",
          aberto ? "visible translate-x-0" : "invisible -translate-x-full",
        )}
      >
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Fechar menu"
          className="absolute right-3 top-4 flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 lg:hidden"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="px-5 pb-4 pt-5">
          <Link href="/dashboard" onClick={() => setAberto(false)}>
            {marca}
          </Link>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            A evolução da busca começa aqui.
          </p>
        </div>

        {/* Qual blog está sendo operado. Toda ferramenta séria mostra o
            contexto em que a pessoa está mexendo - sem isto, nada na tela
            dizia de quem eram os números. */}
        <div className="mx-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {blog.nome}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {blog.endereco}
          </p>
        </div>

        <nav
          aria-label="Principal"
          className="flex-1 overflow-y-auto px-3 py-4"
        >
          {GRUPOS.map((grupo, i) => (
            <div key={grupo.rotulo ?? i} className={i > 0 ? "mt-5" : undefined}>
              {grupo.rotulo && (
                <p className="px-3 pb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {grupo.rotulo}
                </p>
              )}
              <ul className="space-y-0.5">{grupo.itens.map(renderItem)}</ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 px-3 pb-4 pt-3 dark:border-slate-800">
          <ul>{renderItem(CONFIGURACOES)}</ul>

          {/* Créditos como leitura de instrumento: número em mono, alinhado
              à direita, e o que ele significa em artigos logo embaixo. */}
          <div className="mt-3 px-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Créditos
              </span>
              <span className="tabular font-display text-lg text-slate-900 dark:text-slate-100">
                {credits}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {credits === 1
                ? "Dá para gerar 1 artigo"
                : `Dá para gerar ${credits} artigos`}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors duration-150 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <LogOut size={16} aria-hidden="true" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

// Confirmação de clique para quando o esqueleto da tela ainda não foi
// pré-carregado (rede lenta, primeiros segundos depois de abrir o painel).
// Tamanho fixo e sempre presente, só troca a opacidade: um indicador que
// aparece e some empurraria o texto do item.
function SinalDeCarregando() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ml-auto size-1.5 shrink-0 rounded-full bg-cobalto-500 transition-opacity duration-150",
        pending ? "opacity-100 motion-safe:animate-pulse" : "opacity-0",
      )}
    />
  );
}
