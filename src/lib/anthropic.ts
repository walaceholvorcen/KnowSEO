import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { BrandDna, Blog, InternalLink } from "@/types";

const MODEL = "claude-opus-5";

export function getAnthropicClient() {
  return new Anthropic();
}

// ----------------------------------------------------------------------------
// Prompt base compartilhado (DNA da marca + regras de SEO). É o prefixo
// estável que cacheamos - todo artigo/ideia do mesmo blog reaproveita esse
// cache em vez de pagar o custo cheio de input de novo.
// ----------------------------------------------------------------------------
function buildBrandSystemPrompt(blog: Blog, dna: BrandDna | null): string {
  return `Eres un redactor SEO senior escribiendo en nombre de la siguiente marca. Escribe SIEMPRE en el idioma "${blog.language}" (es = español, pt = portugués, en = inglés).

# Marca
- Descripción del negocio: ${dna?.description || "(sin definir - infiere un tono profesional genérico)"}
- Público objetivo: ${dna?.target_audience || "(sin definir)"}
- Tono de voz: ${dna?.tone || "profesional y cercano"}
- Reglas de estilo adicionales: ${dna?.writing_style || "ninguna"}
- Temas prohibidos: ${dna?.banned_topics || "ninguno"}
- Palabras prohibidas: ${dna?.banned_words || "ninguna"}

# Reglas de SEO on-page (obligatorias)
1. Un único H1 (el título), estructura jerárquica correcta con H2/H3.
2. El primer párrafo debe responder la intención de búsqueda en las primeras 2 frases.
3. Párrafos cortos (máximo 4 líneas), listas cuando ayuden a la escaneabilidad.
4. Incluye la keyword principal de forma natural en: título, primer párrafo, al menos un H2.
5. Evita relleno y afirmaciones no verificables. Sé concreto y útil.
6. Cierra con una sección de conclusión accionable (no un simple resumen).`;
}

// ----------------------------------------------------------------------------
// IDEACIÓN DE KEYWORDS ("Estrategia" - equivalente al agente Martin)
// ----------------------------------------------------------------------------
const KeywordIdeaSchema = z.object({
  ideas: z.array(
    z.object({
      keyword: z.string().describe("La keyword principal, en minúsculas"),
      suggested_title: z.string(),
      funnel_stage: z.enum(["top", "middle", "bottom"]),
      difficulty: z
        .enum(["baja", "media", "alta"])
        .describe("Estimación cualitativa de dificultad de ranking"),
      opportunity_score: z.enum(["buena", "muy_buena", "excelente"]),
      rationale: z
        .string()
        .describe("Por qué esta keyword es una buena oportunidad, en una frase"),
    }),
  ),
});

export type KeywordIdea = z.infer<typeof KeywordIdeaSchema>["ideas"][number];

export async function generateKeywordIdeas(params: {
  blog: Blog;
  dna: BrandDna | null;
  existingKeywords: string[];
  count?: number;
}): Promise<KeywordIdea[]> {
  const client = getAnthropicClient();
  const { blog, dna, existingKeywords, count = 8 } = params;

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: [
      {
        type: "text",
        text: buildBrandSystemPrompt(blog, dna),
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: {
      effort: "medium",
      format: zodOutputFormat(KeywordIdeaSchema),
    },
    messages: [
      {
        role: "user",
        content: `Sugiere ${count} keywords nuevas para el blog de esta marca, con buena intención de búsqueda comercial o informacional.

Ya existen (o fueron descartadas) estas keywords - NO las repitas ni sugieras variantes triviales de ellas:
${existingKeywords.length ? existingKeywords.map((k) => `- ${k}`).join("\n") : "(ninguna todavía)"}

Prioriza keywords donde un artículo bien escrito pueda razonablemente competir (evita términos ultra-genéricos dominados por marcas globales).`,
      },
    ],
  });

  return response.parsed_output?.ideas ?? [];
}

// ----------------------------------------------------------------------------
// GENERACIÓN DE ARTÍCULO COMPLETO
// ----------------------------------------------------------------------------
const ArticleSchema = z.object({
  title: z.string(),
  slug: z
    .string()
    .describe("URL-friendly, minúsculas, con guiones, sin acentos"),
  seo_title: z.string().describe("Máximo 60 caracteres"),
  seo_description: z.string().describe("Máximo 155 caracteres"),
  excerpt: z.string().describe("Resumen de 1-2 frases para tarjetas/previews"),
  content_html: z
    .string()
    .describe(
      "Cuerpo del artículo en HTML semántico (h2, h3, p, ul, li, strong) - SIN <html>, <head> ni <body>. No repitas el título como H1 dentro del contenido.",
    ),
});

export type GeneratedArticle = z.infer<typeof ArticleSchema>;

export async function generateArticle(params: {
  blog: Blog;
  dna: BrandDna | null;
  keyword: string;
  suggestedTitle?: string | null;
  internalLinks: InternalLink[];
}): Promise<GeneratedArticle | null> {
  const client = getAnthropicClient();
  const { blog, dna, keyword, suggestedTitle, internalLinks } = params;

  const linksBlock = internalLinks.length
    ? internalLinks
        .slice(0, 30)
        .map((l) => `- ${l.url}${l.title ? ` (${l.title})` : ""}`)
        .join("\n")
    : null;

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 32000,
    system: [
      {
        type: "text",
        text: buildBrandSystemPrompt(blog, dna),
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: {
      effort: "high",
      format: zodOutputFormat(ArticleSchema),
    },
    messages: [
      {
        role: "user",
        content: `Escribe un artículo de blog completo (900-1400 palabras) optimizado para la keyword: "${keyword}".
${suggestedTitle ? `Título sugerido de referencia (puedes ajustarlo): "${suggestedTitle}"` : ""}

${
  linksBlock
    ? `Cuando sea natural, enlaza 2-4 de estas páginas del propio sitio dentro del contenido usando <a href="...">texto ancla</a> (no fuerces enlaces si no encajan):\n${linksBlock}`
    : "No hay páginas internas mapeadas todavía - no inventes enlaces internos."
}`,
      },
    ],
  });

  return response.parsed_output;
}
