import { NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";
import { normalizeSiteUrl, isPublicHttpUrl } from "@/lib/crawler";
import { registrarAuditoria } from "@/lib/audit/salvar";

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

  const origem = normalizeSiteUrl(siteUrl);
  if (!origem || !isPublicHttpUrl(origem)) {
    return NextResponse.json(
      { error: "Endereço inválido ou não permitido." },
      { status: 400 },
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
