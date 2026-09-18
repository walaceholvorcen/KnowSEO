// Quem assina os artigos do blog (migração 0018).
//
// Texto assinado por uma pessoa real, com cargo e perfil público, é o sinal
// de confiança que o Google e os assistentes de IA mais pesam num conteúdo
// de empresa. O perfil (LinkedIn, página "sobre" no site) é o que prova que
// a pessoa existe: vai no JSON-LD como sameAs.

export type Autor = {
  nome: string;
  cargo: string | null;
  bio: string | null;
  perfil: string | null;
};

const limpar = (v: unknown, max: number) => {
  const t = String(v ?? "").trim().replace(/\s+/g, " ");
  return t ? t.slice(0, max) : null;
};

/**
 * Valida o que veio do formulário. Tudo vazio = sem autor (remove). Com
 * algum campo preenchido, o nome é obrigatório: bio sem nome não assina nada.
 */
export function normalizarAutor(entrada: {
  nome?: unknown;
  cargo?: unknown;
  bio?: unknown;
  perfil?: unknown;
}): { autor: Autor | null } | { erro: string } {
  const nome = limpar(entrada.nome, 80);
  const cargo = limpar(entrada.cargo, 80);
  const bio = limpar(entrada.bio, 400);
  const perfilTexto = limpar(entrada.perfil, 300);

  if (!nome && !cargo && !bio && !perfilTexto) return { autor: null };
  if (!nome) return { erro: "Informe o nome de quem assina os artigos." };

  let perfil: string | null = null;
  if (perfilTexto) {
    let u: URL;
    try {
      u = new URL(/^[a-z]+:\/\//i.test(perfilTexto) ? perfilTexto : `https://${perfilTexto}`);
    } catch {
      return { erro: "O perfil precisa ser um endereço, como https://www.linkedin.com/in/nome." };
    }
    // Só https: o endereço vira link público no blog do cliente.
    if (u.protocol !== "https:") {
      return { erro: "O perfil precisa começar com https://." };
    }
    perfil = u.toString();
  }

  return { autor: { nome, cargo, bio, perfil } };
}

/** Lê o que está gravado; qualquer coisa fora do formato vale como sem autor. */
export function autorGravado(valor: unknown): Autor | null {
  if (!valor || typeof valor !== "object") return null;
  const r = normalizarAutor(valor as Record<string, unknown>);
  return "autor" in r ? r.autor : null;
}

const UM_DIA = 24 * 60 * 60 * 1000;

/**
 * Datas para mostrar no artigo. "Atualizado" só quando a mudança veio pelo
 * menos um dia depois da publicação: salvar uma vírgula na hora de publicar
 * não é atualização, e anunciar como se fosse ensina o leitor a ignorar.
 */
export function datasDoArtigo(
  publicado: string | null,
  atualizado: string | null,
): { publicado: string | null; atualizado: string | null } {
  if (!publicado) return { publicado: null, atualizado: null };
  const p = new Date(publicado).getTime();
  const a = atualizado ? new Date(atualizado).getTime() : NaN;
  return {
    publicado,
    atualizado: Number.isFinite(a) && a - p >= UM_DIA ? atualizado : null,
  };
}
