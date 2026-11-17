import type { SupabaseClient } from "@supabase/supabase-js";
import { urlPublicaDoBlog } from "@/lib/blog-endereco";
import {
  resumirSubcontas,
  type ArtigoDaAgencia,
  type ContaDaAgencia,
  type Subconta,
} from "@/lib/agencia";
import type { Blog } from "@/types";

// Três leituras, uma por tabela, e a conta é feita em memória.
//
// Com o client do administrador a RLS devolve todas as subcontas (migração
// 0024); a vitrine usa o client de serviço e recebe o mesmo.
//
// ponytail: traz todos os artigos de todas as subcontas (só cinco colunas
// curtas). O PostgREST corta em 1.000 linhas - hoje são 30. Passando de
// algumas centenas, trocar por uma view agregada por blog.
export async function carregarSubcontas(
  supabase: SupabaseClient,
): Promise<Subconta[]> {
  const [{ data: contas }, { data: blogs }, { data: artigos }] =
    await Promise.all([
      supabase.from("workspaces").select("*").order("created_at"),
      supabase.from("blogs").select("*").order("created_at"),
      supabase
        .from("articles")
        .select("blog_id,status,scheduled_at,published_at,created_at"),
    ]);

  return resumirSubcontas(
    (contas as ContaDaAgencia[]) ?? [],
    ((blogs as Blog[]) ?? []).map((b) => ({
      id: b.id,
      workspace_id: b.workspace_id,
      name: b.name,
      endereco: urlPublicaDoBlog(b).url,
    })),
    (artigos as ArtigoDaAgencia[]) ?? [],
  );
}
