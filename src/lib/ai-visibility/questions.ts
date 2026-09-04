import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Blog, BrandDna } from "@/types";

const QuestionSchema = z.object({
  questions: z.array(
    z.object({
      question: z
        .string()
        .describe(
          "Pergunta exatamente como um comprador real digitaria num assistente de IA",
        ),
      intent: z.enum(["discovery", "comparison", "local", "problem"]),
    }),
  ),
});

// Gera o conjunto de sondagem: as perguntas que um cliente em potencial
// realmente faria a uma IA antes de contratar. Não são keywords de SEO -
// são perguntas em linguagem natural, que é como se fala com um assistente.
export async function generateProbeQuestions(params: {
  blog: Blog;
  dna: BrandDna | null;
  count?: number;
}) {
  const { blog, dna, count = 15 } = params;
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 8000,
    output_config: {
      effort: "medium",
      format: zodOutputFormat(QuestionSchema),
    },
    messages: [
      {
        role: "user",
        content: `Genera ${count} preguntas que un cliente potencial le haría a un asistente de IA (ChatGPT, Perplexity) ANTES de contratar a esta empresa. Escribe en el idioma "${blog.language}".

Negocio: ${dna?.description || blog.name}
Público: ${dna?.target_audience || "(sin definir)"}

Reglas:
- Lenguaje natural, como se le habla a un asistente - NO keywords de SEO.
- NO menciones el nombre de la empresa: queremos saber si aparece sin ser nombrada.
- Mezcla los cuatro tipos: descubrimiento ("mejores X en Y"), comparación
  ("X o Y, qué conviene"), local ("dónde hacer X en [ciudad]") y problema
  ("me duele X, qué hago").`,
      },
    ],
  });

  return response.parsed_output?.questions ?? [];
}
