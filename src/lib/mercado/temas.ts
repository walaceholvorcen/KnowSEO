// Análise de mercado por cobertura de conteúdo.
//
// A pergunta que este módulo responde é: "sobre o que o mercado escreve, e
// onde o cliente não está?". Ela é respondida com o que dá para medir sem
// comprar dado: os títulos que cada concorrente publicou, lidos do sitemap
// público deles.
//
// O QUE ISTO NÃO É, e a distinção importa muito neste produto: isto não é
// volume de busca. Não sabemos quantas pessoas procuram por um tema; sabemos
// quantos artigos os concorrentes acharam que valia a pena publicar sobre
// ele. É um sinal de demanda por procuração - bom o suficiente para decidir
// pauta, e honesto o suficiente para mostrar ao cliente sem inventar número.
// Toda a interface tem que falar em "artigos publicados", nunca em "buscas".
//
// Nada aqui usa IA: mesma escolha da auditoria e da detecção de citação. Se
// a decisão pode ser cálculo, ela é cálculo - assim o resultado é o mesmo
// toda vez que roda e pode ser testado.

// Português e espanhol juntos: o produto atende os dois idiomas e a mistura
// não atrapalha (nenhuma palavra vazia de um é palavra cheia do outro).
const VAZIAS = new Set([
  // pt
  "a", "as", "o", "os", "um", "uma", "uns", "umas", "de", "do", "da", "dos",
  "das", "em", "no", "na", "nos", "nas", "por", "para", "com", "sem", "sob",
  "sobre", "entre", "ate", "e", "ou", "mas", "que", "se", "como", "quando",
  "onde", "qual", "quais", "quanto", "quantos", "quem", "porque", "pois",
  "seu", "sua", "seus", "suas", "meu", "minha", "este", "esta", "esse",
  "essa", "aquele", "aquela", "isso", "ao", "aos", "pelo", "pela", "ser",
  "ter", "fazer", "mais", "menos", "muito", "pouco", "tudo", "nada", "ja",
  "nao", "sim", "voce", "voces", "melhor", "melhores", "guia", "completo",
  "dicas", "tudo",
  // es
  "el", "la", "los", "las", "un", "una", "unos", "unas", "del", "al", "en",
  "con", "sin", "sobre", "entre", "hasta", "y", "o", "pero", "que", "si",
  "como", "cuando", "donde", "cual", "cuales", "cuanto", "quien", "porque",
  "su", "sus", "mi", "este", "esta", "ese", "esa", "aquel", "eso", "por",
  "para", "ser", "hacer", "mas", "menos", "mucho", "poco", "todo", "nada",
  "ya", "no", "si", "usted", "ustedes", "mejor", "mejores", "guia",
  "completa", "consejos",
]);

export interface PaginaCrawleada {
  dominio: string;
  titulo: string | null;
}

export type Situacao = "lacuna" | "disputado" | "seu_terreno";

export interface Tema {
  termo: string;
  paginasCliente: number;
  paginasConcorrentes: number;
  /** Quantos domínios concorrentes distintos cobrem o tema. Cobertura larga
   *  é sinal mais forte que muitos artigos de um só concorrente. */
  concorrentesQueCobrem: number;
  lacuna: number;
  situacao: Situacao;
  /** Títulos reais de concorrentes. A tela mostra isto porque um tema sem
   *  prova vira palpite - o cliente precisa ver o artigo que existe. */
  exemplos: string[];
}

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Quase todo site repete uma assinatura no fim do <title> ("Artigo | Marca").
// Sem remover isso, o tema mais forte de todo concorrente é o próprio nome
// dele - análise inútil.
//
// A remoção é por PALAVRA da cauda, não pela cauda inteira. Medido em site
// real: o mesmo concorrente assina "| Ranking comparado", "| Ranking
// actualizado", "| Ranking 2026" - caudas diferentes, mesma assinatura. A
// regra de cauda inteira deixava passar, e "ranking comparado" subia como se
// fosse tema de mercado. Contando palavra a palavra, "ranking" se revela
// repetida e cai; o que sobra da cauda é conteúdo de verdade.
const LIMIAR_BOILERPLATE = 0.3;

