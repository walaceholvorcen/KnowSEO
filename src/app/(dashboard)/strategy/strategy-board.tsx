"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, PenLine } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Lede, Linha } from "@/components/lede";
import { cn } from "@/lib/utils";
import type { Keyword } from "@/types";

// Os valores gravados no banco são os códigos internos ("baja", "alta") -
// o rótulo em português mora só aqui, na borda de exibição.
const DIFFICULTY_LABEL: Record<string, string> = {
  baja: "Baixa",
  media: "Média",
  alta: "Alta",
};

// Reaproveita a linguagem de cor já estabelecida pelas notas: fácil de
// ranquear é a mesma ideia de "saudável", difícil é a mesma de "atenção".
const DIFFICULTY_COLOR: Record<string, string> = {
  baja: "text-nota-excelente",
  media: "text-nota-atencao",
  alta: "text-nota-critico",
};

const FUNNEL_LABEL: Record<string, string> = {
  top: "Topo de funil",
  middle: "Meio de funil",
  bottom: "Fundo de funil",
};

const OPPORTUNITY_LABEL: Record<string, string> = {
  buena: "boa",
  muy_buena: "muito boa",
  excelente: "excelente",
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
  const [error, setError] = useState<string | null>(null);

  const suggested = keywords.filter((k) => k.status === "suggested");

  async function handleFindIdeas() {
    setLoadingIdeas(true);
    setError(null);
    const res = await fetch("/api/keywords/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blogId }),
    });
    const data = await res.json();
    setLoadingIdeas(false);

    if (!res.ok) {
      setError(data.error ?? "Não foi possível buscar pautas agora.");
      return;
    }
    setKeywords((prev) => [...(data.keywords as Keyword[]), ...prev]);
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
      setError(data.error ?? "Não foi possível gerar o artigo.");
    }
  }

  const semCreditos = credits <= 0;

  const veredito = semCreditos
    ? "Seus créditos acabaram. Conclua a configuração para ganhar mais."
    : suggested.length === 0
      ? "Nenhuma pauta sugerida ainda. Peça à IA para olhar o blog e sugerir por onde escrever."
      : `${suggested.length} ${suggested.length === 1 ? "pauta esperando" : "pautas esperando"} escolha.`;

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <Lede
        acao={
          !semCreditos && (
            <button
              onClick={handleFindIdeas}
              disabled={loadingIdeas}
              className="flex items-center gap-2 rounded-lg bg-cobalto-600 px-4 py-2 font-semibold text-white hover:bg-cobalto-700 disabled:opacity-50"
            >
              <Sparkles size={15} />
              {loadingIdeas ? "Buscando..." : "Buscar pautas"}
            </button>
          )
        }
      >
        {veredito}
      </Lede>

      {error && <p className="mb-6 text-nota-critico">{error}</p>}

      {suggested.length > 0 && (
        <ul>
          {suggested.map((kw) => (
            <Linha key={kw.id}>
              <h3 className="font-medium text-slate-900 dark:text-slate-100">
                {kw.suggested_title || kw.keyword}
              </h3>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {kw.keyword}
                {kw.funnel_stage && <>. {FUNNEL_LABEL[kw.funnel_stage]}</>}
                {kw.difficulty && (
                  <>
                    , dificuldade{" "}
                    <span className={DIFFICULTY_COLOR[kw.difficulty]}>
                      {DIFFICULTY_LABEL[kw.difficulty].toLowerCase()}
                    </span>
                  </>
                )}
                {kw.search_volume != null && (
                  <>
                    {" "}
                    · {kw.search_volume.toLocaleString("pt-BR")} buscas por
                    mês
                  </>
                )}
                {kw.opportunity_score && (
                  <>. Oportunidade {OPPORTUNITY_LABEL[kw.opportunity_score]}.</>
                )}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => handleReject(kw.id)}
                  className={cn(
                    "flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5",
                    "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
                  )}
                >
                  <X size={14} /> Descartar
                </button>
                <button
                  onClick={() => handleWrite(kw.id)}
                  disabled={generatingId === kw.id || semCreditos}
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-cobalto-600 px-3 py-1.5 font-semibold text-white hover:bg-cobalto-700 disabled:opacity-50"
                >
                  <PenLine size={14} />
                  {generatingId === kw.id ? "Gerando..." : "Escrever artigo"}
                </button>
              </div>
            </Linha>
          ))}
        </ul>
      )}
    </div>
  );
}
