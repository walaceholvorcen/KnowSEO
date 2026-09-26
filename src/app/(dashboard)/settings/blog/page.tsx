import { redirect } from "next/navigation";
import { pagina } from "@/components/ui";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import type { InternalLink } from "@/types";
import { SettingsNav } from "../settings-nav";
import { BlogSettingsForm } from "./blog-settings-form";
import { InternalLinksManager } from "./internal-links-manager";
import { PublicarNoDominio } from "./publicar-no-dominio";
import { PublicarNaPasta } from "./publicar-na-pasta";
import { Lede, Secao } from "@/components/lede";
import { origemDoApp, semEsquema, urlPublicaDoBlog } from "@/lib/blog-endereco";

export default async function BlogSettingsPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog) redirect("/onboarding");

  const { data: links } = await supabase
    .from("internal_links")
    .select("*")
    .eq("blog_id", blog.id)
    .order("created_at", { ascending: false });

  // Mesma precedência do resto do painel: o endereço que de fato abre.
  const publica = urlPublicaDoBlog(blog);
  const noAr = semEsquema(publica.url);

  const veredito = !blog.custom_domain
    ? "Este blog ainda não está no domínio do cliente."
    : publica.verified
      ? `O blog responde em ${noAr}.`
      : blog.domain_status === "error"
        ? `${blog.custom_domain} está cadastrado, mas o DNS não foi validado.`
        : `${blog.custom_domain} está cadastrado e aguardando o DNS propagar.`;
  // Enquanto o domínio próprio não é confirmado, o blog segue no caminho da
  // plataforma - e a tela precisa dizer onde.
  const apoioPendente = blog.custom_domain && !publica.verified && (
    <>
      Domínio próprio ainda não confirmado. O blog está no ar em{" "}
      <a
        href={publica.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-cobalto-700 hover:underline dark:text-cobalto-300"
      >
        {noAr}
      </a>
      .
    </>
  );

  return (
    <div className={pagina("estreita")}>
      <SettingsNav />
      <Lede
        apoio={
          apoioPendente ||
          (!blog.custom_domain && (
            <>
              Este é o endereço de prévia, para você conferir antes de
              publicar: ele fica fora do Google de propósito. O blog do
              cliente vive no domínio dele — configure abaixo.
            </>
          ))
        }
      >
        {veredito}
      </Lede>

      <BlogSettingsForm
        blog={blog}
        prefixoDoEndereco={semEsquema(
          urlPublicaDoBlog({ ...blog, custom_domain: null }).url,
        ).slice(0, -blog.subdomain.length)}
      />

      {/* O subdomínio vem primeiro porque é o caminho de todo cliente: um
          registro no DNS, dois minutos, funciona em qualquer registrador.
          A pasta ganha mais SEO, mas exige um Worker do Cloudflare - o que
          só existe se o domínio do cliente já estiver lá. Apresentar a
          pasta primeiro, como estava, era abrir com a porta mais difícil. */}
      <Secao>Publicar no domínio do cliente</Secao>
      <div className="mt-4">
        <PublicarNoDominio
          dominio={blog.custom_domain}
          statusInicial={blog.domain_status}
        />
      </div>

      <details className="mt-8 group">
        <summary className="cursor-pointer text-sm font-medium text-slate-700 marker:text-slate-400 dark:text-slate-300">
          Publicar numa pasta do site do cliente (avançado)
        </summary>
        <p className="mt-3 max-w-[68ch] text-sm text-slate-600 dark:text-slate-400">
          <strong>cliente.com/blog</strong> é o formato que mais ajuda o SEO
          dele: o Google trata a pasta como parte do site, então cada artigo
          soma autoridade ao domínio inteiro. O preço é o pré-requisito — o
          domínio do cliente precisa estar na Cloudflare, porque a pasta é
          encaminhada por um Worker de lá. Sem isso, use o subdomínio acima.
        </p>
        <div className="mt-4">
          <PublicarNaPasta
            enderecoInicial={blog.pasta_url ?? null}
            statusInicial={blog.pasta_status ?? "pending"}
            appOrigin={origemDoApp()}
          />
        </div>
      </details>

      <Secao>Linkagem interna</Secao>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Páginas do seu site que a IA pode citar dentro dos artigos.
      </p>
      <div className="mt-4">
        <InternalLinksManager
          blogId={blog.id}
          initialLinks={(links as InternalLink[]) ?? []}
        />
      </div>
    </div>
  );
}
