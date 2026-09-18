import { redirect } from "next/navigation";
import {
  requireUserAndWorkspace,
  getWorkspaceBlogs,
  getBlogAtivo,
} from "@/lib/workspace";
import { Sidebar } from "@/components/sidebar";
import { urlPublicaDoBlog } from "@/lib/blog-endereco";
import { DetectarFuso } from "@/components/detectar-fuso";

// Canal de vendas da plataforma, o mesmo do Google Meu Negócio bloqueado.
const contato = process.env.NEXT_PUBLIC_CONTATO_VENDAS;

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

  return (
    // Coluna no celular (barra no topo), linha a partir de telas largas
    // (barra lateral fixa). O fundo do conteúdo é um tom mais claro que o da
    // barra: são duas camadas de neutro, e a barra lê como moldura.
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-background lg:flex-row">
      <DetectarFuso />
      <Sidebar
        blogAtivoId={blog.id}
        blogs={blogs.map((b) => ({
          id: b.id,
          nome: b.name,
          endereco: urlPublicaDoBlog(b).url,
          dominioPendente: !!b.custom_domain && !urlPublicaDoBlog(b).verified,
        }))}
      />
      <main className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {/* Conta nova nasce em liberação (migração 0016). Sem este aviso, o
            primeiro clique em "Escrever artigo" seria a primeira notícia -
            e soaria como defeito, não como etapa. */}
        {workspace.liberado === false && (
          <p
            role="status"
            className="border-b border-slate-200 border-l-2 border-l-nota-atencao bg-white px-5 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:border-l-nota-atencao dark:bg-slate-900 dark:text-slate-300 sm:px-8 lg:px-10"
          >
            Sua conta está em liberação. Auditoria e Mercado já funcionam;
            artigos, pautas e Raio X liberam assim que a conta for aprovada.
            {contato && (
              <>
                {" "}
                <a
                  href={contato}
                  className="font-medium text-cobalto-700 hover:underline dark:text-cobalto-300"
                >
                  Falar com a gente
                </a>
              </>
            )}
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
