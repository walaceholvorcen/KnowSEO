// Camada adaptadora dos provedores de IA.
//
// Todo o resto do rastreador depende só desta interface. Trocar de
// provedor (ou adicionar um segundo) não toca em detector, banco nem UI.

export interface AiAnswer {
  provider: string;
  answerText: string;
  citationUrls: string[];
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
