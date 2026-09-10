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

// Agrupa as checagens por dia para desenhar a evolução.
function buildTimeline(checks: AiVisibilityCheck[]) {
  const byDay = new Map<string, { total: number; cited: number }>();
  for (const c of checks) {
    const day = c.checked_at.slice(0, 10);
    const entry = byDay.get(day) ?? { total: 0, cited: 0 };
    entry.total++;
    if (c.cited) entry.cited++;
    byDay.set(day, entry);
  }
  return [...byDay.entries()]
    .map(([day, v]) => ({
      day,
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
  const [error, setError] = useState<string | null>(null);

  // Última rodada = checagens do timestamp mais recente
  const latestDay = checks[0]?.checked_at.slice(0, 10);
  const latest = checks.filter((c) => c.checked_at.slice(0, 10) === latestDay);
  const score = latest.length
    ? Math.round((latest.filter((c) => c.cited).length / latest.length) * 100)
    : null;

  const timeline = buildTimeline(checks);
  const previous = timeline.length > 1 ? timeline[timeline.length - 2].score : null;
  const delta = score !== null && previous !== null ? score - previous : null;

  const competitorCounts = new Map<string, number>();
  for (const c of latest) {
    for (const d of c.competitors) {
      competitorCounts.set(d, (competitorCounts.get(d) ?? 0) + 1);
    }
  }
  const topCompetitors = [...competitorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const latestByQuery = new Map<string, AiVisibilityCheck>();
  for (const c of checks) {
    if (!latestByQuery.has(c.query_id)) latestByQuery.set(c.query_id, c);
  }

  async function call(endpoint: string, kind: "questions" | "run") {
    setBusy(kind);
    setError(null);
    const res = await fetch(`/api/ai-visibility/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blogId }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) setError(data.error ?? "Algo deu errado. Tente de novo.");
    else router.refresh();
  }

  const citadas = latest.filter((c) => c.cited).length;
  const [primeiroRival, vezesRival] = topCompetitors[0] ?? [null, 0];

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

  const apoio =
    primeiroRival && citadas < latest.length
      ? `No seu lugar apareceu ${primeiroRival}, ${vezesRival} ${vezesRival === 1 ? "vez" : "vezes"}.`
      : "Quando alguém pergunta ao ChatGPT sobre o seu setor, é isto que ele responde.";

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
            Cada um destes é uma resposta que poderia ter sido sua.
          </p>
          <ul className="mt-4">
            {topCompetitors.map(([domain, count]) => (
              <Linha key={domain}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 truncate text-slate-800 dark:text-slate-200">
                    {domain}
                  </span>
                  <span className="tabular shrink-0 font-display text-2xl text-slate-900 dark:text-slate-100">
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
                        ? `Citado como fonte${check.position ? `, posição ${check.position}` : ""}`
                        : check?.cited
                          ? "Mencionado no texto"
                          : check
                            ? "Não apareceu"
                            : "Ainda não consultada"}
                    </p>
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
