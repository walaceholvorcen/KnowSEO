import { detectCitation } from "@/lib/citation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClaudeProvider } from "./claude-provider";
import { OpenAiProvider } from "./openai-provider";
import { PerplexityProvider } from "./perplexity-provider";
import type { AiProvider } from "./provider";
import type { AiQuery, Blog } from "@/types";

// Gera perguntas e responde à checagem de "a IA está configurada?" das
// rotas. As perguntas continuam saindo do Claude, qualquer que seja o
// conjunto de motores medidos.
export function getProvider(): AiProvider {
  return new ClaudeProvider();
}

// Todos os motores com chave configurada, na ordem em que aparecem para o
// cliente. Cada chave nova (OPENAI_API_KEY, PERPLEXITY_API_KEY) liga um motor
// sem mexer em código: a rodada seguinte já pergunta a ele também.
export function getProviders(): AiProvider[] {
  return [new OpenAiProvider(), new PerplexityProvider(), new ClaudeProvider()]
    .filter((p) => p.isConfigured());
}

// Dez, não quinze: pedido do cliente, e a conta fecha. Com três motores são
// trinta consultas por rodada; quinze perguntas levariam a quarenta e cinco
// e a um custo por rodada que não se paga com o ganho de amostra.
export const MAX_PERGUNTAS = 10;

// Consultas simultâneas. A rodada antiga fazia uma de cada vez: quinze
// perguntas com busca na web, ~20s cada, davam cinco minutos. Seis em
// paralelo fazem trinta consultas em cerca de dois minutos, abaixo do
// limite de requisição por minuto de qualquer um dos três provedores.
const CONCORRENCIA = 6;

// Uma rodada "rodando" há mais que isto morreu sem fechar (a função passou
// do tempo máximo). Sem esta regra ela travaria o botão para sempre.
const RODADA_ORFA_MS = 10 * 60 * 1000;

export interface RunSummary {
  total: number;
  cited: number;
  failed: number;
  runId: string;
}

// Domínios que representam a marca, com o blog hospedado incluído.
//
// Sem a linha do subdomínio, um blog servido por nós era contado como
// CONCORRENTE do próprio cliente quando a IA o citava - falso negativo na
// citação e lixo na lista de rivais, no mesmo golpe.
export function dominiosDaMarca(
  blog: Blog & { brand_domains: string[] },
  rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN,
): string[] {
  const dominios = new Set<string>(blog.brand_domains);
  if (blog.custom_domain) dominios.add(blog.custom_domain);
  if (rootDomain && blog.subdomain) {
    dominios.add(`${blog.subdomain}.${rootDomain.split(":")[0]}`);
  }
  return [...dominios];
}

// A rodada em curso do blog, se houver. Impede o clique duplo que antes
// recomeçava a análise do zero, e fecha como erro a rodada que morreu no
// meio para não travar a tela.
export async function rodadaEmAndamento(
  blogId: string,
): Promise<{ id: string; total: number } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_visibility_runs")
    .select("id,total,started_at")
    .eq("blog_id", blogId)
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const rodada = data as { id: string; total: number; started_at: string };

  if (Date.now() - new Date(rodada.started_at).getTime() > RODADA_ORFA_MS) {
    await admin
      .from("ai_visibility_runs")
      .update({
        status: "error",
        error_message:
          "A análise passou do tempo limite e foi encerrada. As respostas que chegaram foram guardadas.",
        finished_at: new Date().toISOString(),
      })
      .eq("id", rodada.id);
    return null;
  }

  return { id: rodada.id, total: rodada.total };
}

export async function iniciarRodada(params: {
  blogId: string;
  providers: AiProvider[];
  perguntas: number;
  origem: "manual" | "agendada";
}): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_visibility_runs")
    .insert({
      blog_id: params.blogId,
      providers: params.providers.map((p) => p.name),
      total: params.perguntas * params.providers.length,
      origem: params.origem,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `não foi possível abrir a rodada: ${error?.message ?? "sem retorno"}`,
    );
  }
  return (data as { id: string }).id;
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      await fn(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
}

// Executa a rodada inteira: cada pergunta em cada motor, em paralelo, com
// cada resposta gravada ASSIM QUE CHEGA.
//
// Gravar só no fim era o que fazia a análise "sumir": se a função estourasse
// o tempo, perdia-se a rodada toda, inclusive o que já tinha respondido.
// Agora uma rodada interrompida deixa no banco tudo o que chegou até ali.
export async function executarRodada(params: {
  runId: string;
  blog: Blog;
  queries: AiQuery[];
  providers: AiProvider[];
}): Promise<RunSummary> {
  const { runId, blog, queries, providers } = params;
  const admin = createAdminClient();

  const brandNames = blog.brand_names?.length ? blog.brand_names : [blog.name];
  const brandDomains = dominiosDaMarca(blog);

  const tarefas = queries.flatMap((query) =>
    providers.map((provider) => ({ query, provider })),
  );
  const summary: RunSummary = {
    total: tarefas.length,
    cited: 0,
    failed: 0,
    runId,
  };

  try {
    await mapWithConcurrency(tarefas, CONCORRENCIA, async ({ query, provider }) => {
      try {
        const answer = await provider.ask(query.question);

        const result = detectCitation({
          answerText: answer.answerText,
          citationUrls: answer.citationUrls,
          searchResultUrls: answer.searchResultUrls,
          brandNames,
          brandDomains,
        });

        if (result.cited) summary.cited++;

        const { error } = await admin.from("ai_visibility_checks").insert({
          blog_id: blog.id,
          run_id: runId,
          query_id: query.id,
          provider: answer.provider,
          cited: result.cited,
          match_type: result.matchType,
          position: result.position,
          competitors: result.competitors.slice(0, 10),
          directories: result.directories.slice(0, 10),
          found_in_search: result.foundInSearch,
          // 2000 e não 500: o trecho é mostrado como prova do veredito, e
          // 500 cortavam no meio da frase que recomendava o concorrente.
          answer_excerpt: answer.answerText.slice(0, 2000),
        });
        if (error) throw new Error(error.message);
      } catch (err) {
        summary.failed++;
        console.error(
          "[ai-visibility] falha",
          provider.name,
          query.id,
          err,
        );
      }
    });
  } finally {
    // A rodada fecha mesmo se algo explodir fora do laço - uma rodada presa
    // em "running" trava o botão da tela até virar órfã.
    const tudoFalhou = summary.total > 0 && summary.failed === summary.total;
    await admin
      .from("ai_visibility_runs")
      .update({
        status: tudoFalhou ? "error" : "done",
        falhas: summary.failed,
        error_message: tudoFalhou
          ? "Nenhum assistente respondeu. Confira as chaves de API configuradas."
          : null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
  }

  return summary;
}
