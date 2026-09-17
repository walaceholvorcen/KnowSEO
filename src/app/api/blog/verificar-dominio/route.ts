import { NextResponse } from "next/server";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { fetchComStatus } from "@/lib/crawler";
import { isSafeCustomDomain } from "@/lib/dominio";

// Confere, batendo no domínio, se o blog já responde lá - em vez de deixar
// `domain_status` dizer "aguardando DNS" para sempre, como dizia (a coluna
// era escrita no cadastro e nunca mais).
//
// Três desfechos, e a diferença entre eles é o que o cliente precisa ouvir:
// não respondeu (DNS ainda não propagou), respondeu outra coisa (o domínio
// falta ser liberado do nosso lado), respondeu o blog (pronto).
export async function POST() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blog = await getBlogAtivo(supabase, workspace.id);

  if (!blog?.custom_domain) {
    return NextResponse.json({ error: "sem domínio próprio" }, { status: 400 });
  }
  // Apex, www ou .vercel.app gravado antes da guarda do servidor nunca vira
  // 'active' - mesmo respondendo o blog, seria o site do cliente substituído.
  if (!isSafeCustomDomain(blog.custom_domain)) {
    return NextResponse.json({ error: "domínio não permitido" }, { status: 400 });
  }

  const resposta = await fetchComStatus(`https://${blog.custom_domain}/`);
  const html = resposta?.res.ok ? await resposta.res.text() : "";
  const nosso = html.includes('name="generator" content="Know SEO"');

  const status = nosso ? "active" : resposta ? "error" : "pending";
  await supabase.from("blogs").update({ domain_status: status }).eq("id", blog.id);

  return NextResponse.json({ status, http: resposta?.status ?? null });
}
