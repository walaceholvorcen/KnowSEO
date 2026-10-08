import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireUserAndWorkspace,
  getWorkspaceBlogs,
  getBlogAtivo,
} from "@/lib/workspace";
import { Sidebar } from "@/components/sidebar";
import { urlPublicaDoBlog } from "@/lib/blog-endereco";
import { DetectarFuso } from "@/components/detectar-fuso";
import { buscarConexao } from "@/lib/google/oauth";
import { artigosUsados } from "@/lib/limite-de-uso";
import { cotaDeArtigos, textoDaCota } from "@/lib/plano";
import { formatarData } from "@/lib/datas";

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

  // A conexão com o Google morre sozinha - app em modo de teste no Google
  // Cloud perde o acesso a cada 7 dias - e morria calada: o Mercado engolia
  // o erro e o relatório saía sem o dado. O aviso mora aqui, e não só em
  // Integrações, porque ninguém abre Integrações para conferir uma coisa que
  // não sabe que quebrou. Uma consulta pela chave primária, em paralelo com
  // o blog ativo, para não somar tempo ao clique (PROCESSO 26).
  // A cota do plano (migração 0021) entra no mesmo lote: é uma contagem
  // com `head: true`, que não traz linha nenhuma. Falha vira null e o
  // contador some da barra - número errado ali seria pior que nenhum.
  const cotaDoPlano = cotaDeArtigos(workspace);
  const [blogAtivo, google, usados] = await Promise.all([
    getBlogAtivo(supabase, workspace.id),
    buscarConexao(workspace.id).catch(() => null),
    artigosUsados(supabase, workspace.id, cotaDoPlano.desde).catch(() => null),
  ]);
  const blog = blogAtivo!;

  return (
    // Coluna no celular (barra no topo), linha a partir de telas largas
    // (barra lateral fixa). O fundo do conteúdo é um tom mais claro que o da
    // barra: são duas camadas de neutro, e a barra lê como moldura.
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-background lg:flex-row">
      <DetectarFuso />
      <Sidebar
        blogAtivoId={blog.id}
        cota={
          usados === null || cotaDoPlano.indefinida
            ? null
            : textoDaCota(usados, cotaDoPlano)
        }
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
        {google?.quebradaEm && (
          <p
            role="status"
            className="border-b border-slate-200 border-l-2 border-l-nota-critico bg-white px-5 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:border-l-nota-critico dark:bg-slate-900 dark:text-slate-300 sm:px-8 lg:px-10"
          >
            A conexão com o Google caiu{" "}
            {formatarData(google.quebradaEm, "UTC", "curta")} e desde então Search
            Console, GA4 e volume de busca não chegam.{" "}
            <Link
              href="/settings/integrations"
              className="font-medium text-cobalto-700 hover:underline dark:text-cobalto-300"
            >
              Reconectar
            </Link>
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
