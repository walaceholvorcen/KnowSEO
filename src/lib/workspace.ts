import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Blog, Workspace } from "@/types";
import { BLOG_COOKIE, SUBCONTA_COOKIE } from "@/lib/blog-cookie";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cliente: 1 usuário -> a conta dele. Administrador da agência (migração
// 0024): enxerga todas e trabalha na subconta que escolheu em /agencia.
//
// Isto roda antes de qualquer tela do painel mostrar alguma coisa, então
// cada ida ao banco aqui é espera que o cliente sente como "travou":
//
// - cache(): layout e página chamam esta função na mesma requisição. Sem o
//   cache, a mesma sequência de consultas rodava duas vezes seguidas.
// - getClaims(): confere o token localmente (chave assimétrica) em vez de
//   perguntar ao servidor de autenticação, que levava 300-700ms medidos.
//   As consultas seguintes continuam protegidas pelo RLS no banco.
// - vínculo e workspace numa consulta só, pelo relacionamento.
export const requireUserAndWorkspace = cache(async () => {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) {
    redirect("/login");
  }

  const user = {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };

  // Três perguntas de uma vez, para o painel da agência não somar espera:
  // de que conta a pessoa é, se ela é administradora da agência, e - quando
  // há uma subconta escolhida no cookie - se essa subconta existe para ela.
  //
  // O cookie é editável pelo visitante, então quem decide é o banco: a
  // leitura passa pela RLS, que só devolve a linha a quem é membro ou
  // administrador. Um id de outro cliente posto à mão volta vazio e cai na
  // conta da própria pessoa, sem erro na cara.
  const escolhida = (await cookies()).get(SUBCONTA_COOKIE)?.value;
  const [{ data: membership }, { data: ehAdmin }, daSubconta] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("workspace:workspaces(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    // Antes da migração 0024 a função não existe: o erro vira "não é
    // administrador" e o painel segue como sempre foi.
    supabase.rpc("eh_admin_da_agencia"),
    escolhida && UUID.test(escolhida)
      ? supabase.from("workspaces").select("*").eq("id", escolhida).maybeSingle()
      : null,
  ]);

  const admin = ehAdmin === true;
  const propria = (membership as { workspace: Workspace | null } | null)
    ?.workspace;
  // Administrador sem subconta escolhida não cai numa conta qualquer das
  // várias que enxerga: volta ao painel central para escolher.
  const workspace =
    (daSubconta?.data as Workspace | null) ?? (admin ? null : propria);

  if (!workspace) {
    if (admin) redirect("/agencia");
    // Usuário autenticado mas sem workspace ainda (edge case raro - o
    // signup normalmente já cria um). Manda para o fluxo de criação.
    redirect("/onboarding/workspace");
  }

  return { supabase, user, workspace, admin };
});

export const getWorkspaceBlogs = cache(
  async (
    supabase: Awaited<ReturnType<typeof createClient>>,
    workspaceId: string,
  ): Promise<Blog[]> => {
    const { data } = await supabase
      .from("blogs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    return (data as Blog[]) ?? [];
  },
);

// Marca um passo do onboarding como concluído. O crédito por passo saiu
// junto com a contagem de créditos: quanto o cliente pode gerar passa a ser
// o plano que ele assina, e um contador que ninguém cobrava só travava a
// geração ao chegar a zero.
export async function completeOnboardingStep(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspace: Workspace,
  step: keyof Workspace["onboarding_steps"],
) {
  if (workspace.onboarding_steps[step]) return; // já concluído, não recredita

  const updatedSteps = { ...workspace.onboarding_steps, [step]: true };

  await supabase
    .from("workspaces")
    .update({
      onboarding_steps: updatedSteps,
    })
    .eq("id", workspace.id);
}

// Cliente em operação. O comprador deste produto é agência: o painel
// precisa dizer de quem são os números e deixar trocar sem sair da tela.
export { BLOG_COOKIE };

// O id vem de cookie, mas só vale se pertencer ao workspace de quem está
// logado - cookie é editável pelo visitante, e sem esta checagem bastaria
// trocar o valor à mão para apontar o painel para o cliente de outra
// agência. Valor desconhecido cai no primeiro blog, sem erro na cara.
export const getBlogAtivo = cache(
  async (
    supabase: Awaited<ReturnType<typeof createClient>>,
    workspaceId: string,
  ): Promise<Blog | null> => {
    const blogs = await getWorkspaceBlogs(supabase, workspaceId);
    if (!blogs.length) return null;

    const escolhido = (await cookies()).get(BLOG_COOKIE)?.value;
    return blogs.find((b) => b.id === escolhido) ?? blogs[0];
  },
);
