import { redirect } from "next/navigation";
import { botao, pagina } from "@/components/ui";
import Link from "next/link";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { Lede, Linha, Secao } from "@/components/lede";
import { urlDoArtigo } from "@/lib/blog-endereco";
import { DIAS_JANELA } from "../dashboard/dados";
import type { AnalyticsEvent } from "@/types";

// Número nunca sai sem unidade: "3" sozinho obrigava o cliente a adivinhar
// se era visita, conversa ou dia.
const visitasTxt = (n: number) => `${n} ${n === 1 ? "visita" : "visitas"}`;
const conversasTxt = (n: number) => `${n} ${n === 1 ? "conversa" : "conversas"}`;
const PERIODO = `nos últimos ${DIAS_JANELA} dias`;

export default async function ReportsPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog) redirect("/onboarding");

  // Mesma janela do Início, para os dois painéis não discordarem.
  const desde = new Date();
  desde.setDate(desde.getDate() - (DIAS_JANELA - 1));

  const [{ data: events }, { data: artigos }] = await Promise.all([
    supabase
      .from("analytics_events")
      .select("*")
      .eq("blog_id", blog.id)
      .gte("created_at", desde.toISOString()),
    // Pega a keyword junto: é o que faltava para responder "qual pauta
    // valeu a pena", não só "quantas visitas teve o site".
    supabase
      .from("articles")
      .select("id, title, slug, status, keywords(keyword, suggested_title)")
      .eq("blog_id", blog.id)
      .eq("status", "published"),
  ]);

  const lista = (events as AnalyticsEvent[]) ?? [];
  const visitas = lista.filter((e) => e.event_type === "pageview").length;
  const cliquesCta = lista.filter((e) => e.event_type === "cta_click").length;
  const cliquesZap = lista.filter(
    (e) => e.event_type === "whatsapp_click",
  ).length;
  const conversas = cliquesCta + cliquesZap;

  // Por artigo: soma visita e conversa vinculadas a cada article_id.
  //
  // Um evento pode ter article_id nulo (artigo apagado depois de medido -
  // a chave estrangeira zera a referência). Esse evento continua contando
  // no total acima, mas não entra em nenhuma linha de artigo aqui: inventar
  // uma linha "artigo desconhecido" seria afirmar uma origem que não temos
  // como provar.
  const porArtigo = new Map<string, { visitas: number; conversas: number }>();
  for (const e of lista) {
    if (!e.article_id) continue;
    const atual = porArtigo.get(e.article_id) ?? { visitas: 0, conversas: 0 };
    if (e.event_type === "pageview") atual.visitas++;
    else atual.conversas++;
    porArtigo.set(e.article_id, atual);
  }

  type ArtigoComKeyword = {
    id: string;
    title: string;
    slug: string;
    // PostgREST devolve objeto único aqui (keyword_id -> keywords.id é
    // muitos-para-um) - o tipo array era só o TypeScript inferindo sem
    // saber a cardinalidade real da relação.
    keywords: { keyword: string; suggested_title: string | null } | null;
  };

  const desempenho = ((artigos as unknown as ArtigoComKeyword[]) ?? [])
    .map((a) => ({
      id: a.id,
      titulo: a.title,
      slug: a.slug,
      pauta: a.keywords?.keyword ?? null,
      visitas: porArtigo.get(a.id)?.visitas ?? 0,
      conversas: porArtigo.get(a.id)?.conversas ?? 0,
    }))
    .filter((a) => a.visitas > 0 || a.conversas > 0)
    .sort((a, b) => b.visitas - a.visitas);

  // A pergunta que o cliente traz para esta tela é "o blog me trouxe
  // alguém?". A resposta é uma frase, não três números lado a lado sem
  // relação declarada entre eles.
  const veredito =
    visitas === 0
      ? `Ainda não houve visita ${PERIODO}. O rastreio já está ligado — falta divulgar o link.`
      : conversas === 0
        ? `${visitasTxt(visitas)} ${PERIODO}, e nenhuma virou conversa ainda.`
        : `${visitasTxt(visitas)} ${PERIODO}, ${conversas} ${conversas === 1 ? "virou conversa" : "viraram conversa"}.`;

  return (
    <div className={pagina()}>
      <Lede
        apoio="Dado de primeira parte, medido no seu próprio blog. Não depende do Google Analytics nem de consentimento de cookie."
        acao={
          visitas === 0 && (
            <Link
              href="/contents"
              className={botao("primario")}
            >
              Ver meus artigos
            </Link>
          )
        }
      >
        {veredito}
      </Lede>

      {conversas > 0 && (
        <>
          <Secao>De onde vieram as conversas {PERIODO}</Secao>
          <ul className="mt-4">
            <Linha>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-slate-700 dark:text-slate-300">
                  WhatsApp
                </span>
                <span className="tabular text-slate-900 dark:text-slate-100">
                  {conversasTxt(cliquesZap)}
                </span>
              </div>
            </Linha>
            <Linha>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-slate-700 dark:text-slate-300">
                  Botão do artigo
                </span>
                <span className="tabular text-slate-900 dark:text-slate-100">
                  {conversasTxt(cliquesCta)}
                </span>
              </div>
            </Linha>
          </ul>
        </>
      )}

      <Secao>Qual pauta valeu a pena {PERIODO}</Secao>
      {desempenho.length === 0 ? (
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Nada registrado ainda. Assim que alguém abrir um artigo, ele aparece
          aqui.
        </p>
      ) : (
        <ul className="mt-4">
          {/* Visitas e conversas lado a lado, com unidade, em cada linha: a
              comparação entre pautas é a pergunta desta lista. Dois links por
              linha - o artigo no painel e a página pública que foi medida. */}
          {desempenho.map((a) => (
            <Linha key={a.id}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="min-w-0">
                  <Link
                    href={`/contents/${a.id}`}
                    className="block truncate text-slate-900 hover:text-cobalto-600 dark:text-slate-100 dark:hover:text-cobalto-400"
                  >
                    {a.titulo}
                  </Link>
                  <span className="block text-sm text-slate-500 dark:text-slate-400">
                    {a.pauta ? `Pauta: ${a.pauta}` : "Sem pauta vinculada"}
                    {" · "}
                    <a
                      href={urlDoArtigo(blog, a.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cobalto-700 hover:underline dark:text-cobalto-300"
                    >
                      Ver página pública
                    </a>
                  </span>
                </span>
                <span className="tabular flex shrink-0 gap-4 text-sm text-slate-600 dark:text-slate-400">
                  <span className="text-slate-900 dark:text-slate-100">
                    {visitasTxt(a.visitas)}
                  </span>
                  <span>{conversasTxt(a.conversas)}</span>
                </span>
              </div>
            </Linha>
          ))}
        </ul>
      )}
    </div>
  );
}
