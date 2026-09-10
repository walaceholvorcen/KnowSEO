// Camada adaptadora dos provedores de IA.
//
// Todo o resto do rastreador depende só desta interface. Trocar de
// provedor (ou adicionar um segundo) não toca em detector, banco nem UI.

export interface AiAnswer {
  provider: string;
  answerText: string;
  /** Fontes que o modelo de fato citou ao escrever a resposta. É o único
   *  sinal que prova citação. */
  citationUrls: string[];
  /** Resultados brutos que a busca devolveu ao modelo - inclusive o que ele
   *  leu e descartou.
   *
   *  Isto NÃO é citação, e a separação existe porque as duas listas já
   *  moraram no mesmo array: bastava o site do cliente aparecer no resultado
   *  de uma busca para o produto declarar "citado, posição 1", mesmo que o
   *  modelo nunca o tivesse mencionado. Num produto que vende prova de
   *  citação, era o pior defeito possível.
   *
   *  Continua sendo guardado porque tem valor próprio e oposto: aparecer na
   *  busca e não ser citado significa que a IA encontrou o cliente e
   *  escolheu outro - diagnóstico muito mais acionável que "não citado". */
  searchResultUrls: string[];
}

export interface AiProvider {
  name: string;
  isConfigured(): boolean;
  ask(question: string): Promise<AiAnswer>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(
      `Provedor "${provider}" sem credencial configurada. Defina a chave no ambiente para ativar o rastreador.`,
    );
    this.name = "ProviderNotConfiguredError";
  }
}
