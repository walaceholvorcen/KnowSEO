import type { Finding, PageSnapshot, SiteSignals, Severity } from "./types";
import { nomeComparavel } from "./entidade.ts";

// Regras de auditoria. Função pura: recebe sinais, devolve achados.
// Nenhuma regra chama rede - é o que permite testar cada uma com um caso
// fixo e garantir que não geramos achado falso (que custa cliente).

const TITLE_MIN = 30;
const TITLE_MAX = 60;
const META_MIN = 70;
const META_MAX = 160;
const THIN_CONTENT_WORDS = 300;
const MIN_INTERNAL_LINKS = 3;
const MAX_URLS_LISTED = 12;

function scope(pages: PageSnapshot[]) {
  return {
    affectedUrls: pages.slice(0, MAX_URLS_LISTED).map((p) => p.url),
    affectedCount: pages.length,
  };
}

function duplicatesBy(
  pages: PageSnapshot[],
  key: (p: PageSnapshot) => string | null,
): Map<string, PageSnapshot[]> {
  const groups = new Map<string, PageSnapshot[]>();
  for (const page of pages) {
    const value = key(page);
    if (!value) continue;
    const normalized = value.trim().toLowerCase();
    groups.set(normalized, [...(groups.get(normalized) ?? []), page]);
  }
  return new Map([...groups].filter(([, group]) => group.length > 1));
}

