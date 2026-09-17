"use client";

import { botao, campo, pagina } from "@/components/ui";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Radar, X } from "lucide-react";
import { Lede, Linha, Secao } from "@/components/lede";
import { cn } from "@/lib/utils";
import { deveAnalisarSozinho } from "@/lib/mercado/temas";
import type {
  MarketAnalysisRow,
  MarketChanceRow,
  MarketThemeRow,
} from "./page";

const MAX_CONCORRENTES = 4;

const SITUACAO_LABEL: Record<MarketThemeRow["situacao"], string> = {
  lacuna: "Você não tem nada",
  disputado: "Você escreve menos",
  seu_terreno: "Seu terreno",
};

export function MarketBoard({
  blogId,
  analise,
  temas,
  chances,
  sugeridos,
  gscPronto,
}: {
  blogId: string;
  analise: MarketAnalysisRow | null;
  temas: MarketThemeRow[];
  chances: MarketChanceRow[];
  sugeridos: string[];
  gscPronto: boolean;
}) {
  const router = useRouter();
  // Sem concorrente cadastrado, o formulário já nasce com os que o Raio X
  // viu citados no lugar da marca: é o melhor palpite que o produto tem, e
  // uma caixa vazia só adiava a primeira análise.
  const doRaioX = sugeridos.slice(0, MAX_CONCORRENTES);
  // Decidido uma vez, na montagem: o refresh depois da análise traz props
  // novas mas não remonta, então não redispara.
  const [autoInicial] = useState(() =>
    deveAnalisarSozinho({ analise, temas: temas.length, sugeridos: doRaioX }),
  );
  const [lista, setLista] = useState<string[]>(
    !autoInicial && analise?.competitor_domains?.length
      ? analise.competitor_domains
      : doRaioX,
  );
  const [rascunho, setRascunho] = useState("");
  const [rodando, setRodando] = useState(false);
  const [gerando, setGerando] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Set<number>>(new Set());
  // Análise disparada sozinha: quantos sites do Raio X foram usados (para o
  // aviso) e se o formulário de concorrentes fica recolhido até "Trocar".
  const [autoUsados, setAutoUsados] = useState<number | null>(null);
  const [autoRodando, setAutoRodando] = useState(autoInicial);
  const [formAberto, setFormAberto] = useState(!autoInicial);
  const disparou = useRef(false);
  // O botão só volta ao normal quando a tela já mostra o resultado. Antes o
  // estado caía ao chegar a resposta e o refresh (não aguardado) ainda
  // buscava os dados: por um instante a tela voltava igual, sem sinal.
  const [atualizando, startTransition] = useTransition();
  // Análise que o servidor disse já estar rodando (dedupe): a tela espera
  // por ela recarregando, em vez de abrir outra.
  const [aguardando, setAguardando] = useState<string | null>(null);
  const esperando =
    aguardando !== null &&
    !(analise?.id === aguardando && analise.status !== "running");
  const ocupado = rodando || atualizando || esperando;

  useEffect(() => {
    if (!esperando) return;
    const timer = setInterval(() => startTransition(() => router.refresh()), 4000);
    // Teto de 2,5 min: passou do maxDuration, a análise morreu sem fechar.
    const teto = setTimeout(() => setAguardando(null), 150_000);
    return () => {
      clearInterval(timer);
      clearTimeout(teto);
    };
  }, [esperando, router]);

  function adicionar(dominio: string) {
    const limpo = dominio
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/^www\./, "")
      .toLowerCase();
    if (!limpo || lista.includes(limpo) || lista.length >= MAX_CONCORRENTES) {
      return;
    }
    setLista((prev) => [...prev, limpo]);
    setRascunho("");
  }

  async function analisar(concorrentes: string[] = lista): Promise<boolean> {
    if (!concorrentes.length) return false;
    setRodando(true);
    setErro(null);

    // Sem try/catch, a conexão caindo deixava o botão preso em "Analisando...".
    try {
      const res = await fetch("/api/market/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogId, concorrentes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error ?? "Não foi possível analisar agora.");
        return false;
      }
      if (data.emAndamento) setAguardando(data.analysisId);
      startTransition(() => router.refresh());
      return true;
    } catch {
      setErro("Não foi possível analisar agora. Confira a conexão e tente de novo.");
      return false;
    } finally {
      setRodando(false);
    }
  }

  // Uma vez por carga (o ref segura o efeito duplo do modo estrito e o
  // refresh depois da análise). Depois que roda, a última análise passa a
  // ter exatamente estes domínios e deveAnalisarSozinho devolve false: não
  // há laço mesmo se o resultado vier vazio de novo.
  useEffect(() => {
    if (disparou.current || !autoInicial) return;
    disparou.current = true;
    analisar(doRaioX).then((ok) => {
      setAutoRodando(false);
      if (ok) setAutoUsados(doRaioX.length);
      // Falhou: o erro aparece e o formulário volta, para o cliente agir.
      else setFormAberto(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function gerarPauta(temaId: number) {
    setGerando(temaId);
    setErro(null);

    const res = await fetch("/api/keywords/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blogId, temaId }),
    });
    const data = await res.json();
    setGerando(null);

    if (!res.ok) {
      setErro(data.error ?? "Não foi possível gerar pautas para este tema.");
      return;
    }
    router.push("/strategy");
  }

  function alternar(id: number) {
    setAberto((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  const lacunas = temas.filter((t) => t.situacao === "lacuna").length;
  // "Não achamos temas em comum" costuma ser concorrente errado. Quando o
  // Raio X tem rivais reais e eles ainda não estão na lista, o atalho fica
  // ao lado do veredito, não escondido na fileira de sugestões.
  const semTemas = analise?.status === "done" && temas.length === 0;
  const raioXAjuda = semTemas && doRaioX.some((d) => !lista.includes(d));

  const veredito = !analise
    ? "Antes de escrever, olhe o mercado: onde seus concorrentes publicam e você não."
    : analise.status === "error"
      ? (analise.error_message ?? "A última análise falhou.")
      : lacunas > 0
        ? `${lacunas} ${lacunas === 1 ? "tema em que o mercado escreve" : "temas em que o mercado escreve"} e você não tem nada publicado.`
        : temas.length > 0
          ? "Você cobre todos os temas que seus concorrentes cobrem."
          : "Não achamos temas em comum. Tente concorrentes mais diretos.";

  // Barras comparáveis entre linhas: se cada uma fosse normalizada por si,
  // um tema com 2 artigos pareceria do mesmo tamanho de um com 22.
  const maiorTotal = Math.max(
    ...temas.map((t) => t.paginas_cliente + t.paginas_concorrentes),
    1,
  );

  return (
    <div className={pagina()}>
      <Lede
        apoio={
          analise?.status === "done" ? (
            <>
              Lemos {analise.competitor_pages.toLocaleString("pt-BR")} páginas
              de {analise.competitor_domains.length}{" "}
              {analise.competitor_domains.length === 1
                ? "concorrente"
                : "concorrentes"}{" "}
              e comparamos com as suas{" "}
              {analise.client_pages.toLocaleString("pt-BR")}.
            </>
          ) : (
            "Aponte de dois a quatro concorrentes diretos. Lemos o que eles publicaram e comparamos com o seu site."
          )
        }
        acao={
          <>
            {raioXAjuda && (
              <button
                onClick={() => setLista(doRaioX)}
                className={botao("secundario")}
              >
                Usar os concorrentes do Raio X
              </button>
            )}
            <button
              onClick={() => analisar()}
              disabled={ocupado || lista.length === 0}
              className={botao("primario")}
            >
              <Radar size={15} />
              {ocupado
                ? "Analisando..."
                : analise
                  ? "Refazer análise"
                  : "Analisar mercado"}
            </button>
          </>
        }
      >
        {veredito}
      </Lede>

      {autoUsados !== null && !formAberto && (
        <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
          Usamos os {autoUsados} sites que a IA cita no seu mercado.
          <button
            onClick={() => setFormAberto(true)}
            className={botao("fantasma", "sm")}
          >
            Trocar
          </button>
        </p>
      )}

      {/* Seleção de concorrentes ---------------------------------------- */}
      {formAberto && (
      <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {lista.map((dominio) => (
          <span
            key={dominio}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 pl-3 pr-2 text-sm text-slate-700 dark:text-slate-300"
          >
            {dominio}
            <button
              onClick={() => setLista((p) => p.filter((d) => d !== dominio))}
              aria-label={`Remover ${dominio}`}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X size={14} />
            </button>
          </span>
        ))}

        {lista.length < MAX_CONCORRENTES && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              adicionar(rascunho);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              placeholder="concorrente.com"
              aria-label="Domínio do concorrente"
              className={cn(campo("sm"), "w-44")}
            />
            <button
              type="submit"
              disabled={!rascunho.trim()}
              className={botao("secundario", "sm")}
            >
              <Plus size={14} /> Adicionar
            </button>
          </form>
        )}
      </div>

      {sugeridos.filter((s) => !lista.includes(s)).length > 0 &&
        lista.length < MAX_CONCORRENTES && (
          <p className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
            Citados no seu lugar pela IA:
            {sugeridos
              .filter((s) => !lista.includes(s))
              .map((dominio) => (
                <button
                  key={dominio}
                  onClick={() => adicionar(dominio)}
                  className="rounded-lg text-cobalto-600 dark:text-cobalto-400 hover:underline"
                >
                  {dominio}
                </button>
              ))}
          </p>
        )}
      </>
      )}

      {ocupado && (
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          {autoRodando &&
            `Analisando sozinho com os ${doRaioX.length} sites que a IA cita no seu mercado (${doRaioX.join(", ")}). `}
          Lendo o sitemap de cada concorrente. Costuma levar de 20 a 40
          segundos.
        </p>
      )}

      {erro && <p className="mb-6 text-sm text-nota-critico">{erro}</p>}

      {/* Chances reais do Google ---------------------------------------- */}
      {chances.length > 0 && (
        <>
          <Secao>Onde você já quase ganha</Secao>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Termos em que o Google já mostra o seu site. Dado dos últimos 90
            dias, direto do Search Console.
          </p>
          <ul className="mt-4">
            {chances.map((c) => (
              <Linha key={c.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="font-medium text-slate-900 dark:text-slate-100">
                    {c.query}
                  </h3>
                  <p className="tabular shrink-0 font-display text-sm text-slate-500 dark:text-slate-400">
                    posição {c.posicao.toFixed(1)} ·{" "}
                    {c.impressoes.toLocaleString("pt-BR")} exibições
                  </p>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {c.tipo === "pagina_dois"
                    ? "Está na página 2. Quem busca por isso já vê o seu site, mas quase ninguém rola até lá — um artigo dedicado costuma ser o empurrão que falta."
                    : "Já está na primeira página e mesmo assim ninguém clica. Aqui o problema não é o conteúdo, é o título e a descrição que aparecem no resultado."}
                </p>
              </Linha>
            ))}
          </ul>
        </>
      )}

      {/* Aparece antes da primeira análise também: é a camada de dado real
          do Google, e o cliente precisa saber que ela existe antes de rodar,
          não descobrir depois que faltou. */}
      {!gscPronto ? (
        <p className="mt-8 rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
          <Link
            href="/settings/integrations"
            className="font-medium text-cobalto-600 dark:text-cobalto-400 hover:underline"
          >
            Conecte o Search Console
          </Link>{" "}
          para ver, além da cobertura dos concorrentes, os termos em que o
          Google já mostra o seu site — e onde você está a um passo da
          primeira página.
        </p>
      ) : (
        analise?.status === "done" &&
        !analise.gsc_conectado && (
          <p className="mt-8 rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
            O Search Console foi conectado depois desta análise. Refaça para
            ver também os termos em que você já aparece.
          </p>
        )
      )}

      {/* Cobertura de conteúdo ------------------------------------------ */}
      {temas.length > 0 && (
        <>
          <Secao>Onde o mercado escreve</Secao>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Cada barra é o total de artigos publicados sobre o tema entre você
            e seus concorrentes. Isto conta artigos, não buscas: mostra o que o
            mercado achou que valia escrever.
          </p>

          <p className="mt-3 flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full bg-cobalto-600" />
              Seus artigos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full bg-slate-300 dark:bg-slate-600" />
              Dos concorrentes
            </span>
          </p>

          <ul className="mt-4">
            {temas.map((t) => {
              const isAberto = aberto.has(t.id);
              const total = t.paginas_cliente + t.paginas_concorrentes;

              return (
                <Linha key={t.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="font-medium text-slate-900 dark:text-slate-100">
                      {t.termo}
                    </h3>
                    <p className="tabular shrink-0 font-display text-sm text-slate-500 dark:text-slate-400">
                      {t.paginas_cliente} seu · {t.paginas_concorrentes} deles
                    </p>
                  </div>

                  <div
                    className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                    aria-hidden="true"
                  >
                    <div
                      className="bg-cobalto-600"
                      style={{
                        width: `${(t.paginas_cliente / maiorTotal) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-slate-300 dark:bg-slate-600"
                      style={{
                        width: `${(t.paginas_concorrentes / maiorTotal) * 100}%`,
                      }}
                    />
                  </div>

                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {SITUACAO_LABEL[t.situacao]}. {t.concorrentes_que_cobrem}{" "}
                    {t.concorrentes_que_cobrem === 1
                      ? "concorrente cobre"
                      : "concorrentes cobrem"}{" "}
                    este tema
                    {t.concorrentes_que_cobrem === 1 &&
                      " — pode ser o posicionamento dele, não demanda do mercado"}
                    .
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {t.exemplos.length > 0 && (
                      <button
                        onClick={() => alternar(t.id)}
                        aria-expanded={isAberto}
                        className={botao("secundario", "sm")}
                      >
                        {isAberto ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                        O que eles publicaram
                      </button>
                    )}
                    <button
                      onClick={() => gerarPauta(t.id)}
                      disabled={gerando !== null}
                      className={cn(botao("primario", "sm"), "ml-auto")}
                    >
                      {gerando === t.id ? "Gerando..." : "Gerar pauta"}
                    </button>
                  </div>

                  {isAberto && (
                    <ul className="mt-3 space-y-1.5 border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                      {t.exemplos.map((exemplo) => (
                        <li
                          key={exemplo}
                          className="text-sm text-slate-600 dark:text-slate-400"
                        >
                          {exemplo}
                        </li>
                      ))}
                    </ul>
                  )}

                  <span className="sr-only">
                    {total} artigos no total sobre este tema.
                  </span>
                </Linha>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
