import { NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";
import { auditSite } from "@/lib/audit/runner";
import { normalizeSiteUrl, isPublicHttpUrl } from "@/lib/crawler";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 120;

export async function POST(request: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const { blogId, siteUrl } = await request.json();

  if (!blogId || !siteUrl) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const { data: blog } = await supabase
    .from("blogs")
    .select("id")
    .eq("id", blogId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!blog) {
    return NextResponse.json({ error: "blog not found" }, { status: 404 });
  }

  const origin = normalizeSiteUrl(siteUrl);
  if (!origin || !isPublicHttpUrl(origin)) {
    return NextResponse.json(
      { error: "URL inválida o no permitida" },
      { status: 400 },
    );
  }

  // Registra a auditoria antes de rodar, para o histórico existir mesmo
  // que a análise falhe no meio.
  const { data: audit, error: createError } = await supabase
    .from("site_audits")
    .insert({ blog_id: blogId, site_url: origin, status: "running" })
    .select()
    .single();

  if (createError || !audit) {
    return NextResponse.json(
      { error: createError?.message ?? "no se pudo crear la auditoría" },
      { status: 500 },
    );
  }

  try {
    const result = await auditSite(origin);

    if (!result) {
      await supabase
        .from("site_audits")
        .update({
          status: "error",
          error_message: "No se pudo leer el sitio",
          finished_at: new Date().toISOString(),
        })
        .eq("id", audit.id);

      return NextResponse.json(
        {
          error:
            "No conseguimos leer ese sitio. Verifica la URL o si el servidor bloquea rastreadores.",
        },
        { status: 422 },
      );
    }

    if (result.findings.length) {
      // Escrito com o client admin de propósito: os achados são dados
      // derivados, gerados pelo servidor depois de já termos validado que
      // o blog pertence a quem chamou. A tabela só tem policy de leitura
      // para o usuário - não faz sentido abrir escrita ao client.
      const admin = createAdminClient();
      const { error: findingsError } = await admin
        .from("audit_findings")
        .insert(
          result.findings.map((f) => ({
            audit_id: audit.id,
            code: f.code,
            severity: f.severity,
            category: f.category,
            title: f.title,
            impact: f.impact,
            evidence: f.evidence,
            fix: f.fix,
            affected_urls: f.affectedUrls,
            affected_count: f.affectedCount,
          })),
        );

      // Sem este check o insert falharia em silêncio e a auditoria
      // apareceria "concluída" sem nenhum achado.
      if (findingsError) {
        throw new Error(`falha ao gravar achados: ${findingsError.message}`);
      }
    }

    await supabase
      .from("site_audits")
      .update({
        status: "done",
        pages_analyzed: result.pagesAnalyzed,
        score_google: result.scores.google,
        score_ai: result.scores.ai,
        finished_at: new Date().toISOString(),
      })
      .eq("id", audit.id);

    return NextResponse.json({ auditId: audit.id, ...result });
  } catch (err) {
    await supabase
      .from("site_audits")
      .update({
        status: "error",
        error_message: String(err).slice(0, 300),
        finished_at: new Date().toISOString(),
      })
      .eq("id", audit.id);

    console.error("[audit] falha", err);
    return NextResponse.json({ error: "audit failed" }, { status: 500 });
  }
}
