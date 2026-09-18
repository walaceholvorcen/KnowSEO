import { semEsquema, siteDoCliente } from "@/lib/blog-endereco";
import { idiomaDoBlog, localeDoBlog } from "@/lib/idioma";
import { autorGravado, datasDoArtigo } from "@/lib/autor";
import { formatarData, fusoDoPais } from "@/lib/datas";
import { paisDoBlog } from "@/lib/keywords/metricas";
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

const TEXTOS = {
  es: { por: "Por", publicado: "Publicado el", atualizado: "Actualizado el", sobre: "Sobre el autor", perfil: "Ver perfil" },
  pt: { por: "Por", publicado: "Publicado em", atualizado: "Atualizado em", sobre: "Sobre o autor", perfil: "Ver perfil" },
  en: { por: "By", publicado: "Published", atualizado: "Updated", sobre: "About the author", perfil: "View profile" },
} as const;

type BlogDoArtigo = Pick<Blog, "autor" | "custom_domain" | "language">;

function contexto(blog: BlogDoArtigo) {
  const locale = localeDoBlog(blog);
  // Fuso do país do domínio: é o leitor do cliente que lê a data.
  const fuso = fusoDoPais(paisDoBlog({ dominio: blog.custom_domain, idioma: blog.language }));
  return {
    t: TEXTOS[idiomaDoBlog(blog).codigo],
    data: (iso: string) => formatarData(iso, fuso, "longa", locale),
  };
}

/**
 * Quem escreveu e quando, logo abaixo do título. Data visível é sinal de
 * atualidade para o leitor e para a IA, que prefere citar o que sabe
 * quando foi escrito. <time datetime> deixa a data legível para máquina.
 */
export function AssinaturaDoArtigo({
  blog,
  publicadoEm,
  atualizadoEm,
}: {
  blog: BlogDoArtigo;
  publicadoEm: string | null;
  atualizadoEm: string | null;
}) {
  const autor = autorGravado(blog.autor);
  const datas = datasDoArtigo(publicadoEm, atualizadoEm);
  if (!autor && !datas.publicado) return null;
  const { t, data } = contexto(blog);

  const partes: React.ReactNode[] = [];
  if (autor) {
    partes.push(
      <span key="autor">
        {t.por}{" "}
        <span className="font-medium text-slate-700 dark:text-slate-300">{autor.nome}</span>
        {autor.cargo ? `, ${autor.cargo}` : ""}
      </span>,
    );
  }
  if (datas.publicado) {
    partes.push(
      <time key="pub" dateTime={datas.publicado}>
        {t.publicado} {data(datas.publicado)}
      </time>,
    );
  }
  if (datas.atualizado) {
    partes.push(
      <time key="atu" dateTime={datas.atualizado}>
        {t.atualizado} {data(datas.atualizado)}
      </time>,
    );
  }

  return (
    <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
      {partes.flatMap((p, i) =>
        i === 0 ? [p] : [<span key={`sep-${i}`} aria-hidden>·</span>, p],
      )}
    </p>
  );
}

/** Quadro no fim do artigo. Só aparece com autor cadastrado. */
export function SobreOAutor({ blog }: { blog: BlogDoArtigo }) {
  const autor = autorGravado(blog.autor);
  if (!autor) return null;
  const { t } = contexto(blog);
  return (
    <aside className="mt-12 border-t border-slate-200 pt-6 dark:border-slate-800">
      <p className="text-sm text-slate-500 dark:text-slate-400">{t.sobre}</p>
      <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{autor.nome}</p>
      {autor.cargo && (
        <p className="text-sm text-slate-600 dark:text-slate-400">{autor.cargo}</p>
      )}
      {autor.bio && <p className="mt-2 text-slate-700 dark:text-slate-300">{autor.bio}</p>}
      {autor.perfil && (
        <a
          href={autor.perfil}
          target="_blank"
          rel="author noopener noreferrer"
          className="mt-2 inline-block text-sm text-slate-600 underline hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          {t.perfil}
        </a>
      )}
    </aside>
  );
}
