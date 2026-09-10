"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, X, Play, Sparkles } from "lucide-react";
import { Lede, Linha, Secao } from "@/components/lede";
import type { AiQuery, AiVisibilityCheck } from "@/types";

const INTENT_LABEL: Record<string, string> = {
  discovery: "Descoberta",
  comparison: "Comparação",
  local: "Local",
  problem: "Problema",
};

// Chave da rodada. O `run_id` é a resposta certa; a data existe só para as
// checagens gravadas antes de ele existir. Agrupar por dia fundia duas
// análises do mesmo dia num ponto só - "15 perguntas" virava "30" - e partia
// em dois uma rodada que atravessasse a meia-noite.
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
    // A rodada é datada pela checagem mais antiga dela, para o eixo do
    // gráfico não pular quando a análise atravessa a meia-noite.
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

export function VisibilityBoard({
  blogId,
  queries,
  checks,
}: {
  blogId: string;
  queries: AiQuery[];
  checks: AiVisibilityCheck[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"questions" | "run" | null>(null);
  const [gerando, setGerando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  const latestRun = checks[0] ? chaveDaRodada(checks[0]) : null;
  const latest = checks.filter((c) => chaveDaRodada(c) === latestRun);
  const score = latest.length
    ? Math.round((latest.filter((c) => c.cited).length / latest.length) * 100)
    : null;

  const timeline = buildTimeline(checks);
  const previous = timeline.length > 1 ? timeline[timeline.length - 2].score : null;
  const delta = score !== null && previous !== null ? score - previous : null;

  function contar(pegar: (c: AiVisibilityCheck) => string[]) {
    const contagem = new Map<string, number>();
    for (const c of latest) {
      for (const d of pegar(c)) {
        contagem.set(d, (contagem.get(d) ?? 0) + 1);
      }
    }
    return [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }

  const topCompetitors = contar((c) => c.competitors);
  const topDirectories = contar((c) => c.directories ?? []);

  const latestByQuery = new Map<string, AiVisibilityCheck>();
  for (const c of checks) {
    if (!latestByQuery.has(c.query_id)) latestByQuery.set(c.query_id, c);
  }

  async function call(endpoint: string, kind: "questions" | "run") {
    setBusy(kind);
    setError(null);
    // Sem try/catch, uma função que estourasse o tempo limite deixava o
    // botão preso em "Analisando..." até o cliente recarregar a página.
    try {
      const res = await fetch(`/api/ai-visibility/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogId }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Algo deu errado. Tente de novo.");
      else router.refresh();
    } catch {
      setError(
        "A análise demorou demais ou a conexão caiu. As perguntas já respondidas foram salvas; rode de novo para completar.",
      );
    } finally {
      setBusy(null);
    }
  }

  // O laço que faltava: a pergunta perdida vira pauta. Isto é o que nenhuma
  // ferramenta de GEO faz - elas medem e param aí; aqui o módulo seguinte
  // escreve a resposta.
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

  const citadas = latest.filter((c) => c.cited).length;
  const achadoSemCitar = latest.filter(
    (c) => !c.cited && c.found_in_search,
  ).length;
  const [primeiroRival, vezesRival] = topCompetitors[0] ?? [null, 0];

  // O motor medido, dito com todas as letras. A tela já afirmou "quando
  // alguém pergunta ao ChatGPT" enquanto media o Claude - afirmação falsa
  // numa tela que serve de prova comercial.
  const MOTOR: Record<string, string> = { claude: "Claude" };
  const motor = MOTOR[latest[0]?.provider ?? ""] ?? latest[0]?.provider ?? null;

  // A frase que o cliente manda para o chefe. O número sozinho ("0%") não
  // diz nada; quem a IA cita no lugar dele, sim.
  const veredito =
    queries.length === 0
      ? "Ninguém sabe ainda se a IA cita você. Gere as perguntas que um cliente faria antes de contratar."
      : latest.length === 0
        ? `${queries.length} perguntas prontas para consultar. Falta rodar a primeira análise.`
        : citadas === 0
          ? `Em ${latest.length} perguntas do seu setor, a IA não citou você nenhuma vez.`
          : `A IA citou você em ${citadas} das ${latest.length} perguntas do seu setor.`;

  const apoio = !motor ? (
    "Perguntamos a um assistente de IA com busca na web ativa o que um cliente perguntaria antes de contratar."
  ) : (
    <>
      {primeiroRival && citadas < latest.length
        ? `No seu lugar apareceu ${primeiroRival}, ${vezesRival} ${vezesRival === 1 ? "vez" : "vezes"}. `
        : ""}
      {achadoSemCitar > 0 &&
        `Em ${achadoSemCitar} ${achadoSemCitar === 1 ? "pergunta a busca encontrou" : "perguntas a busca encontrou"} o seu site e a IA escolheu outro. `}
      Medido no {motor}, com busca na web ativa.
    </>
  );

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <Lede
        apoio={apoio}
        acao={
          <>
            <button
              onClick={() => call("run", "run")}
              disabled={busy !== null || queries.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-cobalto-600 px-4 py-2 font-semibold text-white hover:bg-cobalto-700 disabled:opacity-50"
            >
              <Play size={15} />
              {busy === "run" ? "Analisando..." : "Analisar agora"}
            </button>
            <button
              onClick={() => call("questions", "questions")}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              <Sparkles size={15} />
              {busy === "questions" ? "Gerando..." : "Gerar perguntas"}
            </button>
          </>
        }
      >
        {veredito}
      </Lede>

      {error && (
        <p className="mb-8 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-3 text-nota-critico">
          {error}
        </p>
      )}

      {topCompetitors.length > 0 && (
        <>
          <Secao>Quem a IA cita no seu lugar</Secao>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Empresas que o modelo usou como fonte ao responder. Cada uma é uma
            resposta que poderia ter sido sua.
          </p>
          <ul className="mt-4">
            {topCompetitors.map(([domain, count]) => (
              <Linha key={domain}>
                <div className="flex items-baseline justify-between gap-4">
                  <a
                    href={`https://${domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 truncate text-slate-800 dark:text-slate-200 hover:text-cobalto-600 dark:hover:text-cobalto-400 hover:underline"
                  >
                    {domain}
                  </a>
                  <span className="tabular shrink-0 font-display text-2xl text-slate-900 dark:text-slate-100">
                    {count}
                  </span>
                </div>
              </Linha>
            ))}
          </ul>
        </>
      )}

      {topDirectories.length > 0 && (
        <>
          <Secao>Diretórios e plataformas citados</Secao>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Estes não são concorrentes seus — são listas e portais. Quando a
            IA recorre a eles, é porque não encontrou uma empresa com resposta
            boa o bastante. É a lacuna mais fácil de ocupar.
          </p>
          <ul className="mt-4">
            {topDirectories.map(([domain, count]) => (
              <Linha key={domain}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 truncate text-slate-600 dark:text-slate-400">
                    {domain}
                  </span>
                  <span className="tabular shrink-0 font-display text-slate-500 dark:text-slate-400">
                    {count}
                  </span>
                </div>
              </Linha>
            ))}
          </ul>
        </>
      )}

      {timeline.length > 1 && (
        <>
          <Secao>Evolução</Secao>
          <div className="mt-4 flex h-32 items-end gap-3">
            {timeline.map((t) => (
              <div
                key={t.day}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              >
                <span className="tabular text-slate-600 dark:text-slate-400">
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
                <span className="tabular text-slate-400 dark:text-slate-500">
                  {t.day.slice(5)}
                </span>
              </div>
            ))}
          </div>
          {delta !== null && (
            <p className="mt-3 text-slate-600 dark:text-slate-400">
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
            const check = latestByQuery.get(q.id);
            return (
              <Linha key={q.id}>
                <div className="flex items-start gap-3">
                  <span className="mt-1 shrink-0">
                    {!check ? (
                      <span className="block h-4 w-4 rounded-full border border-slate-300 dark:border-slate-600" />
                    ) : check.cited ? (
                      <Check size={16} className="text-nota-excelente" />
                    ) : (
                      <X size={16} className="text-slate-400 dark:text-slate-600" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-800 dark:text-slate-200">
                      {q.question}
                    </p>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      {q.intent ? INTENT_LABEL[q.intent] : ""}
                      {q.intent && check ? " · " : ""}
                      {check?.cited && check.match_type === "domain"
                        ? `Citado como fonte${check.position ? `, ${check.position}ª fonte da resposta` : ""}`
                        : check?.cited
                          ? "Mencionado no texto"
                          : check?.found_in_search
                            ? "A busca achou seu site e a IA citou outro"
                            : check
                              ? "Não apareceu"
                              : "Ainda não consultada"}
                    </p>

                    {check && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {check.answer_excerpt && (
                          <button
                            onClick={() =>
                              setAberta(aberta === q.id ? null : q.id)
                            }
                            aria-expanded={aberta === q.id}
                            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            {aberta === q.id
                              ? "Ocultar resposta"
                              : "Ver o que a IA respondeu"}
                          </button>
                        )}
                        {!check.cited && (
                          <button
                            onClick={() => responderComArtigo(q.question)}
                            disabled={gerando !== null}
                            className="rounded-lg bg-cobalto-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cobalto-700 disabled:opacity-50"
                          >
                            {gerando === q.question
                              ? "Gerando..."
                              : "Escrever a resposta"}
                          </button>
                        )}
                      </div>
                    )}

                    {aberta === q.id && check?.answer_excerpt && (
                      <blockquote className="mt-3 border-l-2 border-slate-200 dark:border-slate-700 pl-3 text-sm whitespace-pre-line text-slate-600 dark:text-slate-400">
                        {check.answer_excerpt}
                      </blockquote>
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
