import { semEsquema, siteDoCliente } from "@/lib/blog-endereco";
import { idiomaDoBlog } from "@/lib/idioma";
import type { Blog } from "@/types";

// O blog e o site do cliente como uma coisa só. Antes o blog não tinha
// nenhum caminho de volta: quem chegava por um artigo no Google lia, e a
// única saída era o botão de CTA - o site da empresa ficava a um endereço
// digitado de distância. Agora o topo e o rodapé levam ao site.
//
// O texto sai no idioma do blog (é o público do cliente que lê, não quem
// opera o painel). Sem site conhecido (siteDoCliente), não há link.

const TEXTO = {
  es: "Ir al sitio web",
  pt: "Ir para o site",
  en: "Visit website",
} as const;

type BlogDoSite = Pick<Blog, "name" | "custom_domain" | "language" | "brand_domains" | "pasta_url">;

/** Link para o site principal do cliente, na cor do cabeçalho do blog. */
export function LinkDoSite({ blog }: { blog: BlogDoSite }) {
  const site = siteDoCliente(blog);
  if (!site) return null;
  return (
    <a href={site} className="text-sm opacity-80 hover:underline hover:opacity-100">
      {TEXTO[idiomaDoBlog(blog).codigo]}
    </a>
  );
}

export function RodapeDoBlog({
  blog,
  largura,
}: {
  blog: BlogDoSite;
  /** A mesma coluna da página: max-w-3xl no início, max-w-2xl no artigo. */
  largura: "max-w-2xl" | "max-w-3xl";
}) {
  const site = siteDoCliente(blog);
  return (
    <footer className="border-t border-slate-100 dark:border-slate-800">
      <div
        className={`mx-auto flex ${largura} flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-8 text-sm text-slate-500 dark:text-slate-400`}
      >
        <span>
          © {new Date().getFullYear()} {blog.name}
        </span>
        {site && (
          <a href={site} className="hover:text-slate-900 hover:underline dark:hover:text-slate-100">
            {semEsquema(site)}
          </a>
        )}
      </div>
    </footer>
  );
}
