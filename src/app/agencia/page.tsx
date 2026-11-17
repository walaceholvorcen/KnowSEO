import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lerFuso } from "@/lib/datas";
import { carregarSubcontas } from "./dados";
import { AgenciaPainel } from "./painel";

export const metadata: Metadata = { title: "Agência" };

// Fora do grupo do painel de propósito: aqui não existe "subconta ativa", e
// requireUserAndWorkspace manda o administrador sem subconta escolhida para
// cá - chamá-lo desta página fecharia um laço de redirecionamento.
export default async function AgenciaPage() {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");

  // Quem não é administrador não tem o que ver aqui: volta para a própria
  // conta. Antes da migração 0024 a função não existe, o resultado é nulo e
  // todo mundo cai neste mesmo caminho.
  const { data: admin } = await supabase.rpc("eh_admin_da_agencia");
  if (admin !== true) redirect("/dashboard");

  const [subcontas, fuso] = await Promise.all([
    carregarSubcontas(supabase),
    lerFuso(),
  ]);

  return <AgenciaPainel subcontas={subcontas} fuso={fuso} />;
}
