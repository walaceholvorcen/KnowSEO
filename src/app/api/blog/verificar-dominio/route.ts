import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchComStatus } from "@/lib/crawler";
import { isSafeCustomDomain } from "@/lib/dominio";
import { estadoDoDominio, liberarDominio, vercelConfigurado } from "@/lib/vercel";

// Confere, batendo no domínio, se o blog já responde lá - em vez de deixar
// `domain_status` dizer "aguardando DNS" para sempre, como dizia (a coluna
// era escrita no cadastro e nunca mais).
//
// Com a Vercel configurada, quem responde "falta o quê" é ela, que é a
// única que sabe se o domínio está liberado no projeto e se o DNS bate. E
// se não estiver liberado, esta rota libera na hora: era o passo manual
// que ninguém lembrava de fazer.
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
  const dominio = blog.custom_domain;

  const gravar = async (status: string) => {
    // Client de serviço: domain_status não tem UPDATE para o navegador
    // (migração 0012). O blog já veio de getBlogAtivo, filtrado pelo workspace.
    await createAdminClient().from("blogs").update({ domain_status: status }).eq("id", blog.id);
  };

  // O blog respondendo é a única prova de "no ar", com ou sem Vercel.
  // "manual": domínio que só redireciona para outro endereço não serve o
  // blog por conta própria e não pode virar "active" por tabela.
  const resposta = await fetchComStatus(`https://${dominio}/`, "manual");
  const html = resposta?.res.ok ? await resposta.res.text() : "";
  if (html.includes('name="generator" content="Know SEO"')) {
    await gravar("active");
    return NextResponse.json({ status: "active" });
  }

  if (vercelConfigurado()) {
    let vercel = await estadoDoDominio(dominio);
    if (vercel.estado === "erro") vercel = await liberarDominio(dominio);

    if (vercel.estado === "esperando-dns") {
      await gravar("pending");
      return NextResponse.json({ status: "pending", registros: vercel.registros });
    }
    if (vercel.estado === "ocupado" || vercel.estado === "erro") {
      await gravar("error");
      return NextResponse.json({ status: "error", mensagem: vercel.mensagem });
    }
    if (vercel.estado === "pronto") {
      // Liberado e apontado, e mesmo assim o blog não respondeu: é o
      // certificado sendo emitido, coisa de um minuto.
      await gravar("pending");
      return NextResponse.json({ status: "certificado" });
    }
  }

  // Sem Vercel configurada: o DNS é a evidência. Sem o registro não dá para
  // separar "cliente ainda não criou" de "criou e falta liberar do nosso
  // lado" - sem liberação não há certificado, e o https falha antes de
  // qualquer resposta, igualzinho a um domínio que não existe.
  const dnsPronto = await lookup(dominio).then(() => true).catch(() => false);
  const status = dnsPronto ? "error" : "pending";
  await gravar(status);
  return NextResponse.json({ status, http: resposta?.status ?? null });
}
