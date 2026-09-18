import { NextResponse } from "next/server";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchComStatus } from "@/lib/crawler";
import { normalizarPasta } from "@/lib/pasta";

// Blog numa pasta do site do cliente (cliente.com/blog) - ver src/lib/pasta.ts.
//
// Grava com o client de serviço: pasta_url e pasta_status ficam fora do
// grant de UPDATE do navegador (migração 0017), porque a pasta é o que
// identifica o blog no pedido que chega do Worker. O blog vem de
// getBlogAtivo, já filtrado pelo workspace de quem está logado.

const SEM_MIGRACAO =
  "Publicar numa pasta depende da migração 0017_blog_na_pasta.sql, que ainda não foi aplicada no banco.";

/** Salva o endereço da pasta; vazio remove. Volta a 'pending' sempre. */
export async function PUT(request: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog) return NextResponse.json({ error: "sem blog" }, { status: 400 });

  const { endereco } = (await request.json().catch(() => ({}))) as { endereco?: string };
  const admin = createAdminClient();

  if (!endereco?.trim()) {
    const { error } = await admin
      .from("blogs")
      .update({ pasta_url: null, pasta_status: "pending" })
      .eq("id", blog.id);
    if (error) return NextResponse.json({ error: SEM_MIGRACAO }, { status: 409 });
    return NextResponse.json({ endereco: null, status: "pending" });
  }

  const pasta = normalizarPasta(endereco, process.env.NEXT_PUBLIC_APP_DOMAIN);
  if ("erro" in pasta) return NextResponse.json({ error: pasta.erro }, { status: 400 });

  const { data: outro, error: erroLeitura } = await admin
    .from("blogs")
    .select("id")
    .eq("pasta_url", pasta.url)
    .neq("id", blog.id)
    .limit(1);
  if (erroLeitura) return NextResponse.json({ error: SEM_MIGRACAO }, { status: 409 });
  if (outro?.length) {
    return NextResponse.json(
      { error: "Esse endereço já é de outro blog na plataforma." },
      { status: 409 },
    );
  }

  const { error } = await admin
    .from("blogs")
    .update({ pasta_url: pasta.url, pasta_status: "pending" })
    .eq("id", blog.id);
  if (error) return NextResponse.json({ error: SEM_MIGRACAO }, { status: 409 });

  return NextResponse.json({ endereco: pasta.url, status: "pending" });
}

/**
 * Confere, abrindo a pasta de verdade, se o Worker já responde com o blog.
 * Mesmos três desfechos da checagem de domínio: não respondeu (pending),
 * respondeu outra coisa (error - Worker ou rota faltando), respondeu o blog
 * (active - a partir daqui canonical e links usam a pasta).
 */
export async function POST() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog?.pasta_url) {
    return NextResponse.json({ error: "sem pasta cadastrada" }, { status: 400 });
  }

  // "manual": se a pasta só redireciona para outro lugar, quem responde não
  // é o blog - e não pode virar 'active' por tabela.
  const resposta = await fetchComStatus(blog.pasta_url, "manual");
  const html = resposta?.res.ok ? await resposta.res.text() : "";
  const nosso = html.includes('name="generator" content="Know SEO"');
  const status = nosso ? "active" : resposta ? "error" : "pending";

  const { error } = await createAdminClient()
    .from("blogs")
    .update({ pasta_status: status })
    .eq("id", blog.id);
  if (error) return NextResponse.json({ error: SEM_MIGRACAO }, { status: 409 });

  return NextResponse.json({ status, http: resposta?.status ?? null });
}
