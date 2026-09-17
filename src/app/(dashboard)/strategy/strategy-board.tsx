"use client";

import { botao, pagina } from "@/components/ui";
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
  pais,
  idioma,
  foraDoIdioma = [],
  nomeIdiomaFora = "outro idioma",
}: {
  blogId: string;
  initialKeywords: Keyword[];
  pais: string;
  /** Idioma em que as pautas saem, deduzido do domínio. Fica na abertura
   *  para o cliente ver a dedução antes de gerar, não pelo artigo pronto. */
  idioma: string;
  /** Pautas sugeridas cujo texto está em outro idioma (acervo antigo). */
  foraDoIdioma?: string[];
  /** "português" quando todas as de fora são do mesmo idioma. */
  nomeIdiomaFora?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [keywords, setKeywords] = useState(initialKeywords);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descartando, setDescartando] = useState(false);

  const suggested = keywords.filter((k) => k.status === "suggested");
  const fora = new Set(foraDoIdioma);
  const qtdFora = suggested.filter((k) => fora.has(k.id)).length;

  // O servidor recalcula quais estão fora e devolve os ids que descartou;
  // a tela só marca como descartado o que o banco de fato mudou.
  async function handleDescartarForaDoIdioma() {
    setDescartando(true);
    setError(null);
    const res = await fetch("/api/keywords/descartar-fora-do-idioma", {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setDescartando(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível descartar as pautas agora.");
      return;
    }
    const ids = new Set<string>(data.ids ?? []);
    setKeywords((prev) =>
      prev.map((k) => (ids.has(k.id) ? { ...k, status: "rejected" } : k)),
    );
  }

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

  const veredito =
    suggested.length === 0
      ? "Nenhuma pauta sugerida ainda. Peça à IA para olhar o blog e sugerir por onde escrever."
      : `${suggested.length} ${suggested.length === 1 ? "pauta esperando" : "pautas esperando"} escolha.`;

  return (
    <div className={pagina()}>
      <Lede
        apoio={`Volume medido ${pais}. Pautas e artigos saem em ${idioma}.`}
        acao={
          <button
            onClick={handleFindIdeas}
            disabled={loadingIdeas}
            className={botao("primario")}
          >
            <Sparkles size={15} />
            {loadingIdeas ? "Buscando..." : "Buscar pautas"}
          </button>
        }
      >
        {veredito}
      </Lede>

      {error && <p className="mb-6 text-nota-critico">{error}</p>}

      {qtdFora > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 border-l-2 border-l-nota-atencao px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:border-l-nota-atencao dark:text-slate-300">
          <p>
            {qtdFora}{" "}
            {qtdFora === 1 ? "pauta foi gerada" : "pautas foram geradas"} em{" "}
            {nomeIdiomaFora} antes da configuração atual.
          </p>
          <button
            onClick={handleDescartarForaDoIdioma}
            disabled={descartando}
            className={botao("secundario", "sm")}
          >
            {descartando ? "Descartando..." : "Descartar todas"}
          </button>
        </div>
      )}

      {suggested.length > 0 && (
        <ul>
          {suggested.map((kw) => (
            <Linha key={kw.id}>
              <h3 className="font-medium text-slate-900 dark:text-slate-100">
                {kw.suggested_title || kw.keyword}
                {fora.has(kw.id) && (
                  <span className="ml-2 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 align-middle text-xs font-medium text-nota-atencao dark:bg-slate-800">
                    fora do idioma
                  </span>
                )}
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {kw.keyword}
                {kw.funnel_stage && <>. {FUNNEL_LABEL[kw.funnel_stage]}</>}
              </p>

              {/* Medição e opinião em linhas separadas, e nomeadas. Antes as
                  duas se misturavam na mesma frase e o cliente não tinha como
                  saber que o volume era do Google e a dificuldade era palpite
                  do modelo. */}
              {kw.search_volume != null && (
                <p className="mt-1.5 text-slate-700 dark:text-slate-300">
                  <span className="tabular font-display">
                    {kw.search_volume.toLocaleString("pt-BR")}
                  </span>{" "}
                  buscas por mês {pais}
                  {kw.competition_index != null && (
                    <>
                      {" "}
                      · concorrência de anunciantes{" "}
                      <span className="tabular font-display">
                        {kw.competition_index}
                      </span>
                      /100
                    </>
                  )}
                </p>
              )}

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {kw.search_volume == null && "Sem volume medido. "}
                Leitura da IA:
                {kw.difficulty && (
                  <>
                    {" "}
                    dificuldade{" "}
                    <span className={DIFFICULTY_COLOR[kw.difficulty]}>
                      {DIFFICULTY_LABEL[kw.difficulty].toLowerCase()}
                    </span>
                  </>
                )}
                {kw.opportunity_score && (
                  <>
                    {kw.difficulty && ","} oportunidade{" "}
                    {OPPORTUNITY_LABEL[kw.opportunity_score]}
                  </>
                )}
                .
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => handleReject(kw.id)}
                  className={botao("secundario", "sm")}
                >
                  <X size={14} /> Descartar
                </button>
                <button
                  onClick={() => handleWrite(kw.id)}
                  disabled={generatingId === kw.id}
                  className={cn(botao("primario", "sm"), "ml-auto")}
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
