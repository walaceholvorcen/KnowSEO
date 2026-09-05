import Link from "next/link";
import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import { Lede, Linha, Secao } from "@/components/lede";
import type { AnalyticsEvent } from "@/types";

export default async function ReportsPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  const blog = blogs[0];

  const desde = new Date();
  desde.setDate(desde.getDate() - 28);

  const { data: events } = await supabase
    .from("analytics_events")
    .select("*")
    .eq("blog_id", blog.id)
    .gte("created_at", desde.toISOString())
    .order("created_at", { ascending: false });

  const lista = (events as AnalyticsEvent[]) ?? [];
  const visitas = lista.filter((e) => e.event_type === "pageview").length;
  const cliquesCta = lista.filter((e) => e.event_type === "cta_click").length;
  const cliquesZap = lista.filter(
    (e) => e.event_type === "whatsapp_click",
  ).length;
  const conversas = cliquesCta + cliquesZap;

  const porCaminho = new Map<string, number>();
  for (const e of lista) {
    if (e.event_type !== "pageview" || !e.path) continue;
    porCaminho.set(e.path, (porCaminho.get(e.path) ?? 0) + 1);
  }
  const maisVistas = [...porCaminho.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // O caminho gravado inclui o prefixo interno da rota de preview
  // (/b/testando/...), que não diz nada ao cliente. Aqui ele vira o
  // título do artigo; sem correspondência, mostra só o endereço final.
  const { data: artigos } = await supabase
    .from("articles")
    .select("slug,title")
    .eq("blog_id", blog.id);

  const tituloPorSlug = new Map(
    ((artigos as { slug: string; title: string }[]) ?? []).map((a) => [
      a.slug,
      a.title,
    ]),
  );

  function nomeDaPagina(caminho: string) {
    const slug = caminho.split("/").filter(Boolean).pop() ?? "";
    return tituloPorSlug.get(slug) ?? `/${slug}`;
  }

  // A pergunta que o cliente traz para esta tela é "o blog me trouxe
  // alguém?". A resposta é uma frase, não três números lado a lado sem
  // relação declarada entre eles.
  const veredito =
    visitas === 0
      ? "Ainda não houve visita nos últimos 28 dias. O rastreio já está ligado — falta divulgar o link."
      : conversas === 0
        ? `${visitas} ${visitas === 1 ? "visita" : "visitas"} nos últimos 28 dias, e nenhuma virou conversa ainda.`
        : `${visitas} ${visitas === 1 ? "visita" : "visitas"} nos últimos 28 dias, ${conversas} ${conversas === 1 ? "virou conversa" : "viraram conversa"}.`;

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <Lede
        apoio="Dado de primeira parte, medido no seu próprio blog. Não depende do Google Analytics nem de consentimento de cookie."
        acao={
          visitas === 0 && (
            <Link
              href="/contents"
              className="rounded-lg bg-cobalto-600 px-4 py-2 font-semibold text-white hover:bg-cobalto-700"
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
          <Secao>De onde vieram as conversas</Secao>
          <ul className="mt-4">
            <Linha>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-slate-700 dark:text-slate-300">
                  WhatsApp
                </span>
                <span className="tabular font-display text-2xl text-slate-900 dark:text-slate-100">
                  {cliquesZap}
                </span>
              </div>
            </Linha>
            <Linha>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-slate-700 dark:text-slate-300">
                  Botão do artigo
                </span>
                <span className="tabular font-display text-2xl text-slate-900 dark:text-slate-100">
                  {cliquesCta}
                </span>
              </div>
            </Linha>
          </ul>
        </>
      )}

      <Secao>Páginas mais visitadas</Secao>
      {maisVistas.length === 0 ? (
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Nada registrado ainda. Assim que alguém abrir um artigo, ele aparece
          aqui.
        </p>
      ) : (
        <ul className="mt-4">
          {maisVistas.map(([caminho, contagem]) => (
            <Linha key={caminho}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">
                  {nomeDaPagina(caminho)}
                </span>
                <span className="tabular shrink-0 font-display text-2xl text-slate-900 dark:text-slate-100">
                  {contagem}
                </span>
              </div>
            </Linha>
          ))}
        </ul>
      )}
    </div>
  );
}
