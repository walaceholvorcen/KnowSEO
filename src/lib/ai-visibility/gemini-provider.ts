import {
  type AiProvider,
  type AiAnswer,
  ProviderNotConfiguredError,
} from "./provider";

// Gemini: o único dos quatro com camada gratuita de verdade (milhares de
// consultas com busca por mês, sem cartão) e, para o cliente, o mais
// relevante: ele responde usando a busca do Google, a mesma base das AI
// Overviews e do AI Mode - onde o comprador pergunta hoje.
//
// Usa a API de "interactions", que é a atual para busca com fundamentação.
// O formato lembra o da OpenAI: um array de passos, e as citações vêm como
// anotações `url_citation` dentro do passo `model_output`.
//
// LIMITE CONHECIDO, e ele é honesto: o passo `google_search_result` do
// Gemini devolve o widget de sugestões de busca em HTML, não a lista de
// endereços consultados. Então aqui `searchResultUrls` fica vazio - não por
// esquecimento, mas porque a API não expõe. Consequência prática: neste
// motor não dá para dizer "a busca te encontrou e a IA escolheu outro", que
// nos outros três é o diagnóstico mais acionável. O que ele prova é a
// citação, que é a métrica principal.
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

// Flash: é o que a camada gratuita cobre. Em variável de ambiente porque o
// Google aposenta versão a cada poucos meses, e trocar não pode exigir
// deploy.
const MODELO_PADRAO = "gemini-3.8-flash";

interface Anotacao {
  type?: string;
  url?: string;
  title?: string;
}

interface Passo {
  type?: string;
  content?: { type?: string; text?: string; annotations?: Anotacao[] }[];
}

export class GeminiProvider implements AiProvider {
  name = "gemini";
  label = "Gemini";

  isConfigured() {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  async ask(question: string): Promise<AiAnswer> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError(this.name);
    }

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GEMINI_GEO_MODEL || MODELO_PADRAO,
        input: question,
        tools: [{ type: "google_search" }],
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      // O corpo do erro é onde mora a causa (chave inválida, modelo
      // aposentado, cota diária estourada) - sem ele a falha vira só "não
      // respondeu".
      throw new Error(
        `gemini HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`,
      );
    }

    const data = (await res.json()) as { steps?: Passo[] };

    const textos: string[] = [];
    const citadas: string[] = [];

    for (const passo of data.steps ?? []) {
      if (passo.type !== "model_output") continue;
      for (const parte of passo.content ?? []) {
        if (parte.text) textos.push(parte.text);
        for (const anotacao of parte.annotations ?? []) {
          if (anotacao.type === "url_citation" && anotacao.url) {
            citadas.push(anotacao.url);
          }
        }
      }
    }

    return {
      provider: this.name,
      answerText: textos.join("\n"),
      citationUrls: [...new Set(citadas)],
      searchResultUrls: [],
    };
  }
}
