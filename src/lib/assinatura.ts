import { createAdminClient } from "./supabase/admin.ts";
import { artigosDoPagamento } from "./plano.ts";

// O que acontece com a conta quando o pagamento muda de estado.
//
// Escrito separado do meio de pagamento de propósito: Stripe, Paddle e
// Lemon Squeezy mandam formatos diferentes, mas todos acabam em uma destas
// duas frases - "esta conta passou a ter N artigos por mês" ou "esta conta
// voltou a ser prova". Trocar de provedor um dia é reescrever o adaptador,
// não isto.
//
// Escreve com o client de serviço porque quem chama é um webhook: não há
// sessão de usuário do outro lado. E é por isso mesmo que o id do workspace
// nunca pode vir de dado que o cliente controle - ele vem do que a gente
// mandou para o checkout e o provedor devolveu assinado.

export type ResultadoDaAssinatura = { erro: string | null };

/** Pagamento confirmado: a conta passa a valer o degrau contratado. */
export async function liberarPlano(
  workspaceId: string,
  artigosPorMes: unknown,
): Promise<ResultadoDaAssinatura> {
  const cota = artigosDoPagamento(artigosPorMes);
  if (!cota) return { erro: "Quantidade de artigos inválida no pagamento." };

  const { data, error } = await createAdminClient()
    .from("workspaces")
    .update({ plan: "pro", artigos_por_mes: cota, liberado: true })
    .eq("id", workspaceId)
    .select("id");

  if (error) return { erro: error.message };
  if (!data?.length) return { erro: "Conta não encontrada." };
  return { erro: null };
}

/**
 * Assinatura cancelada ou vencida: a conta volta para a prova.
 *
 * `artigos_por_mes` volta a null e o plano deixa de ser 'pro' - é assim que
 * `cotaDeArtigos` devolve os 5 da prova. Nada é apagado: os artigos, os
 * blogs e o histórico continuam, e voltar a pagar é uma linha.
 */
export async function encerrarPlano(
  workspaceId: string,
): Promise<ResultadoDaAssinatura> {
  const { data, error } = await createAdminClient()
    .from("workspaces")
    .update({ plan: "teste", artigos_por_mes: null })
    .eq("id", workspaceId)
    .select("id");

  if (error) return { erro: error.message };
  if (!data?.length) return { erro: "Conta não encontrada." };
  return { erro: null };
}