export function removerBoilerplate(titulos: string[]): string[] {
  const separador = /\s+[|–—·•]\s+|\s+-\s+/;

  const caudaDe = (titulo: string): string | null => {
    const partes = titulo.split(separador);
    return partes.length < 2 ? null : partes[partes.length - 1];
  };

  const comCauda = titulos.filter((t) => caudaDe(t) !== null);
  const frequencia = new Map<string, number>();

  for (const titulo of comCauda) {
    const palavras = new Set(normalizar(caudaDe(titulo)!).split(" "));
    for (const palavra of palavras) {
      if (!palavra) continue;
      frequencia.set(palavra, (frequencia.get(palavra) ?? 0) + 1);
    }
  }

  const minimo = Math.max(2, Math.ceil(comCauda.length * LIMIAR_BOILERPLATE));
  const assinatura = new Set(
    [...frequencia.entries()].filter(([, n]) => n >= minimo).map(([p]) => p),
  );

  return titulos.map((titulo) => {
    const cauda = caudaDe(titulo);
    if (cauda === null) return titulo;

    const palavras = cauda.split(/\s+/);
    const restante = palavras.filter(
      (palavra) => !assinatura.has(normalizar(palavra)),
    );

    // Nada de assinatura nesta cauda: devolve o título como veio, para que
    // a função só mexa no que precisa mexer.
    if (restante.length === palavras.length) return titulo;

    const cabeca = titulo.split(separador).slice(0, -1).join(" ");
    return restante.length ? `${cabeca} ${restante.join(" ")}` : cabeca;
  });
}

// Pares de palavras cheias e vizinhas. Bigrama em vez de palavra solta
// porque "google ads" e "marketing digital" são temas; "google" e "digital"
// sozinhos são ruído que casa com qualquer coisa.
export function bigramas(titulo: string): string[] {
  const palavras = normalizar(titulo)
    .split(" ")
    .filter((p) => p.length > 2 && !VAZIAS.has(p) && !/^\d+$/.test(p));

  const pares: string[] = [];
  for (let i = 0; i < palavras.length - 1; i++) {
    pares.push(`${palavras[i]} ${palavras[i + 1]}`);
  }
  // Uma página conta uma vez por tema, mesmo repetindo o par no título.
  return [...new Set(pares)];
}

const MIN_PAGINAS = 2;
const MAX_TEMAS = 14;

