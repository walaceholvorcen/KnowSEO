import { NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { erroNoSlug } from "@/lib/blog-endereco";

// Criação de blog (onboarding). Antes o INSERT saía do navegador, e o
// navegador não enxerga (RLS) os slugs antigos de outros blogs: dava para
// nascer com um slug que ainda responde 301 para outro cliente. A colisão é
// conferida aqui com o client de serviço; o INSERT segue pelo client do
// usuário, para o RLS continuar garantindo o workspace.
export async function POST(req: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const corpo = (await req.json().catch(() => null)) as {
    name?: string;
    subdomain?: string;
    language?: string;
  } | null;
  const name = typeof corpo?.name === "string" ? corpo.name.trim() : "";
  const subdomain = typeof corpo?.subdomain === "string" ? corpo.subdomain : "";
  if (!name) return NextResponse.json({ error: "Informe o nome do blog." }, { status: 400 });
  const erro = erroNoSlug(subdomain);
  if (erro) return NextResponse.json({ error: erro }, { status: 400 });

  const { data: colisao, error: erroColisao } = await createAdminClient()
    .from("blogs")
    .select("id")
    .or(`subdomain.eq.${subdomain},slugs_anteriores.cs.{${subdomain}}`)
    .limit(1);
  // Sem a coluna (migração 0012 não aplicada) cai para só o subdomínio atual,
  // que a constraint unique já protege no INSERT.
  if (!erroColisao && colisao?.length) {
    return NextResponse.json(
      { error: "Esse endereço já está em uso, tente outro." },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("blogs").insert({
    workspace_id: workspace.id,
    name,
    subdomain,
    language: corpo?.language,
    // Cor definida aqui (e não pelo default do banco) para novos blogs
    // já nascerem no azul marinho da marca. O cliente pode trocar
    // depois em Configurações > Blog e Domínio.
    theme: { primary_color: "#15191c", logo_url: null, tagline: null },
  });
  if (error) {
    return NextResponse.json(
      { error: error.code === "23505" ? "Esse endereço já está em uso, tente outro." : error.message },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
