import { redirect } from "next/navigation";
import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
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

  const blog = blogs[0];
  const raiz = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";

  return (
    // Coluna no celular (barra no topo), linha a partir de telas largas
    // (barra lateral fixa). O fundo do conteúdo é um tom mais claro que o da
    // barra: são duas camadas de neutro, e a barra lê como moldura.
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-background lg:flex-row">
      <Sidebar
        credits={workspace.credits}
        blog={{
          nome: blog.name,
          endereco: blog.custom_domain ?? `${blog.subdomain}.${raiz}`,
        }}
      />
      <main className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {children}
      </main>
    </div>
  );
}
