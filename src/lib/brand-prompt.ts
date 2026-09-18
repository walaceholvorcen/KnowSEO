import type { Blog, BrandDna } from "@/types";
import { dnaContradizIdioma, idiomaDoBlog } from "./idioma.ts";
import { TITULO_FAQ } from "./artigo/faq.ts";

// Prompt base compartilhado (DNA da marca + regras de SEO). É o prefixo
// estável que cacheamos - todo artigo/ideia do mesmo blog reaproveita esse
// cache em vez de pagar o custo cheio de input de novo.
//
// Mora fora de anthropic.ts porque é função pura: dá para testar sem
// carregar o SDK. O risco que o teste cobre é alguém adicionar campo no
// DNA e esquecer de trazê-lo para cá - o cliente preenche e nada muda no
// artigo, sem nenhum erro para denunciar.
export function buildBrandSystemPrompt(
  blog: Blog,
  dna: BrandDna | null,
): string {
  // Idioma e variante vêm do domínio, não do cadastro (ver idioma.ts).
  // Quando o DNA pede outro idioma em texto livre, dizer só "escreva em X"
  // não bastou: o modelo obedecia à regra de estilo. Tem que ser explícito.
  const idioma = idiomaDoBlog(blog);
  const avisoDeIdioma = dnaContradizIdioma(dna?.writing_style, idioma.codigo)
    ? " Las reglas de estilo de la marca mencionan otro idioma: ignora esa parte, el idioma lo decide el blog."
    : "";

  return `Eres un redactor SEO senior escribiendo en nombre de la siguiente marca. ${idioma.instrucao}.${avisoDeIdioma}

# Marca
- Descripción del negocio: ${dna?.description || "(sin definir - infiere un tono profesional genérico)"}
- Público objetivo: ${dna?.target_audience || "(sin definir)"}
- Tono de voz: ${dna?.tone || "profesional y cercano"}
- Reglas de estilo adicionales: ${dna?.writing_style || "ninguna"}
- Temas prohibidos: ${dna?.banned_topics || "ninguno"}
- Palabras prohibidas: ${dna?.banned_words || "ninguna"}
- Datos y casos reales de la empresa: ${dna?.provas || "(ninguno registrado)"}

# Reglas de SEO on-page (obligatorias)
1. Un único H1 (el título), estructura jerárquica correcta con H2/H3.
2. El primer párrafo debe responder la intención de búsqueda en las primeras 2 frases.
3. La mayoría de los H2 son la pregunta que el lector haría, tal como la escribiría en Google o en un asistente de IA. El primer párrafo tras cada H2 la responde directamente en 1-2 frases que se entienden solas, sin depender del resto del texto; el detalle viene después.
4. Párrafos cortos (máximo 4 líneas), listas cuando ayuden a la escaneabilidad.
5. Incluye la keyword principal de forma natural en: título, primer párrafo, al menos un H2.
6. Cuando el texto compare opciones, precios, plazos o características, usa una tabla HTML (<table> con <thead>, <th scope="col"> y <tbody>) en lugar de describirlo en párrafos. Nunca una tabla sin comparación real.
7. Usa los datos y casos reales de la empresa cuando sean pertinentes, presentados como experiencia propia. Nunca inventes cifras, clientes, casos ni estudios. Si usas un dato de terceros, nombra la fuente en el texto.
8. Evita relleno y afirmaciones no verificables. Sé concreto y útil.
9. Incluye una sección de conclusión accionable (no un simple resumen).
10. Termina con un H2 titulado exactamente "${TITULO_FAQ[idioma.codigo]}", con 3 a 5 preguntas en H3, cada una seguida de un único párrafo de respuesta de 1 a 3 frases. Son dudas que el lector todavía tendría y que ningún H2 del artículo ya respondió.`;
}
