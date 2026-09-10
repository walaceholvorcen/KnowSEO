import {
  type AiProvider,
  type AiAnswer,
  ProviderNotConfiguredError,
} from "./provider";

// Perplexity: o assistente que mais cita fonte de forma explícita, e o mais
// barato de consultar. A resposta já separa as duas coisas que o detector
// precisa: `citations` (fontes usadas na resposta) e `search_results` (o que
// a busca devolveu).
//
// A documentação atual indica /v1/sonar; o endpoint histórico de chat
// continua servindo contas antigas. Se o primeiro devolver 404, tentamos o
// segundo antes de desistir - trocar de endpoint não pode derrubar a rodada
// de todos os clientes. PERPLEXITY_API_URL força um endereço específico.
const URL_ATUAL = "https://api.perplexity.ai/v1/sonar";
const URL_HISTORICA = "https://api.perplexity.ai/chat/completions";

interface RespostaPerplexity {
  choices?: { message?: { content?: string } }[];
  citations?: string[];
  search_results?: { url?: string }[];
}

export class PerplexityProvider implements AiProvider {
  name = "perplexity";
  label = "Perplexity";

  isConfigured() {
    return Boolean(process.env.PERPLEXITY_API_KEY);
  }

  async ask(question: string): Promise<AiAnswer> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError(this.name);
    }

    const init: RequestInit = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.PERPLEXITY_MODEL || "sonar",
        messages: [{ role: "user", content: question }],
      }),
    };

    const forcada = process.env.PERPLEXITY_API_URL;
    let res = await fetch(forcada || URL_ATUAL, {
      ...init,
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status === 404 && !forcada) {
      res = await fetch(URL_HISTORICA, {
        ...init,
        signal: AbortSignal.timeout(60_000),
      });
    }

    if (!res.ok) {
      // O corpo do erro é onde mora a causa (chave inválida, modelo
      // aposentado, cota) - sem ele a falha vira só "não respondeu".
      throw new Error(
        `perplexity HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`,
      );
    }

    const data = (await res.json()) as RespostaPerplexity;

    return {
      provider: this.name,
      answerText: data.choices?.[0]?.message?.content ?? "",
      citationUrls: [...new Set(data.citations ?? [])],
      searchResultUrls: [
        ...new Set(
          (data.search_results ?? [])
            .map((r) => r.url)
            .filter((u): u is string => Boolean(u)),
        ),
      ],
    };
  }
}
