import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import type { InternalLink } from "@/types";
import { SettingsNav } from "../settings-nav";
import { BlogSettingsForm } from "./blog-settings-form";
import { InternalLinksManager } from "./internal-links-manager";

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

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Configurações</h1>
      <SettingsNav />

      <div className="mt-6 space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Blog e Domínio
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Seu blog está em{" "}
            <a
              href={`http://${blog.subdomain}.${rootDomain}`}
              target="_blank"
              className="text-navy-600 dark:text-navy-300 underline"
            >
              {blog.subdomain}.{rootDomain}
            </a>
          </p>
          <div className="mt-4">
            <BlogSettingsForm blog={blog} />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Linkagem Interna
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Páginas do seu site que a IA pode citar dentro dos artigos.
          </p>
          <div className="mt-4">
            <InternalLinksManager
              blogId={blog.id}
              initialLinks={(links as InternalLink[]) ?? []}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
