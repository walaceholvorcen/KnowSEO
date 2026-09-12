import { redirect } from "next/navigation";
import {
  requireUserAndWorkspace,
  getWorkspaceBlogs,
  getBlogAtivo,
} from "@/lib/workspace";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);

  if (blogs.length === 0) {
    redirect("/onboarding");
  }

  const blog = (await getBlogAtivo(supabase, workspace.id))!;
  const raiz = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";

  return (
    // Coluna no celular (barra no topo), linha a partir de telas largas
    // (barra lateral fixa). O fundo do conteúdo é um tom mais claro que o da
    // barra: são duas camadas de neutro, e a barra lê como moldura.
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-background lg:flex-row">
      <Sidebar
        credits={workspace.credits}
        blogAtivoId={blog.id}
        blogs={blogs.map((b) => ({
          id: b.id,
          nome: b.name,
          endereco: b.custom_domain ?? `${b.subdomain}.${raiz}`,
        }))}
      />
      <main className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {children}
      </main>
    </div>
  );
}
