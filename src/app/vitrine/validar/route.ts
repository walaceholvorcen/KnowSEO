import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSiteUrl } from "@/lib/crawler";
import { registrarAuditoria } from "@/lib/audit/salvar";
import { getProviders, iniciarRodada, executarRodada, MAX_PERGUNTAS } from "@/lib/ai-visibility/runner";
import type { AiQuery, Blog } from "@/types";

export const maxDuration = 300;

// Dev only: roda auditoria e Raio X de verdade, gravando no banco (validação de lançamento).
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") notFound();
  const dominio = new URL(req.url).searchParams.get("dominio") ?? "";
  const admin = createAdminClient();
  const { data: blog } = await admin.from("blogs").select("*").eq("custom_domain", dominio).single();

  const auditoria = await registrarAuditoria({
    blogId: blog.id,
    siteUrl: normalizeSiteUrl(`https://${dominio}`)!,
    tipo: "manual",
  });

  if (new URL(req.url).searchParams.get("so") === "auditoria") return Response.json({ auditoria });

  const providers = getProviders().filter((p) => p.name === "claude");
  const { data: queries } = await admin.from("ai_queries").select("*")
    .eq("blog_id", blog.id).eq("active", true).limit(MAX_PERGUNTAS);
  const runId = await iniciarRodada({ blogId: blog.id, providers, perguntas: queries!.length, origem: "manual" });
  const rodada = await executarRodada({ runId, blog: blog as Blog, queries: queries as AiQuery[], providers });

  return Response.json({ auditoria, rodada });
}
