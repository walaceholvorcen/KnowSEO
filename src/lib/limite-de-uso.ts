import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cotaDeArtigos, mensagemDeCotaCheia } from "@/lib/plano";

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

// Conta nova nasce em liberação (migração 0016): usa auditoria e mercado,
// que não custam IA, e espera o dono da plataforma liberar o resto. Só as
// rotas que gastam IA ou API paga chamam isto.
//
// `=== false` e não `!liberado`: com o deploy na frente da migração a
// coluna ainda não existe, e travar todo mundo seria pior que deixar passar.
export function barrarSemLiberacao(workspace: {
  liberado?: boolean;
}): NextResponse | null {
  if (workspace.liberado !== false) return null;
  return NextResponse.json(
    {
      error:
        "Sua conta está em liberação. Auditoria e Mercado já funcionam; artigos, pautas e Raio X liberam assim que a conta for aprovada.",
    },
    { status: 403 },
  );
}

/**
 * A cota de artigos do plano (migração 0021). Diferente do teto por hora
 * acima: aquele existe contra abuso, este é o que foi vendido.
 *
 * Conta artigo **criado**, não publicado - é a geração que custa IA, e um
 * rascunho descartado já gastou. A segunda tentativa da trava de qualidade
 * (seção 30) reaproveita o mesmo rascunho, então um clique continua valendo
 * um artigo.
 */
export async function artigosUsados(
  supabase: SupabaseClient,
  workspaceId: string,
  desde: Date | null,
): Promise<number> {
  const { data: blogs } = await supabase
    .from("blogs")
    .select("id")
    .eq("workspace_id", workspaceId);
  const ids = ((blogs as { id: string }[]) ?? []).map((b) => b.id);
  if (!ids.length) return 0;

  let q = supabase
    .from("articles")
    .select("id", { count: "exact", head: true })
    .in("blog_id", ids);
  if (desde) q = q.gte("created_at", desde.toISOString());

  const { count, error } = await q;
  // Falha de leitura não bloqueia: o teto por hora já segura abuso, e
  // recusar o produto por um erro de contagem é pior que deixar passar um.
  return error ? 0 : (count ?? 0);
}

/** 402 pronto quando a cota do plano acabou; null quando ainda dá. */
export async function barrarSemCota(
  supabase: SupabaseClient,
  workspace: { id: string; plan?: string | null; artigos_por_mes?: number | null },
): Promise<NextResponse | null> {
  const cota = cotaDeArtigos(workspace);
  const usados = await artigosUsados(supabase, workspace.id, cota.desde);
  if (usados < cota.limite) return null;

  return NextResponse.json(
    { error: mensagemDeCotaCheia(cota) },
    { status: 402 },
  );
}
