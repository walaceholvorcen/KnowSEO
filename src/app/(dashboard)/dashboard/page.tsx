import Link from "next/link";
import { Check } from "lucide-react";
import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import { Lede, Linha, Secao } from "@/components/lede";
import type { OnboardingSteps } from "@/types";

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
    key: "domain_connected",
    title: "Conecte seu domínio",
    description: "Use o seu domínio no lugar do subdomínio gratuito.",
    href: "/settings/blog",
  },
  {
    key: "site_analyzed",
    title: "Mapeie as páginas do seu site",
    description: "É o que permite link interno automático nos artigos.",
    href: "/settings/blog",
  },
  {
    key: "first_article_published",
    title: "Publique o primeiro artigo",
    description: "Escolha uma pauta e deixe a IA escrever.",
    href: "/strategy",
  },
  {
    key: "analytics_connected",
    title: "Veja as primeiras visitas",
    description: "O rastreio liga sozinho com o primeiro artigo no ar.",
    href: "/reports",
  },
];

export default async function DashboardHomePage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  const blog = blogs[0];

  const desde = new Date();
  desde.setDate(desde.getDate() - 28);

  const [{ count: publicados }, { count: visitas }] = await Promise.all([
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("blog_id", blog.id)
      .eq("status", "published"),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("blog_id", blog.id)
      .eq("event_type", "pageview")
      .gte("created_at", desde.toISOString()),
  ]);

  const nArtigos = publicados ?? 0;
  const nVisitas = visitas ?? 0;
  const proximo = STEPS.find((s) => !workspace.onboarding_steps[s.key]);
  const feitos = STEPS.filter((s) => workspace.onboarding_steps[s.key]).length;

  // A frase muda com o estado real da operação. Tela vazia é convite, não
  // um zero pendurado no meio de um card.
  const veredito =
    nArtigos === 0
      ? "Seu blog está no ar e ainda sem nenhum artigo. O primeiro leva cerca de um minuto."
      : nVisitas === 0
        ? `${nArtigos} ${nArtigos === 1 ? "artigo publicado" : "artigos publicados"}, ainda sem visita registrada. Divulgue o link e o número começa a subir.`
        : `${nArtigos} ${nArtigos === 1 ? "artigo publicado" : "artigos publicados"} e ${nVisitas} ${nVisitas === 1 ? "visita" : "visitas"} nos últimos 28 dias.`;

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <Lede
        apoio={<>Blog {blog?.name}.</>}
        acao={
          proximo && (
            <Link
              href={proximo.href}
              className="rounded-lg bg-cobalto-600 px-4 py-2 font-semibold text-white hover:bg-cobalto-700"
            >
              {proximo.title}
            </Link>
          )
        }
      >
        {veredito}
      </Lede>

      <Secao>Configuração</Secao>
      <p className="text-slate-600 dark:text-slate-400">
        {feitos === STEPS.length
          ? "Tudo configurado."
          : `${feitos} de ${STEPS.length} prontos. Cada passo concluído libera mais um artigo.`}
      </p>

      <ul className="mt-4">
        {STEPS.map((step) => {
          const feito = workspace.onboarding_steps[step.key];
          return (
            <Linha key={step.key}>
              <Link href={step.href} className="group flex items-baseline gap-3">
                {/* O estado aparece na marca e no peso do texto, não numa
                    pílula colorida repetida em toda linha. */}
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
    </div>
  );
}
