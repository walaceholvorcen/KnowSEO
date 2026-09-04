import { NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";
import { runVisibilityCheck, getProvider } from "@/lib/ai-visibility/runner";
import type { AiQuery, Blog } from "@/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const { blogId } = await request.json();

  if (!getProvider().isConfigured()) {
    return NextResponse.json(
      { error: "Rastreador inactivo: falta configurar la clave de IA." },
      { status: 503 },
    );
  }

  const { data: blog } = await supabase
    .from("blogs")
    .select("*")
    .eq("id", blogId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!blog) {
    return NextResponse.json({ error: "blog not found" }, { status: 404 });
  }

  const { data: queries } = await supabase
    .from("ai_queries")
    .select("*")
    .eq("blog_id", blogId)
    .eq("active", true);

  if (!queries?.length) {
    return NextResponse.json(
      { error: "Genera primero el conjunto de preguntas." },
      { status: 422 },
    );
  }

  const summary = await runVisibilityCheck(
    blog as Blog & { brand_names: string[]; brand_domains: string[] },
    queries as AiQuery[],
  );

  return NextResponse.json(summary);
}
