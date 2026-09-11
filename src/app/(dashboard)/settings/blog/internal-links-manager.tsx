"use client";

import { botao, campo } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Radar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { InternalLink } from "@/types";

export function InternalLinksManager({
  blogId,
  initialLinks,
}: {
  blogId: string;
  initialLinks: InternalLink[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [links, setLinks] = useState(initialLinks);

  // Detecção automática via sitemap
  const [siteUrl, setSiteUrl] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [crawlResult, setCrawlResult] = useState<string | null>(null);

  // Adição manual
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCrawl(e: React.FormEvent) {
    e.preventDefault();
    if (!siteUrl) return;

    setCrawling(true);
    setCrawlError(null);
    setCrawlResult(null);

    const res = await fetch("/api/internal-links/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blogId, siteUrl }),
    });
    const data = await res.json();
    setCrawling(false);

    if (!res.ok) {
      setCrawlError(data.error ?? "Não foi possível ler o site.");
      return;
    }

    setLinks(data.links as InternalLink[]);
    setCrawlResult(`${data.count} páginas detectadas e salvas.`);
    router.refresh();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!url) return;
    setSaving(true);

    const { data } = await supabase
      .from("internal_links")
      .insert({ blog_id: blogId, url, title: title || null })
      .select()
      .single();

    if (data) {
      setLinks((prev) => [data as InternalLink, ...prev]);
      setUrl("");
      setTitle("");
      router.refresh();
    }
    setSaving(false);
  }

  async function handleRemove(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    await supabase.from("internal_links").delete().eq("id", id);
  }

  return (
    <div className="space-y-8">
      {/* Fundo neutro de propósito: um bloco azul aqui competiria com o
          veredito no topo da página - só uma coisa grita por vez. */}
      <form onSubmit={handleCrawl}>
        <div className="mb-1 flex items-center gap-2">
          <Radar size={16} className="text-slate-400 dark:text-slate-500" />
          <h3 className="font-medium text-slate-900 dark:text-slate-100">
            Detectar páginas automaticamente
          </h3>
        </div>
        <p className="mb-4 text-slate-600 dark:text-slate-400">
          Lemos o sitemap do seu site e guardamos as páginas para que a IA
          possa criar links para elas dentro dos artigos.
        </p>

        <div className="flex gap-2">
          <input
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="suaempresa.com"
            className={cn(campo(), "flex-1")}
          />
          <button
            type="submit"
            disabled={crawling}
            className={botao("primario")}
          >
            {crawling ? "Analisando..." : "Analisar site"}
          </button>
        </div>

        {crawling && (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Pode levar até um minuto em sites grandes.
          </p>
        )}
        {crawlError && (
          <p className="mt-3 text-nota-critico">
            {crawlError}
          </p>
        )}
        {crawlResult && (
          <p className="mt-3 text-nota-excelente">
            {crawlResult}
          </p>
        )}
      </form>

      {/* Lista + adição manual */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <form onSubmit={handleAdd} className="mb-4 flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://suaempresa.com/servicos"
            className={cn(campo(), "flex-1")}
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (opcional)"
            className={cn(campo(), "w-40")}
          />
          <button
            type="submit"
            disabled={saving}
            className={botao("secundario")}
          >
            Adicionar
          </button>
        </form>

        {links.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Nenhuma página mapeada ainda.
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              {links.length}{" "}
              {links.length === 1 ? "página mapeada" : "páginas mapeadas"}
            </p>
            <ul className="max-h-80 divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto">
              {links.map((link) => (
                <li
                  key={link.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-slate-800 dark:text-slate-200">
                      {link.title || link.url}
                    </p>
                    {link.title && (
                      <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                        {link.url}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemove(link.id)}
                    className="shrink-0 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
