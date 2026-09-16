import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildBrandSystemPrompt } from "./brand-prompt.ts";
import type { Blog, BrandDna } from "@/types";

const BLOG = { language: "es", custom_domain: null } as Blog;

// Valores-sentinela: strings que nunca apareceriam por acaso no prompt.
// Se um campo do DNA não chegar ao prompt, o sentinela some e o teste cai.
const FULL_DNA: BrandDna = {
  blog_id: "b1",
  description: "SENTINELA_DESCRICAO",
  target_audience: "SENTINELA_PUBLICO",
  tone: "SENTINELA_TOM",
  writing_style: "SENTINELA_ESTILO",
  banned_topics: "SENTINELA_TEMAS",
  banned_words: "SENTINELA_PALAVRAS",
  updated_at: "2026-01-01T00:00:00Z",
};

// Campos que não descrevem a voz da marca e por isso não vão ao prompt.
const NAO_VAO_AO_PROMPT = new Set(["blog_id", "updated_at"]);

describe("DNA da marca chega ao prompt", () => {
  test("todo campo preenchido aparece no system prompt", () => {
    const prompt = buildBrandSystemPrompt(BLOG, FULL_DNA);

    // Percorre o objeto em vez de listar campo a campo: quando alguém
    // adicionar um campo novo, o TypeScript obriga a preenchê-lo em
    // FULL_DNA e este laço cobra que ele apareça no prompt.
    for (const [campo, valor] of Object.entries(FULL_DNA)) {
      if (NAO_VAO_AO_PROMPT.has(campo)) continue;
      assert.ok(
        prompt.includes(String(valor)),
        `campo "${campo}" do DNA não chegou ao prompt - o cliente preenche e o artigo não muda`,
      );
    }
  });

  test("pt pede a variante brasileira, não só o código", () => {
    // O código sozinho fez o modelo escrever em português de Portugal.
    const prompt = buildBrandSystemPrompt(
      { language: "pt", custom_domain: null } as Blog,
      FULL_DNA,
    );
    assert.ok(prompt.includes("português do Brasil"));
    assert.ok(prompt.includes("nunca português de Portugal"));
  });

  test("os outros idiomas continuam nomeados", () => {
    assert.ok(buildBrandSystemPrompt(BLOG, FULL_DNA).includes("espanhol"));
    assert.ok(
      buildBrandSystemPrompt(
        { language: "en", custom_domain: null } as Blog,
        FULL_DNA,
      ).includes("inglês"),
    );
  });

  test("o domínio vence o cadastro e o DNA: dataknow.es com 'pt' e regra em português sai em espanhol", () => {
    // O caso real: agência espanhola, language 'pt' por erro de cadastro e
    // "Escreva em português do Brasil" nas regras de estilo.
    const prompt = buildBrandSystemPrompt(
      { language: "pt", custom_domain: "dataknow.es" } as Blog,
      { ...FULL_DNA, writing_style: "Escreva em português do Brasil" },
    );
    assert.ok(prompt.includes("Escreva em espanhol da Espanha"));
    assert.ok(prompt.includes("ignora esa parte"));
    // Sem contradição, o aviso não entra: prompt cacheado não muda à toa.
    assert.ok(!buildBrandSystemPrompt(BLOG, FULL_DNA).includes("ignora esa parte"));
  });

  test("DNA vazio não quebra e cai em texto neutro", () => {
    const prompt = buildBrandSystemPrompt(BLOG, null);
    assert.ok(prompt.includes("sin definir"));
    assert.ok(!prompt.includes("null"));
    assert.ok(!prompt.includes("undefined"));
  });

  test("campo em branco vira texto neutro, não string vazia", () => {
    // O formulário grava "" quando o cliente não preenche. Sem o fallback,
    // o prompt sairia com "Público objetivo: " e a IA inventaria um.
    const prompt = buildBrandSystemPrompt(BLOG, {
      ...FULL_DNA,
      target_audience: "",
      writing_style: "",
    });
    assert.ok(!prompt.includes("Público objetivo: \n"));
    assert.ok(prompt.includes("(sin definir)"));
  });

  test("dois DNAs diferentes geram prompts diferentes", () => {
    // É a garantia mínima de que trocar o DNA muda o que a IA recebe.
    const a = buildBrandSystemPrompt(BLOG, FULL_DNA);
    const b = buildBrandSystemPrompt(BLOG, {
      ...FULL_DNA,
      tone: "OUTRO_TOM",
    });
    assert.notEqual(a, b);
  });
});
