import type { Blog, BrandDna } from "@/types";
import { dnaContradizIdioma, idiomaDoBlog } from "./idioma.ts";

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

# Reglas de SEO on-page (obligatorias)
1. Un único H1 (el título), estructura jerárquica correcta con H2/H3.
2. El primer párrafo debe responder la intención de búsqueda en las primeras 2 frases.
3. Párrafos cortos (máximo 4 líneas), listas cuando ayuden a la escaneabilidad.
4. Incluye la keyword principal de forma natural en: título, primer párrafo, al menos un H2.
5. Evita relleno y afirmaciones no verificables. Sé concreto y útil.
6. Cierra con una sección de conclusión accionable (no un simple resumen).`;
}
