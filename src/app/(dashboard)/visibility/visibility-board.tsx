"use client";

import { botao, pagina } from "@/components/ui";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, X, Play, Sparkles } from "lucide-react";
import { Lede, Linha, Secao } from "@/components/lede";
import { cn } from "@/lib/utils";
import {
  ROTULO_MOTOR,
  perguntasComCitacao,
  perguntasDaRodada,
  placarPorMotor,
} from "@/lib/ai-visibility/resumo";
import { lerFontes } from "@/lib/ai-visibility/fontes";
import { FontesDoMercado } from "./fontes-do-mercado";
import type { AiQuery, AiVisibilityCheck } from "@/types";

const INTENT_LABEL: Record<string, string> = {
  discovery: "Descoberta",
  comparison: "Comparação",
  local: "Local",
  problem: "Problema",
};

// Os três assistentes que o produto sabe consultar, sempre na mesma ordem.
// Os que ainda não têm chave aparecem apagados: o cliente vê onde a medição
// existe e onde ainda não chega, em vez de achar que "a IA" é um lugar só.
const TODOS_OS_MOTORES = ["chatgpt", "perplexity", "claude"];

export interface RodadaResumo {
  id: string;
  status: "running" | "done" | "error";
  total: number;
  concluidas: number;
  error_message: string | null;
}

// Chave da rodada. O `run_id` é a resposta certa; a data existe só para as
// checagens gravadas antes de ele existir. Agrupar por dia fundia duas
// análises do mesmo dia num ponto só.
function chaveDaRodada(c: AiVisibilityCheck): string {
  return c.run_id ?? c.checked_at.slice(0, 10);
}

function buildTimeline(checks: AiVisibilityCheck[]) {
  const porRodada = new Map<
    string,
    { total: number; cited: number; quando: string }
  >();

  for (const c of checks) {
    const chave = chaveDaRodada(c);
    const entry = porRodada.get(chave) ?? {
      total: 0,
      cited: 0,
      quando: c.checked_at,
    };
    entry.total++;
    if (c.cited) entry.cited++;
    if (c.checked_at < entry.quando) entry.quando = c.checked_at;
    porRodada.set(chave, entry);
  }

  return [...porRodada.entries()]
    .map(([chave, v]) => ({
      chave,
      day: v.quando.slice(0, 10),
      score: Math.round((v.cited / v.total) * 100),
    }))
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-12);
}

function listaDeMotores(nomes: string[]): string {
  const rotulos = nomes.map((n) => ROTULO_MOTOR[n] ?? n);
  if (rotulos.length <= 1) return rotulos.join("");
  return `${rotulos.slice(0, -1).join(", ")} e ${rotulos[rotulos.length - 1]}`;
}

