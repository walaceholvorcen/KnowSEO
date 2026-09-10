import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import type { InternalLink } from "@/types";
import { SettingsNav } from "../settings-nav";
import { BlogSettingsForm } from "./blog-settings-form";
import { InternalLinksManager } from "./internal-links-manager";
import { Lede, Secao } from "@/components/lede";

export default async function BlogSettingsPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  const blog = blogs[0];

  const { data: links } = await supabase
    .from("internal_links")
    .select("*")
    .eq("blog_id", blog.id)
    .order("created_at", { ascending: false });

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
  const enderecoGratuito = `${blog.subdomain}.${rootDomain}`;

  const veredito = !blog.custom_domain
    ? `O blog está no ar em ${enderecoGratuito}.`
    : blog.domain_status === "active"
      ? `O blog responde em ${blog.custom_domain}.`
      : blog.domain_status === "error"
        ? `${blog.custom_domain} está cadastrado, mas o DNS não foi validado.`
        : `${blog.custom_domain} está cadastrado e aguardando o DNS propagar.`;

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <SettingsNav />
      <Lede
        apoio={
          !blog.custom_domain && (
            <>
              Você pode continuar usando este endereço, ou conectar um
              domínio próprio abaixo.
            </>
          )
        }
      >
        {veredito}
      </Lede>

      <BlogSettingsForm blog={blog} />

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
