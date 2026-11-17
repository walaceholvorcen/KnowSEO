// O painel da agência, em função pura: a tela desenha o que sai daqui.
//
// A pergunta que a tela responde é uma só - "qual cliente precisa de mim
// agora?". Em outubro o calendário de dois clientes ficou vazio por duas
// semanas e ninguém viu, porque para ver era preciso entrar em cada conta.
// Por isso o estado que a tela destaca não é número de artigos: é fila
// vazia.
import { cotaDeArtigos } from "./plano.ts";

export interface ContaDaAgencia {
  id: string;
  name: string;
  plan?: string | null;
  artigos_por_mes?: number | null;
  created_at: string;
}

export interface BlogDaAgencia {
  id: string;
  workspace_id: string;
  name: string;
  /** Endereço público já resolvido (urlPublicaDoBlog) - depende de ambiente,
   *  então quem chama resolve e esta função continua pura. */
  endereco: string;
}

export interface ArtigoDaAgencia {
  blog_id: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
}

export type EstadoDaSubconta = "sem-blog" | "fila-vazia" | "em-dia";

export interface Subconta {
  id: string;
  nome: string;
  blog: { nome: string; endereco: string } | null;
  estado: EstadoDaSubconta;
  publicados: number;
  agendados: number;
  /** Rascunho pronto, sem data: trabalho feito que não vai ao ar sozinho. */
  semData: number;
  proximo: string | null;
  ultimoPublicado: string | null;
  usados: number;
  /** Nulo quando a cota não é legível (ver cotaDeArtigos). */
  limite: number | null;
}

export function resumirSubcontas(
  contas: ContaDaAgencia[],
  blogs: BlogDaAgencia[],
  artigos: ArtigoDaAgencia[],
  agora: Date = new Date(),
): Subconta[] {
  const contaDoBlog = new Map(blogs.map((b) => [b.id, b.workspace_id]));
  const porConta = new Map<string, ArtigoDaAgencia[]>();
  for (const a of artigos) {
    const conta = contaDoBlog.get(a.blog_id);
    if (!conta) continue;
    porConta.set(conta, [...(porConta.get(conta) ?? []), a]);
  }

  return contas
    .map((conta): Subconta => {
      const blog = blogs.find((b) => b.workspace_id === conta.id) ?? null;
      const seus = porConta.get(conta.id) ?? [];
      const publicados = seus.filter((a) => a.status === "published");
      const naFila = seus.filter((a) => a.status !== "published");
      const agendados = naFila
        .filter((a) => a.scheduled_at)
        .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!));
      const ultimo = publicados
        .map((a) => a.published_at)
        .filter(Boolean)
        .sort()
        .at(-1);

      const cota = cotaDeArtigos(conta, agora);
      const desde = cota.desde?.toISOString() ?? "";

      return {
        id: conta.id,
        nome: conta.name,
        blog: blog ? { nome: blog.name, endereco: blog.endereco } : null,
        estado: !blog ? "sem-blog" : agendados.length ? "em-dia" : "fila-vazia",
        publicados: publicados.length,
        agendados: agendados.length,
        semData: naFila.length - agendados.length,
        proximo: agendados[0]?.scheduled_at ?? null,
        ultimoPublicado: ultimo ?? null,
        // A mesma conta do contador da barra lateral (artigosUsados): artigo
        // criado dentro da janela da cota, publicado ou não.
        usados: seus.filter((a) => a.created_at >= desde).length,
        limite: Number.isFinite(cota.limite) ? cota.limite : null,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** A frase que abre a tela. Diz quantos clientes e quantos estão parados. */
export function vereditoDaAgencia(subcontas: Subconta[]): string {
  const n = subcontas.length;
  if (n === 0) return "Nenhuma subconta ainda. Crie a primeira abaixo.";

  const paradas = subcontas.filter((s) => s.estado === "fila-vazia").length;
  const semBlog = subcontas.filter((s) => s.estado === "sem-blog").length;

  const partes: string[] = [];
  if (paradas) partes.push(`${paradas} sem nada agendado`);
  if (semBlog) partes.push(`${semBlog} sem blog montado`);
  if (!partes.length) {
    return n === 1
      ? "1 subconta, com publicação agendada."
      : `${n} subcontas, todas com publicação agendada.`;
  }
  return `${n} ${n === 1 ? "subconta" : "subcontas"}: ${partes.join(" e ")}.`;
}
