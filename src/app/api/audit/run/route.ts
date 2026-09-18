import { NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";
import { barrarSeEstourou, LIMITES } from "@/lib/limite-de-uso";
import { normalizeSiteUrl, isPublicHttpUrl } from "@/lib/crawler";
import { registrarAuditoria } from "@/lib/audit/salvar";

export const maxDuration = 120;

export async function POST(request: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const barrado = await barrarSeEstourou(supabase, workspace.id, LIMITES.auditoria);
  if (barrado) return barrado;
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

  const origem = normalizeSiteUrl(siteUrl);
  if (!origem || !isPublicHttpUrl(origem)) {
    return NextResponse.json(
      { error: "Endereço inválido ou não permitido." },
      { status: 400 },
    );
  }

  // Dedupe: a mesma auditoria já rodando (clique duplo, duas abas, ou o
  // cliente que clicou de novo por não ver sinal) não abre outra. Devolve a
  // que está em andamento e a tela espera por ela. Dois minutos cobrem o
  // maxDuration; uma "running" mais velha que isso morreu sem fechar e não
  // pode travar o botão para sempre.
  const { data: emAndamento } = await supabase
    .from("site_audits")
    .select("id")
    .eq("blog_id", blogId)
    .eq("site_url", origem)
    .eq("status", "running")
    .gte("created_at", new Date(Date.now() - 2 * 60_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (emAndamento) {
    return NextResponse.json(
      { auditId: (emAndamento as { id: string }).id, emAndamento: true },
      { status: 202 },
    );
  }

  const registro = await registrarAuditoria({
    blogId,
    siteUrl: origem,
    tipo: "manual",
  });

  if (!registro.ok) {
    return NextResponse.json(
      { error: registro.mensagem },
      { status: registro.status },
    );
  }

  return NextResponse.json({ auditId: registro.auditId, ...registro.result });
}
