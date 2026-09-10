import {
  type AiProvider,
  type AiAnswer,
  ProviderNotConfiguredError,
} from "./provider";

// ChatGPT: o assistente que a maior parte dos compradores usa de fato.
// Medir só no Claude e vender "visibilidade em IA" era medir o canal errado.
//
// API de Responses com a ferramenta `web_search`. Duas fontes na resposta,
// mantidas separadas pelo mesmo motivo do provedor do Claude:
//   - anotações `url_citation` no texto: o que o modelo citou;
//   - `web_search_call.action.sources`: tudo o que a busca consultou.
//
// O modelo fica em variável de ambiente porque a OpenAI troca e aposenta
// modelos com frequência; mudar de modelo não pode depender de deploy.
const MODELO_PADRAO = "gpt-5.5";

interface ItemDeSaida {
  type?: string;
  content?: {
    type?: string;
    text?: string;
    annotations?: { type?: string; url?: string }[];
  }[];
  action?: { sources?: { url?: string }[] };
}

export class OpenAiProvider implements AiProvider {
  name = "chatgpt";
  label = "ChatGPT";

  isConfigured() {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async ask(question: string): Promise<AiAnswer> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError(this.name);
    }

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_GEO_MODEL || MODELO_PADRAO,
        tools: [{ type: "web_search" }],
        include: ["web_search_call.action.sources"],
        input: question,
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      throw new Error(
        `openai HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`,
      );
    }

    const data = (await res.json()) as {
      output?: ItemDeSaida[];
      output_text?: string;
    };

    const textos: string[] = [];
    const citadas: string[] = [];
    const consultadas: string[] = [];

    for (const item of data.output ?? []) {
      if (item.type === "message") {
        for (const parte of item.content ?? []) {
          if (parte.type !== "output_text") continue;
          if (parte.text) textos.push(parte.text);
          for (const anotacao of parte.annotations ?? []) {
            if (anotacao.type === "url_citation" && anotacao.url) {
              citadas.push(anotacao.url);
            }
          }
        }
      }
      if (item.type === "web_search_call") {
        for (const fonte of item.action?.sources ?? []) {
          if (fonte.url) consultadas.push(fonte.url);
        }
      }
    }

    return {
      provider: this.name,
      answerText: textos.join("\n") || data.output_text || "",
      citationUrls: [...new Set(citadas)],
      searchResultUrls: [...new Set(consultadas)],
    };
  }
}
