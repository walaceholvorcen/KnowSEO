import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Sidebar } from "@/components/sidebar";
import { AuditBoard } from "@/app/(dashboard)/audit/audit-board";
import type { AuditRow, FindingRow } from "@/app/(dashboard)/audit/page";
import { VisibilityBoard } from "@/app/(dashboard)/visibility/visibility-board";
import { StrategyBoard } from "@/app/(dashboard)/strategy/strategy-board";
import { ContentsBoard } from "@/app/(dashboard)/contents/contents-board";
import {
  CalendarioBoard,
  type ItemDoDia,
} from "@/app/(dashboard)/calendar/calendario-board";
import { limitesDoMes, mesDe, paraInput } from "@/lib/calendario";
import { compararAuditorias, type AchadoResumo } from "@/lib/audit/comparar";
import { getProviders, MAX_PERGUNTAS } from "@/lib/ai-visibility/runner";
import { carregarInicio } from "@/app/(dashboard)/dashboard/dados";
import { InicioBoard } from "@/app/(dashboard)/dashboard/inicio-board";
import { encontrarGargalo } from "@/lib/gargalo";
import { origemDoApp, semEsquema, urlDoArtigo, urlPublicaDoBlog, versaoDaIdentidade } from "@/lib/blog-endereco";
import { lerJornada } from "@/app/(dashboard)/audit/jornada-dados";
import { ArticleEditor } from "@/app/(dashboard)/contents/[id]/article-editor";
import { BlogSettingsForm } from "@/app/(dashboard)/settings/blog/blog-settings-form";
import { PublicarNoDominio } from "@/app/(dashboard)/settings/blog/publicar-no-dominio";
import { PublicarNaPasta } from "@/app/(dashboard)/settings/blog/publicar-na-pasta";
import { IdentidadeForm } from "@/app/(dashboard)/settings/brand/identidade-form";
import { ThemeSelector } from "@/app/(dashboard)/settings/interface/theme-selector";
import { SettingsNav } from "@/app/(dashboard)/settings/settings-nav";
import { CreateBlogForm } from "@/app/onboarding/create-blog-form";
import { pagina } from "@/components/ui";
import { lerFuso } from "@/lib/datas";
import { lerPeriodo } from "@/lib/relatorio";
import { carregarRelatorio } from "@/app/(dashboard)/reports/dados";
import { Relatorio } from "@/app/(dashboard)/reports/relatorio";
import { ultimaExecucaoDoCron } from "@/app/api/cron/semanal/execucoes";
import { detectarIdioma, idiomaDoBlog } from "@/lib/idioma";
import type { AiQuery, AiVisibilityCheck, Article, Blog, Keyword } from "@/types";

