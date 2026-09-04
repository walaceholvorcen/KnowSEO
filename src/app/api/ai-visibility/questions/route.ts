import { NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";
import { generateProbeQuestions } from "@/lib/ai-visibility/questions";
import { getProvider } from "@/lib/ai-visibility/runner";
import type { Blog, BrandDna } from "@/types";

export const maxDuration = 60;

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

  const { data: dna } = await supabase
    .from("brand_dna")
    .select("*")
    .eq("blog_id", blogId)
    .maybeSingle();

  const questions = await generateProbeQuestions({
    blog: blog as Blog,
    dna: dna as BrandDna | null,
  });

  if (!questions.length) {
    return NextResponse.json({ error: "no questions generated" }, { status: 502 });
  }

  const { data: inserted, error } = await supabase
    .from("ai_queries")
    .upsert(
      questions.map((q) => ({
        blog_id: blogId,
        question: q.question,
        intent: q.intent,
        source: "ai" as const,
      })),
      { onConflict: "blog_id,question" },
    )
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ queries: inserted, count: inserted?.length ?? 0 });
}