export function analisarMercado(params: {
  cliente: PaginaCrawleada[];
  concorrentes: PaginaCrawleada[];
}): Tema[] {
  const { cliente, concorrentes } = params;

  // Boilerplate é por domínio: cada site repete a sua própria assinatura.
  const porDominio = new Map<string, string[]>();
  for (const pagina of [...cliente, ...concorrentes]) {
    if (!pagina.titulo) continue;
    const lista = porDominio.get(pagina.dominio) ?? [];
    lista.push(pagina.titulo);
    porDominio.set(pagina.dominio, lista);
  }

  const limpos = new Map<string, string[]>();
  for (const [dominio, titulos] of porDominio) {
    limpos.set(dominio, removerBoilerplate(titulos));
  }

  const dominiosCliente = new Set(cliente.map((p) => p.dominio));

  const contagem = new Map<
    string,
    {
      cliente: number;
      concorrentes: number;
      dominios: Set<string>;
      exemplos: string[];
    }
  >();

  for (const [dominio, titulos] of limpos) {
    const ehCliente = dominiosCliente.has(dominio);

    for (const titulo of titulos) {
      for (const termo of bigramas(titulo)) {
        const atual = contagem.get(termo) ?? {
          cliente: 0,
          concorrentes: 0,
          dominios: new Set<string>(),
          exemplos: [],
        };

        if (ehCliente) {
          atual.cliente++;
        } else {
          atual.concorrentes++;
          atual.dominios.add(dominio);
          if (atual.exemplos.length < 3) atual.exemplos.push(titulo.trim());
        }

        contagem.set(termo, atual);
      }
    }
  }

  const temas: Tema[] = [];
  for (const [termo, dados] of contagem) {
    const total = dados.cliente + dados.concorrentes;
    if (total < MIN_PAGINAS) continue;
    // Tema que só o cliente tem não diz nada sobre o mercado - e é aqui que
    // entraria "ninguém cobre isso, é um oceano azul". Não entra: cobertura
    // zero num crawl de concorrente não prova demanda nenhuma.
    if (dados.concorrentes === 0) continue;

    const lacuna = dados.concorrentes - dados.cliente;

    temas.push({
      termo,
      paginasCliente: dados.cliente,
      paginasConcorrentes: dados.concorrentes,
      concorrentesQueCobrem: dados.dominios.size,
      lacuna,
      situacao:
        dados.cliente === 0
          ? "lacuna"
          : lacuna > 0
            ? "disputado"
            : "seu_terreno",
      exemplos: dados.exemplos,
    });
  }

  // Ordena por LARGURA antes de volume, e a razão veio de dado real: um
  // concorrente sozinho tinha 22 páginas com "agências SEO" - páginas de
  // serviço dele, não conteúdo de mercado - e isso ficava em primeiro lugar.
  // Um tema que três concorrentes diferentes acharam que valia a pena cobrir
  // é evidência de demanda; um tema que só um cobre é o posicionamento dele.
  return temas
    .sort(
      (a, b) =>
        b.concorrentesQueCobrem - a.concorrentesQueCobrem ||
        b.lacuna - a.lacuna ||
        b.paginasConcorrentes - a.paginasConcorrentes ||
        a.termo.localeCompare(b.termo),
    )
    .slice(0, MAX_TEMAS);
}

// ---------------------------------------------------------------------------
// Camada de dado real do Google (só existe com o Search Console conectado)
// ---------------------------------------------------------------------------

export interface LinhaBusca {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

export type TipoDeChance = "pagina_dois" | "sem_clique";

export interface Chance {
  query: string;
  tipo: TipoDeChance;
  impressoes: number;
  cliques: number;
  posicao: number;
}

const MIN_IMPRESSOES_PAGINA_DOIS = 10;
const MIN_IMPRESSOES_SEM_CLIQUE = 30;
const CTR_BAIXO = 0.01;

// Duas situações em que o Google já mostrou que existe demanda e o cliente
// já está no páreo - as duas de leitura direta, sem modelo no meio:
//
//   pagina_dois: aparece entre a 11ª e a 20ª posição. Tem demanda, tem
//                relevância reconhecida, e ninguém clica porque ninguém
//                chega na página 2. Um artigo dedicado costuma subir.
//   sem_clique:  já está na primeira página e mesmo assim não recebe
//                clique. Aqui o problema não é conteúdo, é o título e a
//                descrição que aparecem no resultado.
export function acharChances(linhas: LinhaBusca[]): Chance[] {
  const chances: Chance[] = [];

  for (const linha of linhas) {
    const ctr =
      linha.impressions > 0 ? linha.clicks / linha.impressions : 0;

    if (
      linha.position > 10 &&
      linha.position <= 20 &&
      linha.impressions >= MIN_IMPRESSOES_PAGINA_DOIS
    ) {
      chances.push({
        query: linha.query,
        tipo: "pagina_dois",
        impressoes: linha.impressions,
        cliques: linha.clicks,
        posicao: linha.position,
      });
      continue;
    }

    if (
      linha.position <= 10 &&
      linha.impressions >= MIN_IMPRESSOES_SEM_CLIQUE &&
      ctr < CTR_BAIXO
    ) {
      chances.push({
        query: linha.query,
        tipo: "sem_clique",
        impressoes: linha.impressions,
        cliques: linha.clicks,
        posicao: linha.position,
      });
    }
  }

  return chances.sort((a, b) => b.impressoes - a.impressoes);
}