// Vitrine local de revisão de design: renderiza as telas reais com o dado
// real do banco, sem sessão de login. Só existe em desenvolvimento - em
// produção devolve 404 - e não é versionada (.git/info/exclude).
export default async function Vitrine({
  searchParams,
}: {
  searchParams: Promise<{ tela?: string; blog?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { tela = "audit", blog: pedido } = await searchParams;
  const fuso = await lerFuso();
  const admin = createAdminClient();
  const { data: blogs } = await admin.from("blogs").select("*");
  const lista = (blogs as Blog[]) ?? [];
  const blog =
    lista.find((b) => b.subdomain === pedido) ??
    lista.find((b) => b.custom_domain) ??
    lista[0];

  let conteudo: React.ReactNode = null;

  if (tela === "inicio") {
    const dados = await carregarInicio(admin, blog.id);
    const gargalo = encontrarGargalo({
      notaGoogle: dados.notaGoogle,
      pautasAbertas: dados.pautas,
      artigosPublicados: dados.publicados,
      visitas: dados.visitas,
      conversas: dados.conversas,
      perguntasIa: dados.perguntas,
      citacoesIa: dados.citacoes,
      rivalCitado: dados.rivalCitado,
    });
    conteudo = (
      <InicioBoard
        fuso={fuso}
        blogNome={blog.name}
        endereco={urlPublicaDoBlog(blog).url}
        statusDominio={blog.domain_status}
        feitos={{
          brand_dna: true,
          site_analyzed: true,
          domain_connected: true,
          first_article_published: true,
          analytics_connected: true,
        }}
        gargalo={gargalo}
        dados={dados}
      />
    );
  }

  if (tela === "editor") {
    const { data: artigos } = await admin
      .from("articles")
      .select("*")
      .eq("blog_id", blog.id)
      .order("created_at", { ascending: false });
    // Rascunho primeiro: é nele que o autosave age (artigo publicado só
    // salva quando alguém manda).
    const lista = (artigos ?? []) as Article[];
    const artigo = lista.find((a) => a.status === "draft") ?? lista[0];
    const { data: paginas } = await admin
      .from("internal_links")
      .select("url")
      .eq("blog_id", blog.id);
    conteudo = artigo ? (
      <ArticleEditor
        article={artigo}
        enderecoPublico={urlDoArtigo(blog, artigo.slug)}
        dominioPendente={!!blog.custom_domain && blog.domain_status !== "active"}
        pauta="quanto custa uma agência de tráfego pago"
        linksConhecidos={((paginas as { url: string }[]) ?? []).map((l) => l.url)}
        keywordsPublicadas={[]}
        versaoMarca={versaoDaIdentidade(blog)}
      />
    ) : null;
  }

  if (tela === "brand") {
    conteudo = (
      <div className={pagina("estreita")}>
        <SettingsNav />
        <IdentidadeForm
          blogId={blog.id}
          nomeDoBlog={blog.name}
          dominioProprio={blog.custom_domain}
          initialNames={blog.brand_names ?? []}
          initialDomains={blog.brand_domains ?? []}
        />
      </div>
    );
  }

  if (tela === "interface") {
    conteudo = (
      <div className={pagina("estreita")}>
        <SettingsNav />
        <ThemeSelector />
      </div>
    );
  }

  // Mesmo invólucro de src/app/onboarding/page.tsx, copiado para a revisão.
  if (tela === "onboarding") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-10 sm:flex sm:items-center sm:justify-center">
        <div className="mx-auto w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Adicionar cliente</h1>
          </div>
          <CreateBlogForm />
        </div>
      </div>
    );
  }

  if (tela === "blog") {
    conteudo = (
      <div className="mx-auto max-w-3xl space-y-6 p-8">
        <BlogSettingsForm blog={blog} prefixoDoEndereco={semEsquema(urlPublicaDoBlog({ ...blog, custom_domain: null }).url).slice(0, -blog.subdomain.length)} />
        <PublicarNaPasta
          enderecoInicial={blog.pasta_url ?? null}
          statusInicial={blog.pasta_status ?? "pending"}
          appOrigin={origemDoApp()}
        />
        <PublicarNoDominio dominio={blog.custom_domain} statusInicial={blog.domain_status} />
      </div>
    );
  }

  if (tela === "audit") {
    const { data: audits } = await admin
      .from("site_audits")
      .select("*")
      .eq("blog_id", blog.id)
      .order("created_at", { ascending: false })
      .limit(30);
    const concluidas = ((audits as AuditRow[]) ?? []).filter(
      (a) => a.status === "done",
    );
    const latest = concluidas[0] ?? null;
    const anterior = latest
      ? (concluidas.find(
          (a) => a.id !== latest.id && a.site_url === latest.site_url,
        ) ?? null)
      : null;
    const { data: findings } = latest
      ? await admin.from("audit_findings").select("*").eq("audit_id", latest.id)
      : { data: [] };
    const { data: antigos } = anterior
      ? await admin
          .from("audit_findings")
          .select("code,title,severity,affected_count")
          .eq("audit_id", anterior.id)
      : { data: [] };
    const achados = (findings as FindingRow[]) ?? [];
    const jornada = await lerJornada(admin, {
      concluidas,
      latest,
      achados,
      acompanhamentoAtivo: false,
      fuso,
    });
    conteudo = (
      <AuditBoard
        blogId={blog.id}
        audits={(audits as AuditRow[]) ?? []}
        latest={latest}
        findings={achados}
        anterior={anterior}
        comparacao={
          anterior
            ? compararAuditorias(achados, (antigos as AchadoResumo[]) ?? [])
            : null
        }
        acompanhamentoAtivo={false}
        jornada={jornada}
        fuso={fuso}
        cron={await ultimaExecucaoDoCron()}
      />
    );
  }

  if (tela === "visibility") {
    const [{ data: queries }, { data: checks }] = await Promise.all([
      admin
        .from("ai_queries")
        .select("*")
        .eq("blog_id", blog.id)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(MAX_PERGUNTAS),
      admin
        .from("ai_visibility_checks")
        .select("*")
        .eq("blog_id", blog.id)
        .order("checked_at", { ascending: false })
        .limit(500),
    ]);
    conteudo = (
      <VisibilityBoard
        blogId={blog.id}
        queries={((queries as AiQuery[]) ?? []).reverse()}
        checks={(checks as AiVisibilityCheck[]) ?? []}
        rodada={null}
        motores={getProviders().map((p) => p.name)}
        fuso={fuso}
      />
    );
  }

  if (tela === "contents") {
    const { data: artigos } = await admin
      .from("articles")
      .select("*")
      .eq("blog_id", blog.id)
      .order("created_at", { ascending: false });
    const lista = (artigos as Article[]) ?? [];
    const { data: eventos } = await admin
      .from("analytics_events")
      .select("article_id")
      .eq("blog_id", blog.id)
      .eq("event_type", "pageview");
    const visitas = new Map<string, number>();
    for (const e of (eventos as { article_id: string | null }[]) ?? []) {
      if (e.article_id) visitas.set(e.article_id, (visitas.get(e.article_id) ?? 0) + 1);
    }
    conteudo = (
      <ContentsBoard
        blog={blog}
        lista={lista}
        afetados={[]}
        visitasPorArtigo={visitas}
        veredito={`${lista.filter((a) => a.status === "published").length} no ar, ${lista.filter((a) => a.status !== "published").length} esperando revisão.`}
        fuso={fuso}
      />
    );
  }

  if (tela === "calendario") {
    const { data: artigos } = await admin
      .from("articles")
      .select("id, title, status, scheduled_at, published_at")
      .eq("blog_id", blog.id)
      .order("created_at", { ascending: false });
    const lista = (artigos as Article[]) ?? [];
    const agora = new Date();
    const mes = mesDe(agora);
    const hoje = paraInput(agora);
    const { inicio, fim } = limitesDoMes(mes);
    const dentro = (iso: string | null) =>
      !!iso &&
      Date.parse(iso) >= inicio.getTime() &&
      Date.parse(iso) < fim.getTime() + 86_400_000;
    const porDia: Record<string, ItemDoDia[]> = {};
    const por = (dia: string, item: ItemDoDia) => {
      porDia[dia] = [...(porDia[dia] ?? []), item];
    };
    for (const a of lista) {
      if (a.status === "published" && dentro(a.published_at)) {
        por(paraInput(a.published_at!), { id: a.id, titulo: a.title, estado: "publicado" });
      } else if (a.status !== "published" && dentro(a.scheduled_at)) {
        const dia = paraInput(a.scheduled_at!);
        por(dia, {
          id: a.id,
          titulo: a.title,
          estado: dia < hoje ? "atrasado" : "agendado",
        });
      }
    }
    const semData = lista
      .filter((a) => a.status !== "published" && !a.scheduled_at)
      .map((a) => ({ id: a.id, titulo: a.title }));
    conteudo = (
      <CalendarioBoard
        mes={mes}
        hoje={hoje}
        veredito={`${Object.values(porDia).flat().filter((i) => i.estado === "publicado").length} no ar, ${Object.values(porDia).flat().filter((i) => i.estado !== "publicado").length} agendados neste mês.`}
        porDia={porDia}
        semData={semData}
      />
    );
  }

  if (tela === "reports") {
    const periodo = lerPeriodo({ dias: "90" });
    const { eventos, artigos, contexto } = await carregarRelatorio(admin, blog.id, periodo);
    conteudo = (
      <Relatorio
        blog={blog}
        periodo={periodo}
        eventos={eventos}
        artigos={artigos}
        contexto={contexto}
        token="exemplo"
        fuso={fuso}
      />
    );
  }

  if (tela === "strategy") {
    const { data: keywords } = await admin
      .from("keywords")
      .select("*")
      .eq("blog_id", blog.id)
      .order("created_at", { ascending: false });
    // Só na vitrine: marca as primeiras pautas como um plano, para revisar
    // o desenho do cluster antes de a migração 0014 estar no banco.
    const lista = ((keywords as Keyword[]) ?? []).map((k, i) =>
      i < 4
        ? {
            ...k,
            cluster_id: "plano-de-teste",
            cluster_tema: "tráfego pago para clínicas",
            cluster_papel: i === 0 ? ("pilar" as const) : ("apoio" as const),
          }
        : k,
    );
    conteudo = (
      <StrategyBoard
        blogId={blog.id}
        initialKeywords={lista}
        pais="na Espanha"
        idioma="espanhol da Espanha"
        foraDoIdioma={((keywords as Keyword[]) ?? [])
          .filter((k) => k.status === "suggested")
          .filter((k) => {
            const d = detectarIdioma(`${k.suggested_title ?? ""} ${k.keyword}`);
            return d !== null && d !== idiomaDoBlog(blog).codigo;
          })
          .map((k) => k.id)}
        nomeIdiomaFora="português"
      />
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-background lg:flex-row">
      <Sidebar
        blogAtivoId={blog.id}
        blogs={lista.map((b) => ({
          id: b.id,
          nome: b.name,
          endereco: urlPublicaDoBlog(b).url,
          dominioPendente: !!b.custom_domain && !urlPublicaDoBlog(b).verified,
        }))}
      />
      <main className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {conteudo}
      </main>
    </div>
  );
}
