"use client";

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
    setCrawlResult(`${data.count} páginas detectadas y guardadas.`);
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
    <div className="space-y-4">
      {/* Detecção automática */}
      <form
        onSubmit={handleCrawl}
        className="rounded-xl border border-cobalto-200 dark:border-cobalto-700 bg-cobalto-50 dark:bg-cobalto-900/40 p-6"
      >
        <div className="mb-1 flex items-center gap-2">
          <Radar size={18} className="text-cobalto-600 dark:text-cobalto-300" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Detectar páginas automáticamente
          </h3>
        </div>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Lemos o sitemap do seu site e guardamos as páginas para que a IA
          possa criar links para elas dentro dos artigos.
        </p>

        <div className="flex gap-2">
          <input
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="suempresa.com"
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cobalto-500 dark:focus:border-cobalto-400"
          />
          <button
            type="submit"
            disabled={crawling}
            className="whitespace-nowrap rounded-lg bg-cobalto-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cobalto-700 disabled:opacity-50"
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
          <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {crawlError}
          </p>
        )}
        {crawlResult && (
          <p className="mt-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
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
            placeholder="https://suempresa.com/servicios"
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-cobalto-500 dark:focus:border-cobalto-400"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (opcional)"
            className="w-40 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-cobalto-500 dark:focus:border-cobalto-400"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Adicionar
          </button>
        </form>

        {links.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Aún no hay páginas mapeadas.
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
