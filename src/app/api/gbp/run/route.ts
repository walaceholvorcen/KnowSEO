import { NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";
import { auditProfile } from "@/lib/gbp/runner";
import { isGbpConfigured, GBP_NOT_CONFIGURED_MESSAGE } from "@/lib/gbp/places";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const { blogId, query } = await request.json();

  if (!blogId || !query?.trim()) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  if (!isGbpConfigured()) {
    return NextResponse.json(
      { error: GBP_NOT_CONFIGURED_MESSAGE },
      { status: 503 },
    );
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

  const { data: audit, error: createError } = await supabase
    .from("gbp_audits")
    .insert({ blog_id: blogId, query, status: "running" })
    .select()
    .single();

  if (createError || !audit) {
    return NextResponse.json(
      { error: createError?.message ?? "não foi possível iniciar a auditoria" },
      { status: 500 },
    );
  }

  try {
    const result = await auditProfile(query);

    if (!result) {
      await supabase
        .from("gbp_audits")
        .update({ status: "not_found", finished_at: new Date().toISOString() })
        .eq("id", audit.id);

      return NextResponse.json(
        {
          error:
            "Não encontramos esse negócio no Google. Tente incluir a cidade ou o bairro na busca.",
        },
        { status: 422 },
      );
    }

    if (result.findings.length) {
      // Client admin de propósito, mesmo padrão da auditoria de site: são
      // dados derivados, gravados pelo servidor depois de validar que o
      // blog pertence a quem chamou.
      const admin = createAdminClient();
      const { error: findingsError } = await admin.from("gbp_findings").insert(
        result.findings.map((f) => ({
          audit_id: audit.id,
          code: f.code,
          severity: f.severity,
          title: f.title,
          impact: f.impact,
          evidence: f.evidence,
          fix: f.fix,
        })),
      );

      if (findingsError) {
        throw new Error(`falha ao gravar achados: ${findingsError.message}`);
      }
    }

    await supabase
      .from("gbp_audits")
      .update({
        status: "done",
        place_id: result.profile.placeId,
        place_name: result.profile.name,
        place_address: result.profile.address,
        maps_uri: result.profile.mapsUri,
        score: result.score,
        finished_at: new Date().toISOString(),
      })
      .eq("id", audit.id);

    return NextResponse.json({ auditId: audit.id, ...result });
  } catch (err) {
    await supabase
      .from("gbp_audits")
      .update({
        status: "error",
        error_message: String(err).slice(0, 300),
        finished_at: new Date().toISOString(),
      })
      .eq("id", audit.id);

    console.error("[gbp] falha", err);
    return NextResponse.json(
      { error: "A auditoria falhou. Tente de novo em instantes." },
      { status: 500 },
    );
  }
}
