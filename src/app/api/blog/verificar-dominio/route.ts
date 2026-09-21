import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // "manual": domínio que só redireciona para outro endereço não serve o
  // blog por conta própria e não pode virar "active" por tabela.
  const resposta = await fetchComStatus(`https://${blog.custom_domain}/`, "manual");
  const html = resposta?.res.ok ? await resposta.res.text() : "";
  const nosso = html.includes('name="generator" content="Know SEO"');

  // Sem o DNS não dá para separar os dois casos pela resposta HTTP: quando
  // o domínio já aponta para a Vercel mas ainda não foi liberado lá, não há
  // certificado, o https falha antes de responder e isso parecia "DNS não
  // propagou" - o cliente já tinha feito a parte dele. O DNS é a evidência.
  const dnsPronto = await lookup(blog.custom_domain).then(() => true).catch(() => false);

  const status = nosso ? "active" : dnsPronto ? "error" : "pending";
  // Client de serviço: domain_status não tem UPDATE para o navegador
  // (migração 0012). O blog já veio de getBlogAtivo, filtrado pelo workspace.
  await createAdminClient().from("blogs").update({ domain_status: status }).eq("id", blog.id);

  return NextResponse.json({ status, http: resposta?.status ?? null });
}
