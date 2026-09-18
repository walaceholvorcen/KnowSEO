import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Teto por conta nas operações que gastam IA ou busca na web. Revisão de
// segurança de 17/09, item S7: sem isto, um script com uma sessão válida
// (ou um botão preso em loop) queima a conta da Anthropic em minutos.
//
// Conta as linhas que a própria operação já grava - artigo, pauta, rodada -
// em vez de um contador à parte: não há tabela nova, nem Redis, e o número
// não diverge do que de fato aconteceu. A janela é por workspace, somando
// todos os blogs dele: por blog, uma agência com 20 clientes teria 20 tetos.
//
// ponytail: duas chamadas simultâneas podem passar juntas no último lugar
// da fila (contar e gravar não são atômicos). Estourar o teto por um é
// aceitável aqui; se virar problema, a contagem vai para uma função no banco.

type Regra = {
  tabela: string;
  coluna: string;
  maximo: number;
  /** O que o cliente lê: "artigos gerados", "auditorias". */
  nome: string;
};

// Tetos por hora. Folgados para uso real (uma agência trabalhando o dia
// inteiro não chega perto) e baixos para abuso.
export const LIMITES = {
  artigo: { tabela: "articles", coluna: "created_at", maximo: 20, nome: "artigos gerados" },
  // Pauta grava 6 a 8 linhas por pedido: 160 linhas são uns 20 pedidos.
  pauta: { tabela: "keywords", coluna: "created_at", maximo: 160, nome: "pautas sugeridas" },
  // Gerar perguntas grava 10 por vez.
  perguntas: { tabela: "ai_queries", coluna: "created_at", maximo: 60, nome: "perguntas geradas" },
  raioX: { tabela: "ai_visibility_runs", coluna: "started_at", maximo: 6, nome: "análises do Raio X" },
  auditoria: { tabela: "site_audits", coluna: "created_at", maximo: 20, nome: "auditorias" },
  mercado: { tabela: "market_analyses", coluna: "created_at", maximo: 10, nome: "análises de mercado" },
} satisfies Record<string, Regra>;

/** Devolve a resposta 429 pronta quando o teto estourou; null quando pode seguir. */
export async function barrarSeEstourou(
  supabase: SupabaseClient,
  workspaceId: string,
  regra: Regra,
): Promise<NextResponse | null> {
  const { data: blogs } = await supabase
    .from("blogs")
    .select("id")
    .eq("workspace_id", workspaceId);
  const ids = ((blogs as { id: string }[]) ?? []).map((b) => b.id);
  if (!ids.length) return null;

  const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from(regra.tabela)
    .select("id", { count: "exact", head: true })
    .in("blog_id", ids)
    .gte(regra.coluna, desde);

  // Falha na contagem não bloqueia: o teto é proteção de custo, e travar o
  // produto inteiro por um erro de leitura seria pior que deixar passar.
  if (error || (count ?? 0) < regra.maximo) return null;

  return NextResponse.json(
    {
      error: `Limite de ${regra.maximo} ${regra.nome} por hora atingido. Tente de novo mais tarde.`,
    },
    { status: 429, headers: { "Retry-After": "900" } },
  );
}
