import { NextResponse } from "next/server";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchComStatus } from "@/lib/crawler";
import { normalizarDominio } from "@/lib/cta";
import { isSafeCustomDomain } from "@/lib/dominio";
import { erroNoSlug, slugsAposRenomear } from "@/lib/blog-endereco";
import { liberarDominio } from "@/lib/vercel";
import { barrarSemLiberacao } from "@/lib/limite-de-uso";

// Configurações → Blog. Antes o formulário gravava direto pelo client do
// Supabase no navegador, e a única guarda contra apontar o domínio raiz do
// cliente era a validação da tela - que qualquer requisição feita à mão
// pula. Aqui a regra vale no servidor, antes de gravar.
export async function PATCH(req: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog) return NextResponse.json({ error: "sem blog" }, { status: 400 });

  const corpo = (await req.json().catch(() => null)) as {
    name?: string;
    custom_domain?: string | null;
    subdomain?: string;
    theme?: Record<string, unknown>;
    cta_config?: Record<string, unknown>;
  } | null;
  if (!corpo) return NextResponse.json({ error: "corpo inválido" }, { status: 400 });

  // Daqui em diante o blog já é comprovadamente do workspace de quem está
  // logado (getBlogAtivo lê com RLS). A gravação sai pelo client de serviço
  // porque custom_domain, domain_status, subdomain e slugs_anteriores não
  // têm mais UPDATE para o navegador (migração 0012) - só esta rota grava.
  const admin = createAdminClient();
  const update: Record<string, unknown> = {};
  let aviso: string | null = null;

  if (typeof corpo.name === "string") update.name = corpo.name.trim() || blog.name;
  if (corpo.theme && typeof corpo.theme === "object") update.theme = corpo.theme;
  if (corpo.cta_config && typeof corpo.cta_config === "object") {
    update.cta_config = corpo.cta_config;
  }

  if (corpo.custom_domain !== undefined) {
    const dominio = normalizarDominio(corpo.custom_domain ?? "");
    if (dominio && !isSafeCustomDomain(dominio)) {
      return NextResponse.json(
        {
          error:
            "Use um subdomínio do site do cliente, como blog.cliente.com. Domínio principal, www e endereços .vercel.app não podem receber o blog.",
        },
        { status: 400 },
      );
    }
    if ((dominio || null) !== blog.custom_domain) {
      update.custom_domain = dominio || null;
      // Domínio novo nunca herda 'active': só a checagem de
      // /api/blog/verificar-dominio, batendo no endereço, escreve isso.
      update.domain_status = "pending";

      if (dominio) {
        // Se o endereço já mostra outro site, grava mesmo assim (o cliente
        // pode estar migrando), mas avisa: ao criar o CNAME, aquilo sai do ar.
        // redirect "manual": não segue salto. Um 3xx já é "responde, mas não
        // é o blog" - e seguir mandaria a sondagem para host que ninguém digitou.
        const resposta = await fetchComStatus(`https://${dominio}/`, "manual");
        const salto = !!resposta && resposta.status >= 300 && resposta.status < 400;
        const html = resposta?.res.ok ? await resposta.res.text() : "";
        if (salto || (resposta?.res.ok && !html.includes('name="generator" content="Know SEO"'))) {
          aviso = `${dominio} já responde com outro site. Ao apontar o CNAME, o que está lá hoje deixa de aparecer nesse endereço.`;
        }
      }
    }
  }

  if (typeof corpo.subdomain === "string" && corpo.subdomain !== blog.subdomain) {
    const novo = corpo.subdomain;
    const erro = erroNoSlug(novo);
    if (erro) return NextResponse.json({ error: erro }, { status: 400 });

    // Leitura com o client de serviço: o RLS esconde os blogs de outras
    // agências, e é justamente com eles que o slug não pode colidir.
    const { data: atual, error: erroColuna } = await admin
      .from("blogs")
      .select("slugs_anteriores")
      .eq("id", blog.id)
      .single();
    if (erroColuna) {
      // Sem a coluna, renomear quebraria todo link já publicado sem 301.
      return NextResponse.json(
        {
          error:
            "Renomear o endereço depende da migração 0012_slugs_anteriores.sql, que ainda não foi aplicada no banco.",
        },
        { status: 409 },
      );
    }

    const { data: colisao } = await admin
      .from("blogs")
      .select("id")
      .neq("id", blog.id)
      .or(`subdomain.eq.${novo},slugs_anteriores.cs.{${novo}}`)
      .limit(1);
    if (colisao?.length) {
      return NextResponse.json(
        { error: "Esse endereço já é de outro blog. Escolha outro." },
        { status: 409 },
      );
    }

    update.subdomain = novo;
    update.slugs_anteriores = slugsAposRenomear(
      (atual as { slugs_anteriores: string[] }).slugs_anteriores ?? [],
      blog.subdomain,
      novo,
    );
  }

  // Domínio novo já sai liberado do nosso lado: é o passo que ninguém
  // lembrava de fazer na Vercel, e sem ele o endereço fica sem certificado.
  // Conta em liberação grava o domínio, mas não fala com a Vercel: sem essa
  // trava, qualquer cadastro novo poderia encher o projeto de domínios só
  // salvando endereços em sequência.
  let registros = null;
  if (typeof update.custom_domain === "string" && !barrarSemLiberacao(workspace)) {
    const liberacao = await liberarDominio(update.custom_domain);
    if (liberacao.estado === "esperando-dns") registros = liberacao.registros;
    if (liberacao.estado === "ocupado" || liberacao.estado === "erro") {
      aviso = `Não consegui liberar ${update.custom_domain} automaticamente: ${liberacao.mensagem}.`;
    }
  }

  const { error } = await admin.from("blogs").update(update).eq("id", blog.id);
  if (error) {
    return NextResponse.json(
      {
        error: error.code === "23505" ? "Esse endereço já é de outro blog." : error.message,
      },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }

  return NextResponse.json({ ok: true, aviso, registros });
}
