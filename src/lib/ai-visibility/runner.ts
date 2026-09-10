import { detectCitation } from "@/lib/citation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClaudeProvider } from "./claude-provider";
import type { AiProvider } from "./provider";
import type { AiQuery, Blog } from "@/types";

export function getProvider(): AiProvider {
  return new ClaudeProvider();
}

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

// Roda uma rodada de checagem para um blog: pergunta ao provedor, decide
// se a marca foi citada e grava o resultado.
export async function runVisibilityCheck(
  blog: Blog & { brand_names: string[]; brand_domains: string[] },
  queries: AiQuery[],
): Promise<RunSummary> {
  const provider = getProvider();
  const admin = createAdminClient();

  // Uma rodada tem identidade própria. Antes ela era deduzida na tela pela
  // data da checagem, e duas análises no mesmo dia viravam uma só.
  const runId = crypto.randomUUID();

  const summary: RunSummary = {
    total: queries.length,
    cited: 0,
    failed: 0,
    runId,
  };
  const rows = [];

  const brandNames = blog.brand_names.length ? blog.brand_names : [blog.name];
  const brandDomains = dominiosDaMarca(blog);

  for (const query of queries) {
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

      rows.push({
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
        // 2000 em vez de 500: o trecho agora é mostrado ao cliente como
        // prova do veredito, e 500 caracteres cortavam no meio da frase
        // onde o concorrente era recomendado.
        answer_excerpt: answer.answerText.slice(0, 2000),
      });
    } catch (err) {
      summary.failed++;
      console.error("[ai-visibility] falha na pergunta", query.id, err);
    }
  }

  if (rows.length) {
    await admin.from("ai_visibility_checks").insert(rows);
  }

  return summary;
}
