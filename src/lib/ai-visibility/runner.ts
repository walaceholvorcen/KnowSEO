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
}

// Roda uma rodada de checagem para um blog: pergunta ao provedor, decide
// se a marca foi citada e grava o resultado.
export async function runVisibilityCheck(
  blog: Blog & { brand_names: string[]; brand_domains: string[] },
  queries: AiQuery[],
): Promise<RunSummary> {
  const provider = getProvider();
  const admin = createAdminClient();

  const summary: RunSummary = { total: queries.length, cited: 0, failed: 0 };
  const rows = [];

  for (const query of queries) {
    try {
      const answer = await provider.ask(query.question);

      const result = detectCitation({
        answerText: answer.answerText,
        citationUrls: answer.citationUrls,
        brandNames: blog.brand_names.length
          ? blog.brand_names
          : [blog.name],
        brandDomains: blog.brand_domains.length
          ? blog.brand_domains
          : blog.custom_domain
            ? [blog.custom_domain]
            : [],
      });

      if (result.cited) summary.cited++;

      rows.push({
        blog_id: blog.id,
        query_id: query.id,
        provider: answer.provider,
        cited: result.cited,
        match_type: result.matchType,
        position: result.position,
        competitors: result.competitors.slice(0, 10),
        answer_excerpt: answer.answerText.slice(0, 500),
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
