import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import { Lede, Linha, Secao } from "@/components/lede";
import { encontrarGargalo, type Etapa } from "@/lib/gargalo";
import { EvolucaoDosArtigos } from "./evolucao";
import { scoreBand } from "@/lib/audit/rules";
import type { AnalyticsEvent, OnboardingSteps } from "@/types";

// O passo "veja as primeiras visitas" saiu: ver um número não é
// configuração, é consequência. A configuração acaba quando o blog está
// pronto para produzir - daí em diante o painel mostra a operação, não a
// lista de tarefas.
const STEPS: {
  key: keyof OnboardingSteps;
  title: string;
  description: string;
  href: string;
}[] = [
  {
    key: "brand_dna",
    title: "Defina o DNA da marca",
    description: "O que a empresa faz, para quem escreve e em que tom.",
    href: "/settings/brand",
  },
  {
    key: "site_analyzed",
    title: "Mapeie as páginas do seu site",
    description: "É o que permite link interno automático nos artigos.",
    href: "/settings/blog",
  },
  {
    key: "domain_connected",
    title: "Conecte seu domínio",
    description: "Use o seu domínio no lugar do subdomínio gratuito.",
    href: "/settings/blog",
  },
  {
    key: "first_article_published",
    title: "Publique o primeiro artigo",
    description: "Escolha uma pauta e deixe a IA escrever.",
    href: "/strategy",
  },
];

// A corrente do produto, na ordem em que uma coisa depende da outra. É a
// mesma ordem que o diagnóstico de gargalo percorre, para que a frase de
// cima e a lista de baixo nunca contem histórias diferentes.
const ETAPA_DA_LINHA: Record<string, Etapa> = {
  site: "site",
  pautas: "pauta",
  artigos: "conteudo",
  visitas: "alcance",
  conversas: "conversao",
  ia: "ia",
};