// O robots.txt agrupa diretivas por User-agent, e a regra antiga ignorava o
// agrupamento: procurava "Disallow: /" em qualquer lugar do arquivo.
//
// Isso produzia um falso positivo caro num cenário que hoje é comum. Um site
// que bloqueia rastreador de IA...
//
//   User-agent: GPTBot
//   Disallow: /
//
// ...era acusado de "bloquear o site inteiro", severidade crítica, e perdia
// 30 pontos. Site perfeitamente saudável caía de 100 para 70.
//
// Aqui só interessa quem rastreia para a busca: se existe um grupo do
// Googlebot ele manda, senão vale o grupo do curinga. Grupos de outros
// agentes não dizem nada sobre a indexação no Google.
export function robotsBloqueiaTudo(body: string): boolean {
  const grupos: { agentes: string[]; bloqueia: boolean }[] = [];
  let atual: { agentes: string[]; bloqueia: boolean } | null = null;
  let ultimaFoiAgente = false;

  for (const bruta of body.split(/\r?\n/)) {
    const linha = bruta.replace(/#.*/, "").trim();
    if (!linha) continue;

    const separador = linha.indexOf(":");
    if (separador === -1) continue;

    const campo = linha.slice(0, separador).trim().toLowerCase();
    const valor = linha.slice(separador + 1).trim();

    if (campo === "user-agent") {
      // User-agents seguidos compartilham o mesmo bloco de regras.
      if (!ultimaFoiAgente) {
        atual = { agentes: [], bloqueia: false };
        grupos.push(atual);
      }
      atual?.agentes.push(valor.toLowerCase());
      ultimaFoiAgente = true;
      continue;
    }

    ultimaFoiAgente = false;
    if (campo === "disallow" && valor === "/" && atual) {
      atual.bloqueia = true;
    }
  }

  const doGoogle = grupos.filter((g) => g.agentes.includes("googlebot"));
  if (doGoogle.length) return doGoogle.some((g) => g.bloqueia);

  return grupos.filter((g) => g.agentes.includes("*")).some((g) => g.bloqueia);
}

export function runRules(signals: SiteSignals): Finding[] {
  const findings: Finding[] = [];
  const { pages } = signals;
  const add = (f: Finding) => findings.push(f);

  // ---------------------------------------------------------------- técnico
  if (!signals.isHttps) {
    add({
      code: "NO_HTTPS",
      severity: "critical",
      category: "technical",
      title: "O site não usa HTTPS",
      impact:
        "O Google trata HTTPS como fator de ranqueamento e navegadores marcam o site como não seguro, derrubando a confiança do visitante.",
      evidence: `A URL analisada responde em ${signals.origin}`,
      fix: "Instale um certificado SSL e redirecione todo o tráfego HTTP para HTTPS com 301.",
      affectedUrls: [signals.origin],
      affectedCount: 1,
    });
  }

  // ----------------------------------------------------------- rastreamento
  if (!signals.robotsTxt.found) {
    add({
      code: "ROBOTS_MISSING",
      severity: "medium",
      category: "crawlability",
      title: "Não existe robots.txt",
      impact:
        "Sem robots.txt o Google rastreia às cegas e você perde o controle sobre o que deve ou não ser visitado.",
      evidence: `${signals.origin}/robots.txt não respondeu com sucesso`,
      fix: "Crie um robots.txt liberando o site e apontando para o sitemap.",
      affectedUrls: [`${signals.origin}/robots.txt`],
      affectedCount: 1,
    });
  } else {
    const body = signals.robotsTxt.body ?? "";
    if (robotsBloqueiaTudo(body)) {
      add({
        code: "ROBOTS_BLOCKS_ALL",
        severity: "critical",
        category: "crawlability",
        title: "O robots.txt está bloqueando o site inteiro",
        impact:
          "Nenhuma página pode ser rastreada. O site não aparece na busca, por melhor que seja o conteúdo.",
        evidence: "Foi encontrada a diretiva 'Disallow: /' no robots.txt",
        fix: "Remova o 'Disallow: /'. Bloqueie apenas caminhos específicos que realmente não devem ser indexados.",
        affectedUrls: [`${signals.origin}/robots.txt`],
      affectedCount: 1,
      });
    }
    if (!/sitemap:/i.test(body)) {
      add({
        code: "ROBOTS_NO_SITEMAP",
        severity: "quick_win",
        category: "crawlability",
        title: "O robots.txt não aponta para o sitemap",
        impact:
          "O Google demora mais para descobrir páginas novas, atrasando a indexação.",
        evidence: "Não há linha 'Sitemap:' no robots.txt",
        fix: `Adicione a linha: Sitemap: ${signals.origin}/sitemap.xml`,
        affectedUrls: [`${signals.origin}/robots.txt`],
      affectedCount: 1,
      });
    }
  }

  // --------------------------------------------------- URLs que não entregam
  //
  // Categoria que simplesmente não existia: o crawler descartava tudo que
  // não fosse 2xx, então 404, 500 e cadeia de redirecionamento eram
  // invisíveis para a auditoria. Pior, as páginas quebradas sumiam da
  // amostra e a nota MELHORAVA conforme o site piorava.
  const quebradas = signals.urlsQuebradas ?? [];
  if (quebradas.length > 0) {
    const semResposta = quebradas.filter((u) => u.status === null);
    const comErro = quebradas.filter((u) => u.status !== null);
    const servidor = comErro.filter((u) => (u.status ?? 0) >= 500);

    add({
      code: "URLS_QUEBRADAS",
      severity: servidor.length > 0 ? "critical" : "high",
      category: "crawlability",
      title: `${quebradas.length} ${quebradas.length === 1 ? "endereço anunciado não responde" : "endereços anunciados não respondem"}`,
      impact:
        servidor.length > 0
          ? "Erro de servidor faz o Google reduzir o ritmo de rastreamento do site inteiro, não só das páginas com erro. E quem chega pelo link encontra uma página morta."
          : "O site anuncia estes endereços no sitemap e não os entrega. O Google gasta rastreamento em página que não existe, e o visitante que chega pelo link bate numa porta fechada.",
      // Evidência com o dado medido, não a definição da regra: o cliente
      // manda esta lista direto para quem cuida do site.
      evidence: [
        ...comErro
          .slice(0, 10)
          .map((u) => `${u.url} devolveu HTTP ${u.status}`),
        ...semResposta
          .slice(0, 5)
          .map((u) => `${u.url} não respondeu (tempo esgotado ou DNS)`),
      ].join(" · "),
      fix: "Corrija o endereço, publique a página que falta ou redirecione para o destino certo — e tire do sitemap o que não deve mais existir.",
      affectedUrls: quebradas.map((u) => u.url),
      affectedCount: quebradas.length,
    });
  }

  const redirecionadas = signals.urlsRedirecionadas ?? [];
  if (redirecionadas.length > 0) {
    add({
      code: "URLS_REDIRECIONADAS",
      severity: "medium",
      category: "crawlability",
      title: `${redirecionadas.length} ${redirecionadas.length === 1 ? "endereço anunciado redireciona" : "endereços anunciados redirecionam"}`,
      impact:
        "Cada salto gasta orçamento de rastreamento e dilui a força do link. O sitemap deve listar o endereço final, não o antigo.",
      evidence: redirecionadas
        .slice(0, 10)
        .map((u) => `${u.url} → ${u.destino}`)
        .join(" · "),
      fix: "Troque no sitemap (e nos links internos) o endereço antigo pelo destino final.",
      affectedUrls: redirecionadas.map((u) => u.url),
      affectedCount: redirecionadas.length,
    });
  }

  if (!signals.sitemapFound) {
    add({
      code: "SITEMAP_MISSING",
      severity: "high",
      category: "crawlability",
      title: "Não foi encontrado sitemap XML",
      impact:
        "Sem sitemap o Google descobre páginas apenas seguindo links. Conteúdo novo pode levar semanas a mais para ser indexado.",
      evidence: "Nenhum sitemap encontrado no robots.txt nem nos caminhos convencionais",
      fix: "Publique um sitemap.xml com todas as páginas canônicas e envie no Search Console.",
      affectedUrls: [signals.origin],
      affectedCount: 1,
    });
  }

  // ------------------------------------------------------------- indexação
  const noindexPages = pages.filter((p) => /noindex/i.test(p.robotsMeta ?? ""));
  if (noindexPages.length) {
    add({
      code: "NOINDEX_ON_PAGES",
      severity: "critical",
      category: "indexation",
      title: `${noindexPages.length} página(s) com noindex`,
      impact:
        "Essas páginas estão proibidas de aparecer na busca. Se alguma delas for importante, é perda direta de tráfego.",
      evidence: "Foi encontrada a meta tag robots com 'noindex'",
      fix: "Remova o noindex das páginas que devem ranquear. Mantenha apenas onde faz sentido (áreas internas, filtros).",
      ...scope(noindexPages),
    });
  }

  const noCanonical = pages.filter((p) => !p.canonical);
  if (noCanonical.length) {
    add({
      code: "CANONICAL_MISSING",
      severity: "medium",
      category: "indexation",
      title: `${noCanonical.length} página(s) sem URL canônica`,
      impact:
        "Sem canônica, variações da mesma URL (com barra, com parâmetro, com www) competem entre si e diluem a força da página.",
      evidence: "Nenhuma tag <link rel=\"canonical\"> encontrada",
      fix: "Adicione uma canônica auto-referente em cada página.",
      ...scope(noCanonical),
    });
  }

  // --------------------------------------------------------------- on-page
  const noTitle = pages.filter((p) => !p.title);
  if (noTitle.length) {
    add({
      code: "TITLE_MISSING",
      severity: "high",
      category: "onpage",
      title: `${noTitle.length} página(s) sem título`,
      impact:
        "O título é o elemento de on-page com maior peso e é o que a pessoa lê no resultado da busca.",
      evidence: "A tag <title> está ausente ou vazia",
      fix: "Escreva um título único de 30-60 caracteres, com a palavra-chave principal no começo.",
      ...scope(noTitle),
    });
  }

  const longTitle = pages.filter((p) => p.title && p.title.length > TITLE_MAX);
  if (longTitle.length) {
    add({
      code: "TITLE_TOO_LONG",
      severity: "quick_win",
      category: "onpage",
      title: `${longTitle.length} título(s) longos demais`,
      impact:
        "O Google corta o título no resultado, escondendo justamente o final da mensagem.",
      evidence: `Títulos com mais de ${TITLE_MAX} caracteres`,
      fix: `Reduza para até ${TITLE_MAX} caracteres mantendo a palavra-chave no início.`,
      ...scope(longTitle),
    });
  }

  const shortTitle = pages.filter(
    (p) => p.title && p.title.length > 0 && p.title.length < TITLE_MIN,
  );
  if (shortTitle.length) {
    add({
      code: "TITLE_TOO_SHORT",
      severity: "quick_win",
      category: "onpage",
      title: `${shortTitle.length} título(s) curtos demais`,
      impact:
        "Título curto desperdiça espaço no resultado da busca e costuma deixar de fora termos que trariam cliques.",
      evidence: `Títulos com menos de ${TITLE_MIN} caracteres`,
      fix: "Aproveite o espaço: descreva o benefício e inclua um termo secundário.",
      ...scope(shortTitle),
    });
  }

  const dupTitles = duplicatesBy(pages, (p) => p.title);
  if (dupTitles.size) {
    const affected = [...dupTitles.values()].flat();
    add({
      code: "TITLE_DUPLICATE",
      severity: "high",
      category: "onpage",
      title: `${dupTitles.size} título(s) repetidos em páginas diferentes`,
      impact:
        "Páginas com o mesmo título competem entre si pela mesma busca e o Google escolhe uma - às vezes a errada.",
      evidence: [...dupTitles.keys()]
        .slice(0, 3)
        .map((t) => `"${t}"`)
        .join(", "),
      fix: "Dê a cada página um título único que reflita a intenção de busca específica dela.",
      ...scope(affected),
    });
  }

  const noMeta = pages.filter((p) => !p.metaDescription);
  if (noMeta.length) {
    add({
      code: "META_MISSING",
      severity: "medium",
      category: "onpage",
      title: `${noMeta.length} página(s) sem meta description`,
      impact:
        "Sem descrição o Google monta um trecho automático, geralmente sem apelo - e a taxa de clique cai.",
      evidence: "A meta description está ausente",
      fix: `Escreva uma descrição de ${META_MIN}-${META_MAX} caracteres com proposta de valor e chamada para ação.`,
      ...scope(noMeta),
    });
  }

  const longMeta = pages.filter(
    (p) => p.metaDescription && p.metaDescription.length > META_MAX,
  );
  if (longMeta.length) {
    add({
      code: "META_TOO_LONG",
      severity: "quick_win",
      category: "onpage",
      title: `${longMeta.length} meta description(s) longas demais`,
      impact: "O texto é cortado no resultado da busca.",
      evidence: `Descrições com mais de ${META_MAX} caracteres`,
      fix: `Reduza para até ${META_MAX} caracteres.`,
      ...scope(longMeta),
    });
  }

  const dupMeta = duplicatesBy(pages, (p) => p.metaDescription);
  if (dupMeta.size) {
    add({
      code: "META_DUPLICATE",
      severity: "medium",
      category: "onpage",
      title: `${dupMeta.size} meta description(s) repetidas`,
      impact:
        "Descrição repetida sinaliza páginas parecidas e reduz a chance de o Google mostrar a sua descrição.",
      evidence: "Mesma descrição em páginas diferentes",
      fix: "Escreva uma descrição própria para cada página.",
      ...scope([...dupMeta.values()].flat()),
    });
  }

  const noH1 = pages.filter((p) => p.h1s.length === 0);
  if (noH1.length) {
    add({
      code: "H1_MISSING",
      severity: "high",
      category: "onpage",
      title: `${noH1.length} página(s) sem H1`,
      impact:
        "O H1 diz ao Google e ao leitor do que a página trata. Sem ele a página fica sem tema declarado.",
      evidence: "Nenhuma tag <h1> encontrada",
      fix: "Adicione um único H1 por página, contendo a palavra-chave principal.",
      ...scope(noH1),
    });
  }

  const multiH1 = pages.filter((p) => p.h1s.length > 1);
  if (multiH1.length) {
    add({
      code: "H1_MULTIPLE",
      severity: "medium",
      category: "onpage",
      title: `${multiH1.length} página(s) com mais de um H1`,
      impact:
        "Vários H1 diluem o tema da página e costumam indicar que a tag está sendo usada só para estilo.",
      evidence: "Mais de uma tag <h1> na mesma página",
      fix: "Deixe um único H1 e transforme os demais em H2.",
      ...scope(multiH1),
    });
  }

  const noAlt = pages.filter((p) => p.imagesWithoutAlt > 0);
  if (noAlt.length) {
    const total = noAlt.reduce((sum, p) => sum + p.imagesWithoutAlt, 0);
    add({
      code: "IMAGES_NO_ALT",
      severity: "quick_win",
      category: "onpage",
      title: `${total} imagem(ns) sem texto alternativo`,
      impact:
        "Sem alt o Google não entende a imagem, você perde tráfego da busca por imagens e o site fica inacessível para leitores de tela.",
      evidence: `${noAlt.length} página(s) com imagens sem atributo alt`,
      fix: "Descreva a imagem em poucas palavras no atributo alt. Imagens decorativas podem usar alt vazio.",
      ...scope(noAlt),
    });
  }

  // -------------------------------------------------------------- conteúdo
  const thin = pages.filter(
    (p) => p.wordCount > 0 && p.wordCount < THIN_CONTENT_WORDS,
  );
  if (thin.length) {
    add({
      code: "THIN_CONTENT",
      severity: "high",
      category: "content",
      title: `${thin.length} página(s) com pouco conteúdo`,
      impact:
        "Página rasa raramente ranqueia. Pior: o sistema de conteúdo útil do Google avalia o site inteiro, então muitas páginas fracas puxam para baixo até as boas.",
      evidence: `Páginas com menos de ${THIN_CONTENT_WORDS} palavras`,
      fix: "Aprofunde a página respondendo as dúvidas seguintes do leitor, ou remova/una páginas que não têm razão de existir.",
      ...scope(thin),
    });
  }

  const poorlyLinked = pages.filter(
    (p) => p.internalLinks < MIN_INTERNAL_LINKS,
  );
  if (poorlyLinked.length) {
    add({
      code: "LOW_INTERNAL_LINKS",
      severity: "medium",
      category: "content",
      title: `${poorlyLinked.length} página(s) com pouca linkagem interna`,
      impact:
        "Página pouco linkada recebe menos autoridade e é rastreada com menos frequência.",
      evidence: `Menos de ${MIN_INTERNAL_LINKS} links internos na página`,
      fix: "Linke essas páginas a partir de conteúdos relacionados, usando texto âncora descritivo.",
      ...scope(poorlyLinked),
    });
  }

  // ------------------------------------------------------------------- GEO
  if (!signals.llmsTxtFound) {
    add({
      code: "NO_LLMS_TXT",
      severity: "high",
      category: "geo",
      title: "O site não tem llms.txt",
      impact:
        "É o índice que explica seu negócio para ChatGPT, Claude e Perplexity. Sem ele, a IA precisa adivinhar o que você faz - e costuma citar o concorrente que deixou isso explícito.",
      evidence: `${signals.origin}/llms.txt não encontrado`,
      fix: "Publique um llms.txt em markdown com o que a empresa faz, para quem, e links para as páginas principais.",
      affectedUrls: [`${signals.origin}/llms.txt`],
      affectedCount: 1,
    });
  }

  const withSchema = pages.filter((p) => p.jsonLdTypes.length > 0);
  const withoutSchema = pages.filter((p) => p.jsonLdTypes.length === 0);
  if (withoutSchema.length) {
    // Honestidade explícita: fetch não enxerga JSON-LD injetado via
    // JavaScript. Reportar ausência como certeza geraria achado falso.
    const maybeJsInjected =
      withSchema.length === 0 && withoutSchema.some((p) => p.hasJsScripts);

    add({
      code: "NO_SCHEMA",
      severity: maybeJsInjected ? "medium" : "high",
      category: "geo",
      title: `${withoutSchema.length} página(s) sem dado estruturado detectado`,
      impact:
        "Sem schema o Google não gera resultados enriquecidos e a IA não tem um resumo inequívoco de quem você é e o que oferece.",
      evidence: maybeJsInjected
        ? "Nenhum JSON-LD no HTML inicial. Atenção: o site usa JavaScript e muitos plugins injetam schema depois do carregamento - confirme no Rich Results Test do Google antes de tratar como erro."
        : "Nenhum bloco <script type=\"application/ld+json\"> encontrado no HTML",
      fix: "Adicione JSON-LD adequado ao tipo de página (Organization, LocalBusiness, Article, Product, FAQPage).",
      ...scope(withoutSchema),
    });
  }

  const invalidSchema = pages.filter((p) =>
    p.jsonLdTypes.includes("__invalid__"),
  );
  if (invalidSchema.length) {
    add({
      code: "SCHEMA_INVALID",
      severity: "high",
      category: "geo",
      title: `${invalidSchema.length} página(s) com dado estruturado inválido`,
      impact:
        "JSON-LD malformado é ignorado por completo - o esforço de ter schema não gera nenhum retorno.",
      evidence: "O bloco JSON-LD não pôde ser interpretado",
      fix: "Valide no Rich Results Test do Google e corrija a sintaxe.",
      ...scope(invalidSchema),
    });
  }

  // -------------------------------------------------------------- entidade
  // O site diz à máquina QUEM é a empresa? Ver src/lib/audit/entidade.ts.
  // Achados de site inteiro: a identidade da empresa é uma só, então não
  // faz sentido diluir pelo número de páginas.
  const entidades = pages.flatMap((p) => p.entidades);
  const paginasComEntidade = pages.filter((p) => p.entidades.length > 0);

  if (pages.length && !entidades.length) {
    // Site sem schema nenhum já leva NO_SCHEMA por página. Aqui a notícia é
    // outra (a empresa não se apresenta), mas cobrar cheio nos dois achados
    // puniria duas vezes a mesma ausência.
    const semSchemaNenhum = withSchema.length === 0;
    add({
      code: "SEM_ENTIDADE",
      severity: semSchemaNenhum ? "medium" : "high",
      category: "geo",
      title: "O site não diz à máquina quem é a empresa",
      impact:
        "Google e assistentes de IA citam quem eles reconhecem: um nome ligado a uma categoria, a um lugar e aos seus perfis. Sem a ficha da organização em dado estruturado, a IA precisa deduzir isso da prosa - e costuma citar quem deixou explícito.",
      evidence: semSchemaNenhum
        ? "Nenhum bloco Organization ou LocalBusiness - e nenhum dado estruturado no site"
        : `O site tem dado estruturado (${[...new Set(pages.flatMap((p) => p.jsonLdTypes))].filter((t) => t !== "__invalid__").slice(0, 4).join(", ")}), mas nenhum descreve a empresa`,
      fix: "Publique na home um JSON-LD Organization (ou LocalBusiness, se atende num endereço) com name, url, logo, description e sameAs apontando para os perfis oficiais.",
      affectedUrls: [pages[0].url],
      affectedCount: 1,
    });
  }

  if (entidades.length && !entidades.some((e) => e.sameAs.length > 0)) {
    add({
      code: "ENTIDADE_SEM_SAMEAS",
      severity: "medium",
      category: "geo",
      title: "A empresa não está ligada aos próprios perfis",
      impact:
        "É o sameAs que diz à máquina que o site, o Instagram, o LinkedIn e o perfil no Google são a mesma empresa. A IA aprende sobre você principalmente nesses outros lugares - sem o elo, ela não soma o que leu lá ao seu site.",
      evidence: `O bloco ${entidades[0].tipo} existe, mas sem nenhum link em sameAs`,
      fix: "Adicione sameAs com a URL completa de cada perfil oficial: Instagram, LinkedIn, YouTube, perfil no Google e diretórios do setor em que a empresa está.",
      ...scope(paginasComEntidade),
    });
  }

  if (entidades.length) {
    // A mais completa das fichas: se uma página tem tudo, o que falta nas
    // outras não impede a máquina de reconhecer a empresa.
    const faltasDe = (e: (typeof entidades)[number]) =>
      [
        !e.nome && "name",
        !e.url && "url",
        !e.logo && "logo",
        !e.descricao && "description",
        e.local && !e.endereco && "address",
        e.local && !e.telefone && "telephone",
      ].filter((x): x is string => !!x);
    const melhor = [...entidades].sort(
      (a, b) => faltasDe(a).length - faltasDe(b).length,
    )[0];
    const faltas = faltasDe(melhor);
    if (faltas.length) {
      const faltaLocal = faltas.includes("address") || faltas.includes("telephone");
      add({
        code: "ENTIDADE_INCOMPLETA",
        severity: faltaLocal ? "medium" : "quick_win",
        category: "geo",
        title: "A ficha da empresa está incompleta",
        impact: faltaLocal
          ? "Para negócio com endereço, endereço e telefone na ficha são o que liga o site ao perfil no Google e às buscas \"perto de mim\"."
          : "Cada campo vazio é uma pergunta sobre a empresa que a máquina não consegue responder com certeza.",
        evidence: `${melhor.tipo} sem: ${faltas.join(", ")}`,
        fix: "Complete os campos que faltam no JSON-LD da organização, com os mesmos dados que aparecem no site e no perfil do Google.",
        ...scope(paginasComEntidade),
      });
    }

    const nomes = new Map<string, string>();
    for (const e of entidades) {
      if (e.nome) nomes.set(nomeComparavel(e.nome), e.nome);
    }
    if (nomes.size > 1) {
      add({
        code: "ENTIDADE_NOME_INCONSISTENTE",
        severity: "quick_win",
        category: "geo",
        title: "A empresa aparece com mais de um nome",
        impact:
          "Para a máquina, dois nomes podem ser duas empresas. A consistência do nome em todo lugar é o que junta as menções numa entidade só.",
        evidence: `Nomes encontrados: ${[...nomes.values()].slice(0, 4).map((n) => `"${n}"`).join(", ")}`,
        fix: "Use exatamente o mesmo nome em todos os blocos de dado estruturado - e o mesmo do perfil no Google.",
        ...scope(paginasComEntidade),
      });
    }
  }

  // Duas frases de folheto na mesma página, e não uma: uma só pode ser
  // descuido num texto que no resto tem fato. Duas já é o padrão do texto.
  const folheto = pages.filter((p) => p.frasesVazias.length >= 2);
  if (folheto.length) {
    const exemplos = [...new Set(folheto.flatMap((p) => p.frasesVazias))];
    add({
      code: "TEXTO_GENERICO",
      severity: "medium",
      category: "geo",
      title: `${folheto.length} página(s) falam de nada para a máquina`,
      impact:
        "A IA descreve empresas a partir de fatos: nome, número, lugar, especialidade. Frase de folheto não tem nada disso - não há o que reconhecer, nem o que citar. É o texto que qualquer concorrente poderia assinar.",
      evidence: `Frases encontradas: ${exemplos.slice(0, 5).map((f) => `"${f}"`).join(", ")}`,
      fix: "Troque cada frase por um fato verificável: \"atendemos 140 clínicas em Madri desde 2012\" em vez de \"referência no setor\".",
      ...scope(folheto),
    });
  }

  const noStructure = pages.filter(
    (p) => p.wordCount >= THIN_CONTENT_WORDS && p.h2s.length < 2,
  );
  if (noStructure.length) {
    add({
      code: "NO_HEADING_STRUCTURE",
      severity: "medium",
      category: "geo",
      title: `${noStructure.length} página(s) longas sem subtítulos`,
      impact:
        "Texto corrido sem H2 é difícil de recortar. A IA cita trechos - e prefere conteúdo em blocos com título claro.",
      evidence: "Páginas com conteúdo extenso e menos de 2 subtítulos H2",
      fix: "Divida o texto em seções com H2 que façam a pergunta que o leitor faria.",
      ...scope(noStructure),
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Notas
// ---------------------------------------------------------------------------
//
// A penalidade é proporcional ao alcance do problema, não fixa. Um título
// longo em 1 de 25 páginas não pode pesar o mesmo que em 25 de 25 - com
// penalidade fixa, um site excelente tirava nota de site medíocre e a nota
// deixava de significar alguma coisa.

const BASE_PENALTY: Record<Severity, number> = {
  critical: 30,
  high: 12,
  medium: 6,
  quick_win: 3,
  info: 0,
};

// Piso do alcance: um problema pontual ainda conta, mas pouco.
const MIN_SCOPE = 0.15;

const GEO_CATEGORIES = new Set(["geo"]);

// Achados de GEO que dizem respeito à empresa, não a uma página: a
// identidade é uma só. Um sameAs faltando pesa igual num site de 3 ou de 300
// páginas.
const SITE_INTEIRO = new Set([
  "NO_LLMS_TXT",
  "SEM_ENTIDADE",
  "ENTIDADE_SEM_SAMEAS",
  "ENTIDADE_INCOMPLETA",
  "ENTIDADE_NOME_INCONSISTENTE",
]);

function penaltyFor(finding: Finding, totalPages: number): number {
  const base = BASE_PENALTY[finding.severity];
  if (base === 0) return 0;

  // Achado de site inteiro (robots, sitemap, HTTPS, llms.txt) não tem
  // alcance parcial: ou o site tem o problema, ou não tem.
  const isSiteWide =
    finding.category === "crawlability" ||
    finding.category === "technical" ||
    SITE_INTEIRO.has(finding.code);

  if (isSiteWide) return base;
  if (totalPages === 0) return base;

  const ratio = Math.min(1, finding.affectedCount / totalPages);
  return base * Math.max(MIN_SCOPE, ratio);
}

function scoreFrom(findings: Finding[], totalPages: number): number {
  const penalty = findings.reduce(
    (sum, f) => sum + penaltyFor(f, totalPages),
    0,
  );
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

export function computeScores(findings: Finding[], totalPages = 0) {
  return {
    google: scoreFrom(
      findings.filter((f) => !GEO_CATEGORIES.has(f.category)),
      totalPages,
    ),
    ai: scoreFrom(
      findings.filter((f) => GEO_CATEGORIES.has(f.category)),
      totalPages,
    ),
  };
}

export type ScoreBand = "excelente" | "bom" | "atencao" | "critico";

/** Faixa que dá significado ao número (o cliente não sabe o que é "67"). */
export function scoreBand(score: number): ScoreBand {
  if (score >= 90) return "excelente";
  if (score >= 70) return "bom";
  if (score >= 50) return "atencao";
  return "critico";
}
