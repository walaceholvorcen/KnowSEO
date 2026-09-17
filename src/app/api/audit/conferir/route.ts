import { NextResponse } from "next/server";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { isPublicHttpUrl } from "@/lib/crawler";
import { lerUrl } from "@/lib/audit/runner";
import { runRules } from "@/lib/audit/rules";

// "Já colei, confere pra mim": depois de colar a ficha da empresa, o cliente
// não precisa rodar a auditoria inteira (e esperar) para saber se pegou. Lê
// só a home do último site auditado e roda as regras de entidade nela.
//
// Não grava nada: a nota continua sendo a da auditoria completa, e a tela
// diz isso. Uma página só não pode mudar uma nota que mede 25.
const DE_ENTIDADE = new Set([
  "SEM_ENTIDADE",
  "ENTIDADE_SEM_SAMEAS",
  "ENTIDADE_INCOMPLETA",
  "ENTIDADE_NOME_INCONSISTENTE",
  "NO_SCHEMA",
]);

export async function POST(request: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const { code } = (await request.json().catch(() => ({}))) as { code?: string };
  if (!code || !DE_ENTIDADE.has(code)) {
    return NextResponse.json({ error: "Achado sem conferência rápida." }, { status: 400 });
  }

  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog) return NextResponse.json({ error: "blog not found" }, { status: 404 });

  const { data: ultima } = await supabase
    .from("site_audits")
    .select("site_url")
    .eq("blog_id", blog.id)
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const origem = (ultima as { site_url: string } | null)?.site_url;
  // A URL já foi validada ao auditar; valida de novo porque a leitura sai
  // do servidor e a linha do banco não é garantia contra SSRF.
  if (!origem || !isPublicHttpUrl(origem)) {
    return NextResponse.json({ error: "Nenhum site auditado para conferir." }, { status: 404 });
  }

  const leitura = await lerUrl(origem, origem);
  if (leitura.tipo !== "pagina") {
    return NextResponse.json(
      { error: "Não conseguimos ler a página inicial agora. Tente de novo em instantes." },
      { status: 422 },
    );
  }

  // Sinais de site preenchidos como "ok": aqui só interessam as regras que
  // olham o conteúdo da home. robots, sitemap e llms.txt ficam para a
  // auditoria completa.
  const achado = runRules({
    origin: origem,
    isHttps: origem.startsWith("https://"),
    robotsTxt: { found: true, body: null },
    sitemapUrls: [],
    sitemapFound: true,
    llmsTxtFound: true,
    pages: [leitura.snapshot],
  }).find((f) => f.code === code);

  return NextResponse.json({
    resolvido: !achado,
    evidencia: achado?.evidence ?? null,
  });
}
