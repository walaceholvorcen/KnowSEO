"use client";

import { botao, campo, pagina } from "@/components/ui";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, PenLine, Layers } from "lucide-react";
import { descartarPauta } from "../acoes";
import { Lede, Linha, Secao } from "@/components/lede";
import { agruparEmPlanos } from "@/lib/keywords/cluster";
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
  const [keywords, setKeywords] = useState(initialKeywords);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descartando, setDescartando] = useState(false);

  const [assunto, setAssunto] = useState("");
  const [formPlano, setFormPlano] = useState(false);
  const [montando, setMontando] = useState(false);

  const suggested = keywords.filter((k) => k.status === "suggested");
  const { planos, soltas } = agruparEmPlanos(keywords);
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

  async function handleMontarPlano(e: React.FormEvent) {
    e.preventDefault();
    if (!assunto.trim() || montando) return;
    setMontando(true);
    setError(null);
    const res = await fetch("/api/keywords/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blogId, plano: true, assunto }),
    });
    const data = await res.json();
    setMontando(false);

    if (!res.ok) {
      setError(data.error ?? "Não foi possível montar o plano agora.");
      return;
    }
    setKeywords((prev) => [...(data.keywords as Keyword[]), ...prev]);
    setAssunto("");
    setFormPlano(false);
  }

  async function handleReject(id: string) {
    setKeywords((prev) =>
      prev.map((k) => (k.id === id ? { ...k, status: "rejected" } : k)),
    );
    await descartarPauta(id);
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
    suggested.length > 0
      ? `${suggested.length} ${suggested.length === 1 ? "pauta esperando" : "pautas esperando"} escolha.`
      : planos.length > 0
        ? "Todas as pautas viraram artigo. Monte o próximo plano para cobrir outro tema."
        : "Nenhuma pauta ainda. Comece por um plano: um artigo amplo e cinco específicos sobre o mesmo tema ranqueiam juntos.";

  // A mesma linha serve para pauta de plano e pauta solta.
  const linhaDaPauta = (kw: Keyword) => (
  <Linha key={kw.id}>
                <h3 className="font-medium text-slate-900 dark:text-slate-100">
                  {kw.suggested_title || kw.keyword}
                  {kw.cluster_papel && (
                    <span className="ml-2 whitespace-nowrap rounded-full bg-cobalto-50 px-2 py-0.5 align-middle text-xs font-medium text-cobalto-700 dark:bg-cobalto-900/40 dark:text-cobalto-300">
                      {kw.cluster_papel === "pilar" ? "Pilar" : "Apoio"}
                    </span>
                  )}
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
  );

  return (
    <div className={pagina()}>
      <Lede
        // "Volume medido" só quando existe volume: sem o Planejador do
        // Google ligado, a frase prometia uma medição que nenhuma pauta tinha.
        apoio={
          keywords.some((k) => k.search_volume != null)
            ? `Volume medido ${pais}. Pautas e artigos saem em ${idioma}.`
            : `Volume de busca ainda não conectado: dificuldade e oportunidade são leitura da IA. Pautas e artigos saem em ${idioma}.`
        }
        acao={
          <div className="flex flex-wrap items-center gap-2">
            {/* O plano vem primeiro de propósito: pauta solta compete
                sozinha, plano cobre um tema. É o caminho que ranqueia. */}
            <button
              onClick={() => setFormPlano((v) => !v)}
              aria-expanded={formPlano}
              className={botao("primario")}
            >
              <Layers size={15} aria-hidden />
              Montar plano
            </button>
            <button
              onClick={handleFindIdeas}
              disabled={loadingIdeas}
              className={botao("secundario")}
            >
              <Sparkles size={15} aria-hidden />
              {loadingIdeas ? "Buscando..." : "Pautas soltas"}
            </button>
          </div>
        }
      >
        {veredito}
      </Lede>

      {formPlano && (
        <form
          onSubmit={handleMontarPlano}
          className="-mt-2 mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <label
            htmlFor="assunto-do-plano"
            className="block font-medium text-slate-900 dark:text-slate-100"
          >
            Sobre qual tema é o plano?
          </label>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Um assunto, não uma busca: &ldquo;tráfego pago para clínicas&rdquo;,
            não &ldquo;quanto custa anúncio&rdquo;. Saem 6 pautas ligadas entre
            si - 1 pilar e 5 apoios.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              id="assunto-do-plano"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="tráfego pago para clínicas"
              className={cn(campo(), "min-w-0 flex-1")}
            />
            <button
              type="submit"
              disabled={montando || !assunto.trim()}
              className={botao("primario")}
            >
              {montando ? "Montando..." : "Montar plano"}
            </button>
          </div>
        </form>
      )}

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

      {planos.map((plano) => (
        <section key={plano.id} className="mb-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-200 pb-2 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              <Layers
                size={15}
                aria-hidden
                className="text-cobalto-600 dark:text-cobalto-400"
              />
              {plano.tema}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <span className="tabular font-display">{plano.escritos}</span> de{" "}
              <span className="tabular font-display">{plano.total}</span>{" "}
              escritos
            </p>
          </div>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {plano.pilar
              ? "O pilar cobre o tema inteiro. Cada apoio responde uma pergunta dele e recebe link do pilar quando os dois estiverem publicados."
              : "O pilar deste plano foi descartado. Os apoios continuam do mesmo tema e se ligam entre si."}
          </p>

          {plano.abertas.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Todas as pautas deste plano já viraram artigo.
            </p>
          ) : (
            <ul className="mt-1">{plano.abertas.map(linhaDaPauta)}</ul>
          )}
        </section>
      ))}

      {soltas.length > 0 && (
        <>
          {planos.length > 0 && <Secao>Pautas soltas</Secao>}
          <ul className="mt-1">{soltas.map(linhaDaPauta)}</ul>
        </>
      )}
    </div>
  );
}