export default async function DashboardHomePage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  const blog = blogs[0];

  const desde = new Date();
  desde.setDate(desde.getDate() - 28);

  const [
    { data: audits },
    { count: pautas },
    { count: publicados },
    { data: eventos },
    { count: perguntas },
    { data: checks },
    { data: primeiroArtigo },
  ] = await Promise.all([
    supabase
      .from("site_audits")
      .select("score_google,score_ai,status,created_at")
      .eq("blog_id", blog.id)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("keywords")
      .select("id", { count: "exact", head: true })
      .eq("blog_id", blog.id)
      .eq("status", "suggested"),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("blog_id", blog.id)
      .eq("status", "published"),
    supabase
      .from("analytics_events")
      .select("event_type")
      .eq("blog_id", blog.id)
      .gte("created_at", desde.toISOString()),
    supabase
      .from("ai_queries")
      .select("id", { count: "exact", head: true })
      .eq("blog_id", blog.id)
      .eq("active", true),
    supabase
      .from("ai_visibility_checks")
      .select("cited,competitors,checked_at")
      .eq("blog_id", blog.id)
      .order("checked_at", { ascending: false })
      .limit(200),
    supabase
      .from("articles")
      .select("published_at")
      .eq("blog_id", blog.id)
      .eq("status", "published")
      .not("published_at", "is", null)
      .order("published_at", { ascending: true })
      .limit(1),
  ]);

  const auditoria = (
    audits as { score_google: number | null; score_ai: number | null }[]
  )?.[0];

  const eventosLista = (eventos as Pick<AnalyticsEvent, "event_type">[]) ?? [];
  const visitas = eventosLista.filter(
    (e) => e.event_type === "pageview",
  ).length;
  const conversas = eventosLista.filter(
    (e) => e.event_type === "cta_click" || e.event_type === "whatsapp_click",
  ).length;

  // Só a rodada mais recente conta: misturar rodadas antigas faria a taxa
  // de citação parecer melhor (ou pior) do que a situação de hoje.
  const rodadas = (checks as
    | { cited: boolean; competitors: string[] | null; checked_at: string }[]
    | null) ?? [];
  const ultimaRodada = rodadas[0]?.checked_at.slice(0, 10);
  const daRodada = rodadas.filter(
    (c) => c.checked_at.slice(0, 10) === ultimaRodada,
  );
  const citacoes = daRodada.length ? daRodada.filter((c) => c.cited).length : null;

  const porRival = new Map<string, number>();
  for (const c of daRodada) {
    for (const d of c.competitors ?? [])
      porRival.set(d, (porRival.get(d) ?? 0) + 1);
  }
  const rivalCitado =
    [...porRival.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const gargalo = encontrarGargalo({
    notaGoogle: auditoria?.score_google ?? null,
    pautasAbertas: pautas ?? 0,
    artigosPublicados: publicados ?? 0,
    visitas,
    conversas,
    perguntasIa: perguntas ?? 0,
    citacoesIa: citacoes,
    rivalCitado,
  });

  const faltando = STEPS.filter((s) => !workspace.onboarding_steps[s.key]);
  const configurando = faltando.length > 0;

  const linhas = [
    {
      id: "site",
      titulo: "Saúde do site",
      valor: auditoria?.score_google ?? null,
      sufixo: "de 100",
      estado:
        auditoria?.score_google != null
          ? scoreBand(auditoria.score_google)
          : null,
      href: "/audit",
      vazio: "Nunca auditado",
    },
    {
      id: "pautas",
      titulo: "Pautas esperando",
      valor: pautas ?? 0,
      href: "/strategy",
      vazio: "Nenhuma sugerida",
    },
    {
      id: "artigos",
      titulo: "Artigos no ar",
      valor: publicados ?? 0,
      href: "/contents",
      vazio: "Nenhum publicado",
    },
    {
      id: "visitas",
      titulo: "Visitas em 28 dias",
      valor: visitas,
      href: "/reports",
      vazio: "Ninguém ainda",
    },
    {
      id: "conversas",
      titulo: "Conversas em 28 dias",
      valor: conversas,
      href: "/reports",
      vazio: "Ninguém chamou",
    },
    {
      id: "ia",
      titulo: "Citações em IA",
      valor: citacoes,
      sufixo: perguntas ? `de ${perguntas}` : undefined,
      href: "/visibility",
      vazio: "Nunca consultado",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <Lede
        apoio={configurando ? undefined : `Blog ${blog?.name}.`}
        acao={
          <Link
            href={gargalo.acaoHref}
            className="rounded-lg bg-cobalto-600 px-4 py-2 font-semibold text-white hover:bg-cobalto-700"
          >
            {gargalo.acaoTexto}
          </Link>
        }
      >
        {configurando
          ? "Faltam alguns ajustes antes do blog começar a produzir sozinho."
          : gargalo.frase}
      </Lede>

      {configurando && (
        <>
          <Secao>Configuração</Secao>
          <p className="text-slate-600 dark:text-slate-400">
            {STEPS.length - faltando.length} de {STEPS.length} prontos. Cada
            passo concluído libera mais um artigo.
          </p>
          <ul className="mt-4">
            {STEPS.map((step) => {
              const feito = workspace.onboarding_steps[step.key];
              return (
                <Linha key={step.key}>
                  <Link
                    href={step.href}
                    className="group flex items-baseline gap-3"
                  >
                    <span className="w-4 shrink-0 text-nota-excelente">
                      {feito && <Check size={16} />}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={
                          feito
                            ? "text-slate-400 dark:text-slate-500"
                            : "text-slate-900 dark:text-slate-100 group-hover:text-cobalto-600 dark:group-hover:text-cobalto-400"
                        }
                      >
                        {step.title}
                      </span>
                      {!feito && (
                        <span className="mt-0.5 block text-slate-500 dark:text-slate-400">
                          {step.description}
                        </span>
                      )}
                    </span>
                  </Link>
                </Linha>
              );
            })}
          </ul>
        </>
      )}

      <EvolucaoDosArtigos
        primeiraPublicacao={
          (primeiroArtigo as { published_at: string }[] | null)?.[0]
            ?.published_at ?? null
        }
      />

      <Secao>A operação</Secao>
      <p className="text-slate-600 dark:text-slate-400">
        Uma coisa depende da anterior. A ordem é a da corrente.
      </p>

      <ul className="mt-4">
        {linhas.map((l) => {
          // O elo travado ganha o filete e o rótulo; os outros ficam
          // quietos. Marcar todos seria o mesmo que não marcar nenhum.
          const travado = ETAPA_DA_LINHA[l.id] === gargalo.etapa;
          const corFaixa =
            l.estado === "excelente" || l.estado === "bom"
              ? "text-nota-excelente"
              : l.estado === "atencao"
                ? "text-nota-atencao"
                : l.estado === "critico"
                  ? "text-nota-critico"
                  : "";

          return (
            <Linha key={l.id}>
              <Link
                href={l.href}
                className="group flex items-baseline justify-between gap-4"
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  {travado && (
                    <span className="h-0.5 w-4 shrink-0 translate-y-[-0.3em] bg-nota-atencao" />
                  )}
                  <span className="min-w-0">
                    <span className="text-slate-900 dark:text-slate-100 group-hover:text-cobalto-600 dark:group-hover:text-cobalto-400">
                      {l.titulo}
                    </span>
                    <span className="mt-0.5 block text-slate-500 dark:text-slate-400">
                      {travado ? (
                        <span className="text-nota-atencao">
                          É aqui que está travado
                        </span>
                      ) : l.estado ? (
                        <span className={corFaixa}>
                          {l.estado === "atencao"
                            ? "Precisa atenção"
                            : l.estado === "critico"
                              ? "Crítico"
                              : l.estado === "bom"
                                ? "Bom"
                                : "Excelente"}
                        </span>
                      ) : l.valor === null || l.valor === 0 ? (
                        l.vazio
                      ) : (
                        ""
                      )}
                    </span>
                  </span>
                </span>

                <span className="flex shrink-0 items-baseline gap-1.5">
                  <span className="tabular font-display text-3xl text-slate-900 dark:text-slate-100">
                    {l.valor === null ? "—" : l.valor}
                  </span>
                  {l.sufixo && l.valor !== null && (
                    <span className="text-slate-400 dark:text-slate-500">
                      {l.sufixo}
                    </span>
                  )}
                  <ArrowRight
                    size={16}
                    className="ml-1 self-center text-slate-300 group-hover:text-cobalto-600 dark:text-slate-700 dark:group-hover:text-cobalto-400"
                  />
                </span>
              </Link>
            </Linha>
          );
        })}
      </ul>
    </div>
  );
}
