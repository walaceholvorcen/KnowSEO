import { NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";
import { crawlSite, normalizeSiteUrl, isPublicHttpUrl } from "@/lib/crawler";
import { buscarConexao } from "@/lib/google/oauth";
import { buscarDesempenhoDeBusca } from "@/lib/google/search-console";
import {
  analisarMercado,
  acharChances,
  type PaginaCrawleada,
} from "@/lib/mercado/temas";
import type { Blog } from "@/types";

// Três sitemaps em paralelo. Medido contra sites reais: ~18s para três
// concorrentes de porte médio.
export const maxDuration = 60;

const MAX_CONCORRENTES = 4;
const DIAS_DE_BUSCA = 90;

function dominioDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function diaISO(deslocamentoEmDias: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - deslocamentoEmDias);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const { blogId, concorrentes } = (await request.json()) as {
    blogId?: string;
    concorrentes?: string[];
  };

  if (!blogId || !Array.isArray(concorrentes) || concorrentes.length === 0) {
    return NextResponse.json(
      { error: "Informe pelo menos um concorrente." },
      { status: 400 },
    );
  }

  const { data: blogRow } = await supabase
    .from("blogs")
    .select("*")
    .eq("id", blogId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!blogRow) {
    return NextResponse.json({ error: "blog not found" }, { status: 404 });
  }
  const blog = blogRow as Blog;

  // Normaliza e valida antes de gravar qualquer coisa: um domínio inválido
  // no meio da lista faria a rodada nascer prometendo o que não vai cumprir.
  const origens: string[] = [];
  for (const bruto of concorrentes.slice(0, MAX_CONCORRENTES)) {
    const origem = normalizeSiteUrl(String(bruto).trim());
    if (!origem || !isPublicHttpUrl(origem)) {
      return NextResponse.json(
        { error: `"${bruto}" não parece um domínio válido.` },
        { status: 400 },
      );
    }
    if (!origens.includes(origem)) origens.push(origem);
  }

  const conexao = blog.gsc_property
    ? await buscarConexao(workspace.id).catch(() => null)
    : null;
  const gscConectado = Boolean(conexao && blog.gsc_property);

  const { data: rodadaRow, error: erroRodada } = await supabase
    .from("market_analyses")
    .insert({
      blog_id: blogId,
      status: "running",
      competitor_domains: origens.map(dominioDe),
      gsc_conectado: gscConectado,
    })
    .select()
    .single();

  if (erroRodada || !rodadaRow) {
    return NextResponse.json(
      { error: erroRodada?.message ?? "não foi possível iniciar" },
      { status: 500 },
    );
  }
  const rodadaId = (rodadaRow as { id: string }).id;

  async function falhar(mensagem: string) {
    await supabase
      .from("market_analyses")
      .update({
        status: "error",
        error_message: mensagem,
        finished_at: new Date().toISOString(),
      })
      .eq("id", rodadaId);
    return NextResponse.json({ error: mensagem }, { status: 422 });
  }

  // As páginas do cliente já foram lidas na linkagem interna. Reaproveitar
  // evita rastrear o mesmo site duas vezes e faz a análise começar mais
  // rápido; só cai no crawl ao vivo se aquela etapa nunca rodou.
  const { data: internos } = await supabase
    .from("internal_links")
    .select("url,title")
    .eq("blog_id", blogId)
    .limit(200);

  let paginasCliente: PaginaCrawleada[] = (
    (internos as { url: string; title: string | null }[]) ?? []
  ).map((l) => ({ dominio: dominioDe(l.url), titulo: l.title }));

  if (paginasCliente.length === 0 && blog.custom_domain) {
    const origem = normalizeSiteUrl(blog.custom_domain);
    if (origem) {
      paginasCliente = (await crawlSite(origem)).map((p) => ({
        dominio: dominioDe(p.url),
        titulo: p.title,
      }));
    }
  }

  const listas = await Promise.all(origens.map((o) => crawlSite(o)));

  const vazios = origens.filter((_, i) => listas[i].length === 0).map(dominioDe);
  if (vazios.length === origens.length) {
    return falhar(
      `Não encontramos sitemap em ${vazios.join(", ")}. Confira o domínio ou tente outro concorrente.`,
    );
  }

  const paginasConcorrentes: PaginaCrawleada[] = listas.flat().map((p) => ({
    dominio: dominioDe(p.url),
    titulo: p.title,
  }));

  const temas = analisarMercado({
    cliente: paginasCliente,
    concorrentes: paginasConcorrentes,
  });

  // O Search Console é camada extra, não requisito. Se falhar (token
  // revogado, propriedade trocada), a análise de cobertura ainda vale - por
  // isso o erro é engolido aqui em vez de derrubar a rodada.
  let chances: ReturnType<typeof acharChances> = [];
  if (gscConectado && blog.gsc_property) {
    try {
      const linhas = await buscarDesempenhoDeBusca({
        workspaceId: workspace.id,
        siteUrl: blog.gsc_property,
        desde: diaISO(DIAS_DE_BUSCA),
        ate: diaISO(1),
        limite: 200,
      });
      chances = acharChances(linhas).slice(0, 12);
    } catch (err) {
      console.error("[market/run] Search Console indisponível", err);
    }
  }

  if (temas.length) {
    await supabase.from("market_themes").insert(
      temas.map((t, i) => ({
        analysis_id: rodadaId,
        termo: t.termo,
        paginas_cliente: t.paginasCliente,
        paginas_concorrentes: t.paginasConcorrentes,
        concorrentes_que_cobrem: t.concorrentesQueCobrem,
        lacuna: t.lacuna,
        situacao: t.situacao,
        exemplos: t.exemplos,
        posicao: i,
      })),
    );
  }

  if (chances.length) {
    await supabase.from("market_chances").insert(
      chances.map((c) => ({
        analysis_id: rodadaId,
        query: c.query,
        tipo: c.tipo,
        impressoes: c.impressoes,
        cliques: c.cliques,
        posicao: Number(c.posicao.toFixed(1)),
      })),
    );
  }

  await supabase
    .from("market_analyses")
    .update({
      status: "done",
      client_pages: paginasCliente.length,
      competitor_pages: paginasConcorrentes.length,
      finished_at: new Date().toISOString(),
    })
    .eq("id", rodadaId);

  return NextResponse.json({
    analysisId: rodadaId,
    temas: temas.length,
    chances: chances.length,
    semSitemap: vazios,
  });
}
