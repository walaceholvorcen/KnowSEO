import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerRelatorio, periodoEntre } from "@/lib/relatorio";
import { pagina } from "@/components/ui";
import type { Blog } from "@/types";
import { carregarRelatorio } from "@/app/(dashboard)/reports/dados";
import { Relatorio } from "@/app/(dashboard)/reports/relatorio";

// Link somente leitura para o cliente final, sem login. O token é a única
// autorização: o client admin ignora RLS, então TODA consulta aqui é
// filtrada pelo blogId que saiu de dentro da assinatura - nunca de parâmetro
// da URL fora dela.

export const metadata: Metadata = {
  title: "Relatório",
  // Relatório de cliente não pode cair no Google por um link vazado.
  robots: { index: false, follow: false },
};

function LinkInvalido() {
  return (
    <div className={pagina("estreita")}>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        Este link expirou ou não é válido.
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Peça um link novo a quem enviou o relatório.
      </p>
    </div>
  );
}

export default async function RelatorioPublico({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const dados = lerRelatorio(decodeURIComponent(token), process.env.RELATORIO_SECRET ?? "");
  const periodo = dados && periodoEntre(dados.de, dados.ate);
  if (!dados || !periodo) return <LinkInvalido />;

  const admin = createAdminClient();
  const { data: blog } = await admin.from("blogs").select("*").eq("id", dados.blogId).maybeSingle();
  if (!blog) return <LinkInvalido />;

  const { eventos, artigos } = await carregarRelatorio(admin, dados.blogId, periodo);

  return (
    <div className="min-h-full bg-slate-50 dark:bg-background">
      <Relatorio blog={blog as Blog} periodo={periodo} eventos={eventos} artigos={artigos} publico />
    </div>
  );
}
