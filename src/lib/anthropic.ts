import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { buildBrandSystemPrompt } from "@/lib/brand-prompt";
import type { BrandDna, Blog, InternalLink } from "@/types";

// ----------------------------------------------------------------------------
// CARROSSEL PARA INSTAGRAM
// ----------------------------------------------------------------------------
const CarouselSlideSchema = z.object({
  headline: z
    .string()
    .describe(
      "Frase de impacto do slide, direta, sem enrolação - pensada para caber num cartão quadrado. Não repita o título do artigo palavra por palavra.",
    ),
  body: z
    .string()
    .optional()
    .describe("Uma frase curta de apoio, opcional - só quando agregar."),
});

const CarouselSchema = z.object({
  slides: z
    .array(CarouselSlideSchema)
    .min(6)
    .max(8)
    .describe(
      "O primeiro slide é o gancho que para o scroll - não é o título copiado, é a promessa do artigo reescrita para prender atenção em 1 segundo. Os do meio pegam um ponto forte por vez, extraído do conteúdo real. O último é a chamada para ação.",
    ),
});

export type CarouselSlide = z.infer<typeof CarouselSlideSchema>;

export async function generateCarouselSlides(params: {
  blog: Blog;
  dna: BrandDna | null;
  title: string;
  bodyText: string;
  ctaText?: string | null;
}): Promise<CarouselSlide[]> {
  const client = getAnthropicClient();
  const { blog, dna, title, bodyText, ctaText } = params;

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: [
      {
        type: "text",
        text: buildBrandSystemPrompt(blog, dna),
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: {
      effort: "medium",
      format: zodOutputFormat(CarouselSchema),
    },
    messages: [
      {
        role: "user",
        content: `Transforme o artigo abaixo num carrossel de Instagram (6 a 8 slides). Baseie-se só no conteúdo real - não invente dado, número ou afirmação que não esteja no texto.

Título original: "${title}"

Conteúdo:
${bodyText.slice(0, 6000)}

O último slide deve chamar para a ação: "${ctaText || "conhecer mais no blog"}".`,
      },
    ],
  });

  return response.parsed_output?.slides ?? [];
}

const MODEL = "claude-opus-5";

export function getAnthropicClient() {
  return new Anthropic();
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
    // 16000 é folga larga para um artigo (~4000 tokens). Acima disso o
    // SDK exige streaming, por assumir que a requisição pode passar de
    // 10 minutos.
    max_tokens: 16000,
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