export function VisibilityBoard({
  blogId,
  queries,
  checks,
  rodada,
  motores,
}: {
  blogId: string;
  queries: AiQuery[];
  checks: AiVisibilityCheck[];
  rodada: RodadaResumo | null;
  motores: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"questions" | "run" | null>(null);
  const [gerando, setGerando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    rodada?.status === "error" ? rodada.error_message : null,
  );
  const [aberta, setAberta] = useState<string | null>(null);

  // Rodada acompanhada pela tela. Nasce do servidor quando o cliente volta
  // no meio de uma análise - é o que faz a tela reabrir em "12 de 30" em vez
  // de mostrar um botão parado convidando a recomeçar.
  const [runAtivo, setRunAtivo] = useState<string | null>(
    rodada?.status === "running" ? rodada.id : null,
  );
  const [progresso, setProgresso] = useState({
    concluidas: rodada?.status === "running" ? rodada.concluidas : 0,
    total: rodada?.status === "running" ? rodada.total : 0,
  });

  useEffect(() => {
    if (!runAtivo) return;
    let ultimo = 0;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/ai-visibility/status?runId=${runAtivo}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: string;
          total: number;
          concluidas: number;
          error_message: string | null;
        };

        if (data.status !== "running") {
          clearInterval(timer);
          setRunAtivo(null);
          if (data.status === "error") {
            setError(data.error_message ?? "A análise falhou.");
          }
          router.refresh();
          return;
        }

        setProgresso({ concluidas: data.concluidas, total: data.total });
        // As respostas aparecem conforme chegam, sem esperar a rodada toda.
        if (data.concluidas > ultimo) {
          ultimo = data.concluidas;
          router.refresh();
        }
      } catch {
        // Rede oscilou: o próximo ciclo tenta de novo. A análise não depende
        // desta tela, então perder uma consulta de progresso não perde nada.
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [runAtivo, router]);

  const latestRun = checks[0] ? chaveDaRodada(checks[0]) : null;
  const latest = checks.filter((c) => chaveDaRodada(c) === latestRun);

  const placar = placarPorMotor(latest);
  const porMotor = new Map(placar.map((p) => [p.provider, p]));
  const perguntasMedidas = perguntasDaRodada(latest);
  const perguntasCitadas = perguntasComCitacao(latest);

  const score = latest.length
    ? Math.round((latest.filter((c) => c.cited).length / latest.length) * 100)
    : null;
  const timeline = buildTimeline(checks);
  const previous =
    timeline.length > 1 ? timeline[timeline.length - 2].score : null;
  const delta = score !== null && previous !== null ? score - previous : null;

  const fontes = lerFontes(latest);

  const porPergunta = new Map<string, AiVisibilityCheck[]>();
  for (const c of latest) {
    const lista = porPergunta.get(c.query_id) ?? [];
    lista.push(c);
    porPergunta.set(c.query_id, lista);
  }

  async function analisar() {
    setBusy("run");
    setError(null);
    try {
      const res = await fetch("/api/ai-visibility/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Algo deu errado. Tente de novo.");
        return;
      }
      setProgresso({ concluidas: 0, total: data.total ?? 0 });
      setRunAtivo(data.runId);
    } catch {
      setError("Não foi possível iniciar a análise agora. Tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  async function gerarPerguntas() {
    setBusy("questions");
    setError(null);
    try {
      const res = await fetch("/api/ai-visibility/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogId }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Algo deu errado. Tente de novo.");
      else router.refresh();
    } catch {
      setError("Não foi possível gerar as perguntas agora.");
    } finally {
      setBusy(null);
    }
  }

  // O laço que faltava: a pergunta perdida vira pauta. Ferramentas de GEO
  // medem e param aí; aqui o módulo seguinte escreve a resposta.
  async function responderComArtigo(pergunta: string) {
    setGerando(pergunta);
    setError(null);
    try {
      const res = await fetch("/api/keywords/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogId, pergunta }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível gerar pautas para isto.");
        return;
      }
      router.push("/strategy");
    } catch {
      setError("Não foi possível gerar pautas agora.");
    } finally {
      setGerando(null);
    }
  }

  const achadoSemCitar = latest.filter(
    (c) => !c.cited && c.found_in_search,
  ).length;
  const rival = fontes.fontes.find((f) => f.tipo === "empresa");
  const [primeiroRival, vezesRival] = rival
    ? [rival.dominio, rival.perguntas]
    : [null, 0];
  const motoresMedidos = placar.map((p) => p.provider);

  const veredito =
    queries.length === 0
      ? "Ninguém sabe ainda se a IA cita você. Gere as perguntas que um cliente faria antes de contratar."
      : latest.length === 0
        ? runAtivo
          ? "Consultando os assistentes de IA. As primeiras respostas aparecem em instantes."
          : `${queries.length} perguntas prontas para consultar. Falta rodar a primeira análise.`
        : perguntasCitadas.size === 0
          ? `Em ${perguntasMedidas.size} perguntas do seu setor, nenhum assistente de IA citou você.`
          : `Você apareceu em ${perguntasCitadas.size} das ${perguntasMedidas.size} perguntas do seu setor.`;

  const apoio =
    latest.length === 0 ? (
      `A análise pergunta a ${listaDeMotores(motores.length ? motores : ["claude"])}, com busca na web ativa, o que um comprador perguntaria antes de contratar.`
    ) : (
      <>
        {primeiroRival && perguntasCitadas.size < perguntasMedidas.size
          ? `No seu lugar apareceu ${primeiroRival}, em ${vezesRival} ${vezesRival === 1 ? "pergunta" : "perguntas"}. `
          : ""}
        {achadoSemCitar > 0 &&
          `Em ${achadoSemCitar} ${achadoSemCitar === 1 ? "resposta a busca encontrou" : "respostas a busca encontrou"} o seu site e a IA escolheu outro. `}
        Medido em {listaDeMotores(motoresMedidos)}, com busca na web ativa.
      </>
    );

  const pct = progresso.total
    ? Math.min(100, Math.round((progresso.concluidas / progresso.total) * 100))
    : 0;

  return (
    <div className={pagina()}>
      <Lede
        apoio={apoio}
        acao={
          <>
            <button
              onClick={analisar}
              disabled={busy !== null || runAtivo !== null || queries.length === 0}
              className={botao("primario")}
            >
              <Play size={15} />
              {runAtivo ? "Analisando..." : busy === "run" ? "Iniciando..." : "Analisar agora"}
            </button>
            <button
              onClick={gerarPerguntas}
              disabled={busy !== null || runAtivo !== null}
              className={botao("secundario")}
            >
              <Sparkles size={15} />
              {busy === "questions" ? "Gerando..." : "Gerar perguntas"}
            </button>
          </>
        }
      >
        {veredito}
      </Lede>

      {runAtivo && (
        <div className="mb-8" role="status" aria-live="polite">
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="text-slate-700 dark:text-slate-300">
              Consultando {listaDeMotores(motores)}
            </span>
            <span className="tabular font-display text-slate-900 dark:text-slate-100">
              {progresso.concluidas} de {progresso.total}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-cobalto-600 transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${Math.max(pct, 3)}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Pode sair desta tela: a análise continua sozinha e as respostas
            aparecem aqui conforme chegam.
          </p>
        </div>
      )}

      {error && (
        <p className="mb-8 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-3 text-sm text-nota-critico">
          {error}
        </p>
      )}

      {/* Um placar por assistente. A divergência entre eles é a informação:
          cada um busca num índice diferente, e aparecer no Perplexity e
          sumir no ChatGPT é diagnóstico, não erro de medição. */}
      {latest.length > 0 && (
        <dl className="mb-2 grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {TODOS_OS_MOTORES.map((nome) => {
            const p = porMotor.get(nome);
            const ligado = motores.includes(nome);
            return (
              <div key={nome} className="px-4 py-3">
                <dt className="text-sm text-slate-500 dark:text-slate-400">
                  {ROTULO_MOTOR[nome]}
                </dt>
                <dd
                  className={cn(
                    "mt-1",
                    p ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-600",
                  )}
                >
                  {p ? (
                    <span className="tabular font-display">
                      <span className="text-2xl">{p.citadas}</span>
                      <span className="text-sm text-slate-400 dark:text-slate-500">
                        {" "}
                        de {p.total}
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm">
                      {ligado ? "Entra na próxima análise" : "Sem chave configurada"}
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      <FontesDoMercado leitura={fontes} />

      {timeline.length > 1 && (
        <>
          <Secao>Evolução</Secao>
          <div className="mt-4 flex h-32 items-end gap-3">
            {timeline.map((t) => (
              <div
                key={t.chave}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              >
                <span className="tabular text-sm text-slate-600 dark:text-slate-400">
                  {t.score}%
                </span>
                {/* Trilho com altura definida: sem ele o % da barra não
                    resolve e o gráfico aparece vazio. */}
                <div className="flex h-full w-full items-end">
                  <div
                    className="w-full bg-cobalto-600 dark:bg-cobalto-500"
                    style={{ height: `${Math.max(t.score, 2)}%` }}
                  />
                </div>
                <span className="tabular text-sm text-slate-400 dark:text-slate-500">
                  {t.day.slice(5)}
                </span>
              </div>
            ))}
          </div>
          {delta !== null && (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              {delta === 0
                ? "Sem mudança em relação à rodada anterior."
                : `${delta > 0 ? "Subiu" : "Caiu"} ${Math.abs(delta)} pontos em relação à rodada anterior.`}
            </p>
          )}
        </>
      )}

      <Secao>Perguntas monitoradas</Secao>
      {queries.length === 0 ? (
        <p className="mt-2 flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Bot size={18} />
          Nenhuma pergunta ainda. Gere o conjunto e rode a primeira análise.
        </p>
      ) : (
        <ul className="mt-4">
          {queries.map((q) => {
            const respostas = porPergunta.get(q.id) ?? [];
            const citou = respostas.some((r) => r.cited);
            return (
              <Linha key={q.id}>
                <div className="flex items-start gap-3">
                  <span className="mt-1 shrink-0">
                    {respostas.length === 0 ? (
                      <span className="block h-4 w-4 rounded-full border border-slate-300 dark:border-slate-600" />
                    ) : citou ? (
                      <Check size={16} className="text-nota-excelente" />
                    ) : (
                      <X size={16} className="text-slate-400 dark:text-slate-600" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-800 dark:text-slate-200">
                      {q.question}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {q.intent ? INTENT_LABEL[q.intent] : ""}
                      {respostas.length === 0 &&
                        (q.intent ? " · " : "") +
                          (runAtivo ? "Aguardando resposta" : "Ainda não consultada")}
                      {respostas.map((r) => (
                        <span key={r.id}>
                          {" · "}
                          <span
                            className={cn(
                              r.cited && "font-medium text-nota-excelente",
                            )}
                          >
                            {ROTULO_MOTOR[r.provider] ?? r.provider}:{" "}
                            {r.cited
                              ? r.match_type === "domain" && r.position
                                ? `citou você (${r.position}ª fonte)`
                                : "citou você"
                              : r.found_in_search
                                ? "achou seu site e citou outro"
                                : "não citou"}
                          </span>
                        </span>
                      ))}
                    </p>

                    {respostas.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {respostas.some((r) => r.answer_excerpt) && (
                          <button
                            onClick={() =>
                              setAberta(aberta === q.id ? null : q.id)
                            }
                            aria-expanded={aberta === q.id}
                            className={botao("secundario", "sm")}
                          >
                            {aberta === q.id
                              ? "Ocultar respostas"
                              : "Ver o que responderam"}
                          </button>
                        )}
                        {!citou && (
                          <button
                            onClick={() => responderComArtigo(q.question)}
                            disabled={gerando !== null}
                            className={botao("primario", "sm")}
                          >
                            {gerando === q.question
                              ? "Gerando..."
                              : "Escrever a resposta"}
                          </button>
                        )}
                      </div>
                    )}

                    {aberta === q.id && (
                      <div className="mt-3 space-y-3">
                        {respostas
                          .filter((r) => r.answer_excerpt)
                          .map((r) => (
                            <div key={r.id}>
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {ROTULO_MOTOR[r.provider] ?? r.provider}
                              </p>
                              <blockquote className="mt-1 whitespace-pre-line border-l-2 border-slate-200 dark:border-slate-700 pl-3 text-sm text-slate-600 dark:text-slate-400">
                                {r.answer_excerpt}
                              </blockquote>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </Linha>
            );
          })}
        </ul>
      )}
    </div>
  );
}
