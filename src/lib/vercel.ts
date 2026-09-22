// Liberar o domínio do cliente sozinho, pela API da Vercel.
//
// Antes: o cliente criava o CNAME e alguém da agência tinha que entrar na
// Vercel e adicionar o domínio no projeto. Quem esquecia esse passo via
// "sem certificado" e "endereço não responde", sem nenhuma pista - foi o
// que aconteceu com blog.dataknow.es. Agora o painel faz o passo.
//
// Sem VERCEL_TOKEN (ambiente local, por exemplo), tudo isto fica desligado
// e a checagem antiga por DNS continua valendo.

const API = "https://api.vercel.com";

export type RegistroDns = { tipo: string; nome: string; valor: string };

export type EstadoDoDominio =
  /** Sem token: o app não fala com a Vercel. */
  | { estado: "desligado" }
  /** Liberado aqui e apontado para cá: só falta o blog responder. */
  | { estado: "pronto" }
  /** Liberado aqui, esperando o DNS do cliente. */
  | { estado: "esperando-dns"; registros: RegistroDns[] }
  /** O domínio está preso em outro projeto ou em outra conta da Vercel. */
  | { estado: "ocupado"; mensagem: string }
  | { estado: "erro"; mensagem: string };

const token = () => process.env.VERCEL_TOKEN;
const projeto = () => process.env.VERCEL_PROJECT_ID;
const equipe = () => process.env.VERCEL_TEAM_ID;

export function vercelConfigurado(): boolean {
  return Boolean(token() && projeto());
}

function url(caminho: string): string {
  const t = equipe();
  return `${API}${caminho}${t ? `${caminho.includes("?") ? "&" : "?"}teamId=${t}` : ""}`;
}

async function chamar(
  caminho: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; corpo: Record<string, unknown> }> {
  const res = await fetch(url(caminho), {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(10_000),
  });
  const corpo = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, corpo };
}

const erroDaApi = (corpo: Record<string, unknown>): string => {
  const e = corpo.error as { message?: string; code?: string } | undefined;
  return e?.message || e?.code || "a Vercel recusou o pedido";
};

/** Registros que faltam no DNS do cliente, como a Vercel os descreve. */
export function registrosPendentes(
  dominio: string,
  domainInfo: Record<string, unknown>,
  config: Record<string, unknown>,
): RegistroDns[] {
  // Desafio de posse (domínio já usado em outra conta): a Vercel devolve o
  // TXT exato a criar. Vem antes de tudo - sem ele nada mais adianta.
  const verificacao = (domainInfo.verification as
    | { type?: string; domain?: string; value?: string }[]
    | undefined) ?? [];
  if (verificacao.length) {
    return verificacao.map((v) => ({
      tipo: (v.type || "TXT").toUpperCase(),
      nome: v.domain || dominio,
      valor: v.value || "",
    }));
  }

  // Apontamento normal. `recommendedCNAME` é o destino novo por domínio; o
  // fixo de sempre continua valendo, e é o que usamos quando ela não
  // recomenda nada.
  // Vem como [{rank, value}] ordenado, e com ponto no fim ("...com.") -
  // painel de DNS nenhum quer o ponto.
  const recomendado = config.recommendedCNAME;
  const primeiro = Array.isArray(recomendado) ? recomendado[0] : recomendado;
  const bruto =
    typeof primeiro === "string"
      ? primeiro
      : (primeiro as { value?: string } | undefined)?.value;
  const valor = (bruto || "cname.vercel-dns.com").replace(/\.$/, "");
  return [{ tipo: "CNAME", nome: dominio.split(".")[0], valor }];
}

/**
 * Adiciona o domínio ao projeto (se ainda não estiver) e devolve o que
 * falta. Domínio já adicionado não é erro: é o caminho normal de quem
 * salva o mesmo endereço duas vezes.
 */
export async function liberarDominio(dominio: string): Promise<EstadoDoDominio> {
  if (!vercelConfigurado()) return { estado: "desligado" };
  try {
    const add = await chamar(`/v10/projects/${projeto()}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: dominio }),
    });
    const codigo = (add.corpo.error as { code?: string } | undefined)?.code;
    if (!add.ok && codigo !== "domain_already_in_use_by_this_project") {
      // Preso em outro projeto/conta: ninguém resolve isso pelo painel.
      if (add.status === 409 || codigo === "domain_already_in_use") {
        return { estado: "ocupado", mensagem: erroDaApi(add.corpo) };
      }
      return { estado: "erro", mensagem: erroDaApi(add.corpo) };
    }
    return await estadoDoDominio(dominio);
  } catch {
    return { estado: "erro", mensagem: "não consegui falar com a Vercel agora" };
  }
}

/** Como a Vercel vê o domínio agora. */
export async function estadoDoDominio(dominio: string): Promise<EstadoDoDominio> {
  if (!vercelConfigurado()) return { estado: "desligado" };
  try {
    const info = await chamar(`/v9/projects/${projeto()}/domains/${dominio}`);
    if (!info.ok) {
      return info.status === 404
        ? { estado: "erro", mensagem: "o domínio ainda não está liberado no projeto" }
        : { estado: "erro", mensagem: erroDaApi(info.corpo) };
    }
    const config = await chamar(`/v6/domains/${dominio}/config`);
    const apontado = config.ok && config.corpo.misconfigured === false;
    if (info.corpo.verified === true && apontado) return { estado: "pronto" };

    return {
      estado: "esperando-dns",
      registros: registrosPendentes(dominio, info.corpo, config.corpo),
    };
  } catch {
    return { estado: "erro", mensagem: "não consegui falar com a Vercel agora" };
  }
}
