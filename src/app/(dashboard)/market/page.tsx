import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import { buscarConexao } from "@/lib/google/oauth";
import { extractDomain, isDirectory } from "@/lib/citation";
import { MarketBoard } from "./market-board";

export interface MarketAnalysisRow {
  id: string;
  status: "running" | "done" | "error";
  competitor_domains: string[];
  client_pages: number;
  competitor_pages: number;
  gsc_conectado: boolean;
  error_message: string | null;
  created_at: string;
}

export interface MarketThemeRow {
  id: number;
  termo: string;
  paginas_cliente: number;
  paginas_concorrentes: number;
  concorrentes_que_cobrem: number;
  lacuna: number;
  situacao: "lacuna" | "disputado" | "seu_terreno";
  exemplos: string[];
  posicao: number;
}

export interface MarketChanceRow {
  id: number;
  query: string;
  tipo: "pagina_dois" | "sem_clique";
  impressoes: number;
  cliques: number;
  posicao: number;
}

export default async function MarketPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  const blog = blogs[0];

  const { data: rodada } = await supabase
    .from("market_analyses")
    .select("*")
    .eq("blog_id", blog.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const analise = (rodada as MarketAnalysisRow | null) ?? null;

  const [{ data: temas }, { data: chances }] = analise
    ? await Promise.all([
        supabase
          .from("market_themes")
          .select("*")
          .eq("analysis_id", analise.id)
          .order("posicao"),
        supabase
          .from("market_chances")
          .select("*")
          .eq("analysis_id", analise.id)
          .order("impressoes", { ascending: false }),
      ])
    : [{ data: null }, { data: null }];

  // Concorrentes que o Radar GEO já viu citados no lugar da marca. É dado
  // real de quem ganha a resposta da IA - melhor ponto de partida do que uma
  // caixa de texto vazia esperando que o cliente lembre dos rivais.
  const { data: citacoes } = await supabase
    .from("ai_visibility_checks")
    .select("competitors")
    .eq("blog_id", blog.id)
    .limit(60);

  // Filtra na leitura, não só na gravação: as checagens feitas antes da
  // separação entre citação e resultado de busca ainda têm agregador e
  // domínio próprio misturados, e sugerir sortlist.com como concorrente
  // envenenaria os temas da análise inteira.
  const proprios = [
    ...(blog.brand_domains ?? []),
    blog.custom_domain,
  ].filter((d): d is string => Boolean(d));

  const contagem = new Map<string, number>();
  for (const linha of (citacoes as { competitors: string[] | null }[]) ?? []) {
    for (const bruto of linha.competitors ?? []) {
      const dominio = extractDomain(bruto);
      if (!dominio || isDirectory(dominio)) continue;
      if (proprios.some((p) => dominio === extractDomain(p))) continue;
      contagem.set(dominio, (contagem.get(dominio) ?? 0) + 1);
    }
  }
  const sugeridos = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([dominio]) => dominio);

  const conexao = await buscarConexao(workspace.id).catch(() => null);

  return (
    <MarketBoard
      blogId={blog.id}
      analise={analise}
      temas={(temas as MarketThemeRow[]) ?? []}
      chances={(chances as MarketChanceRow[]) ?? []}
      sugeridos={sugeridos}
      gscPronto={Boolean(conexao && blog.gsc_property)}
    />
  );
}
