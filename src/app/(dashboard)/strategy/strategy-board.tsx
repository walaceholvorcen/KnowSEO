"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, PenLine } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Keyword } from "@/types";

const DIFFICULTY_COLOR: Record<string, string> = {
  baja: "text-emerald-600 dark:text-emerald-400",
  media: "text-amber-600 dark:text-amber-400",
  alta: "text-red-600 dark:text-red-400",
};

const OPPORTUNITY_LABEL: Record<string, string> = {
  buena: "Buena",
  muy_buena: "Muy buena",
  excelente: "Excelente",
};

export function StrategyBoard({
  blogId,
  initialKeywords,
  credits,
}: {
  blogId: string;
  initialKeywords: Keyword[];
  credits: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [keywords, setKeywords] = useState(initialKeywords);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const suggested = keywords.filter((k) => k.status === "suggested");

  async function handleFindIdeas() {
    setLoadingIdeas(true);
    const res = await fetch("/api/keywords/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blogId }),
    });
    const data = await res.json();
    if (res.ok) {
      setKeywords((prev) => [...(data.keywords as Keyword[]), ...prev]);
    }
    setLoadingIdeas(false);
  }

  async function handleReject(id: string) {
    setKeywords((prev) =>
      prev.map((k) => (k.id === id ? { ...k, status: "rejected" } : k)),
    );
    await supabase.from("keywords").update({ status: "rejected" }).eq("id", id);
  }

  async function handleWrite(id: string) {
    setGeneratingId(id);
    const res = await fetch("/api/articles/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywordId: id }),
    });
    const data = await res.json();
    setGeneratingId(null);

    if (res.ok) {
      router.push(`/contents/${data.article.id}`);
    } else if (data.articleId) {
      router.push(`/contents/${data.articleId}`);
    } else {
      alert(data.error ?? "No se pudo generar el artículo");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Estratégia</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Oportunidades de keywords para o seu blog.
          </p>
        </div>
        <button
          onClick={handleFindIdeas}
          disabled={loadingIdeas}
          className="flex items-center gap-2 rounded-lg bg-navy-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          <Sparkles size={16} />
          {loadingIdeas ? "Buscando..." : "Buscar oportunidades"}
        </button>
      </div>

      {credits <= 0 && (
        <div className="mb-6 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          No te quedan créditos para generar artículos. Completa pasos de la
          guía de configuración para ganar más.
        </div>
      )}

      {suggested.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center text-slate-500 dark:text-slate-400">
          Sin sugerencias todavía. Haz clic en &ldquo;Buscar
          oportunidades&rdquo; para que la IA analice temas para tu blog.
        </div>
      ) : (
        <div className="space-y-3">
          {suggested.map((kw) => (
            <div
              key={kw.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    {kw.suggested_title || kw.keyword}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5">
                      {kw.keyword}
                    </span>
                    {kw.funnel_stage && (
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5">
                        {kw.funnel_stage === "top"
                          ? "Tope de embudo"
                          : kw.funnel_stage === "middle"
                            ? "Medio de embudo"
                            : "Fondo de embudo"}
                      </span>
                    )}
                    {kw.search_volume != null && (
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5">
                        {kw.search_volume.toLocaleString("es-ES")}{" "}
                        búsquedas/mes
                      </span>
                    )}
                    {kw.difficulty && (
                      <span
                        className={`font-medium ${DIFFICULTY_COLOR[kw.difficulty]}`}
                      >
                        Dificultad {kw.difficulty}
                      </span>
                    )}
                  </div>
                </div>
                {kw.opportunity_score && (
                  <span className="whitespace-nowrap rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    {OPPORTUNITY_LABEL[kw.opportunity_score]}
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => handleReject(kw.id)}
                  className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <X size={14} /> Rechazar
                </button>
                <button
                  onClick={() => handleWrite(kw.id)}
                  disabled={generatingId === kw.id || credits <= 0}
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-navy-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
                >
                  <PenLine size={14} />
                  {generatingId === kw.id ? "Generando..." : "Escribir artículo"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
