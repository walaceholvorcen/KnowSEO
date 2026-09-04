"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, X, Play, Sparkles } from "lucide-react";
import type { AiQuery, AiVisibilityCheck } from "@/types";

const INTENT_LABEL: Record<string, string> = {
  discovery: "Descubrimiento",
  comparison: "Comparación",
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
    if (!res.ok) setError(data.error ?? "Error inesperado");
    else router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[16rem] flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Visibilidade em IA
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Quando alguém pergunta ao ChatGPT sobre o seu setor, a sua
            empresa aparece?
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => call("questions", "questions")}
            disabled={busy !== null}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <Sparkles size={15} />
            {busy === "questions" ? "Generando..." : "Generar preguntas"}
          </button>
          <button
            onClick={() => call("run", "run")}
            disabled={busy !== null || queries.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-cobalto-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cobalto-700 disabled:opacity-50"
          >
            <Play size={15} />
            {busy === "run" ? "Analizando..." : "Analizar ahora"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {error}
        </div>
      )}

      {/* Score */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Visibilidade
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
            {score === null ? "—" : `${score}%`}
          </p>
          {delta !== null && (
            <p
              className={`mt-1 text-xs font-medium ${delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} pts vs. anterior
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Perguntas monitoradas
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
            {queries.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Citações na última rodada
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
            {latest.filter((c) => c.cited).length}
            <span className="text-lg text-slate-400 dark:text-slate-500">
              /{latest.length || 0}
            </span>
          </p>
        </div>
      </div>

      {/* Evolução */}
      {timeline.length > 1 && (
        <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Evolução
          </h3>
          <div className="flex h-40 items-end gap-3">
            {timeline.map((t) => (
              <div
                key={t.day}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t.score}%
                </span>
                {/* Trilho com altura definida: sem ele o % da barra não
                    resolve e o gráfico aparece vazio. */}
                <div className="flex h-full w-full items-end">
                  <div
                    className="w-full rounded-t bg-cobalto-600 dark:bg-cobalto-500"
                    style={{ height: `${Math.max(t.score, 3)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {t.day.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Concorrentes */}
      {topCompetitors.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Quem a IA cita no seu lugar
          </h3>
          <ul className="space-y-1.5">
            {topCompetitors.map(([domain, count]) => (
              <li
                key={domain}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-600 dark:text-slate-400">
                  {domain}
                </span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {count}x
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Perguntas */}
      <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Perguntas monitoradas
        </h3>

        {queries.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Bot size={32} className="mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Gere o conjunto de perguntas que um cliente faria a uma IA
              antes de contratar você.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {queries.map((q) => {
              const check = latestByQuery.get(q.id);
              return (
                <li key={q.id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 shrink-0">
                    {!check ? (
                      <span className="block h-4 w-4 rounded-full border border-slate-300 dark:border-slate-600" />
                    ) : check.cited ? (
                      <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <X size={16} className="text-red-600 dark:text-red-400" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 dark:text-slate-200">
                      {q.question}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                      {q.intent && (
                        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5">
                          {INTENT_LABEL[q.intent]}
                        </span>
                      )}
                      {check?.cited && check.match_type === "domain" && (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Citado como fonte
                          {check.position ? ` (posição ${check.position})` : ""}
                        </span>
                      )}
                      {check?.cited && check.match_type === "brand" && (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Mencionado no texto
                        </span>
                      )}
                      {check && !check.cited && (
                        <span>Não apareceu</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
