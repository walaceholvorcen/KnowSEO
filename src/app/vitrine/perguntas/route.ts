import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateProbeQuestions } from "@/lib/ai-visibility/questions";
import type { Blog, BrandDna } from "@/types";

// Dev only: regenera o conjunto de perguntas de um blog (mesma lógica da rota).
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") notFound();
  const dominio = new URL(req.url).searchParams.get("dominio");
  const admin = createAdminClient();
  const { data: blog } = await admin.from("blogs").select("*").eq("custom_domain", dominio).single();
  const { data: dna } = await admin.from("brand_dna").select("*").eq("blog_id", blog.id).maybeSingle();
  const questions = await generateProbeQuestions({ blog: blog as Blog, dna: dna as BrandDna | null });
  if (!questions.length) return Response.json({ erro: "nada gerado" }, { status: 502 });
  await admin.from("ai_queries").update({ active: false }).eq("blog_id", blog.id);
  const { data } = await admin.from("ai_queries").upsert(
    questions.map((q) => ({ blog_id: blog.id, question: q.question, intent: q.intent, source: "ai", active: true })),
    { onConflict: "blog_id,question" },
  ).select("question,intent");
  return Response.json(data);
}
