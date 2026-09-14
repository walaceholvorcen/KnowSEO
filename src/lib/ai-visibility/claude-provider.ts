import Anthropic from "@anthropic-ai/sdk";
import {
  type AiProvider,
  type AiAnswer,
  ProviderNotConfiguredError,
} from "./provider";

// Provedor baseado no Claude com busca web nativa. A busca é o que
// importa aqui: sem ela o modelo responde de memória e não reflete o que
// um usuário real veria hoje.
const MODEL = "claude-opus-5";

export class ClaudeProvider implements AiProvider {
  name = "claude";
  label = "Claude";

  isConfigured() {
    const key = process.env.ANTHROPIC_API_KEY;
    return Boolean(key && !key.startsWith("placeholder"));
  }

  async ask(question: string): Promise<AiAnswer> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError(this.name);
    }

    const client = new Anthropic();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      tools: [
        {
          // A versão 20250305, não a 20260209. A nova filtra os resultados
          // numa execução de código criptografada e devolve o texto com
          // `citations: []` - medido em set/2026: 0 citações contra 15 da
          // clássica, mesma pergunta, mesmo custo. Sem citação o Raio X não
          // tem prova de fonte, concorrente nem diretório.
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3,
        },
      ],
      messages: [{ role: "user", content: question }],
    });

    const answerText: string[] = [];
    const citationUrls: string[] = [];
    const searchResultUrls: string[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        answerText.push(block.text);
        // Fonte amarrada ao texto: isto é citação de verdade. A ordem em que
        // aparece aqui é a ordem em que o modelo apoiou a resposta, e é o
        // que dá sentido ao campo "posição" mostrado ao cliente.
        for (const citation of block.citations ?? []) {
          if ("url" in citation && typeof citation.url === "string") {
            citationUrls.push(citation.url);
          }
        }
      }

      // O que a busca devolveu, não o que o modelo citou. Vai para a outra
      // lista - misturar as duas fabricava citação que nunca existiu.
      if (block.type === "web_search_tool_result") {
        const content = block.content;
        if (Array.isArray(content)) {
          for (const item of content) {
            if ("url" in item && typeof item.url === "string") {
              searchResultUrls.push(item.url);
            }
          }
        }
      }
    }

    return {
      provider: this.name,
      answerText: answerText.join("\n"),
      citationUrls: [...new Set(citationUrls)],
      searchResultUrls: [...new Set(searchResultUrls)],
    };
  }
}
