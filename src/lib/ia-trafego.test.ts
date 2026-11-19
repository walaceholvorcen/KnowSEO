import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  assistenteDaVisita,
  inicioDoPeriodo,
  origemDaVisita,
  resumirTrafegoDeIA,
  roboDeIA,
  seriesDiariasDeIA,
} from "./ia-trafego.ts";

describe("robôs de IA", () => {
  test("os três robôs do Claude têm papéis diferentes", () => {
    // Cabeçalhos no formato que a Anthropic documenta.
    const ler = roboDeIA("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)");
    const indexar = roboDeIA("Mozilla/5.0 (compatible; Claude-SearchBot/1.0; +Claude-SearchBot@anthropic.com)");
    const treinar = roboDeIA("Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)");
    assert.deepEqual([ler?.papel, indexar?.papel, treinar?.papel], ["leitura", "indexacao", "treino"]);
    assert.ok([ler, indexar, treinar].every((r) => r?.assistente === "claude"));
  });

  test("ChatGPT e Perplexity entram na mesma régua", () => {
    assert.equal(roboDeIA("Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)")?.papel, "leitura");
    assert.equal(roboDeIA("Mozilla/5.0 (compatible; OAI-SearchBot/1.0)")?.assistente, "chatgpt");
    assert.equal(roboDeIA("Mozilla/5.0 (compatible; GPTBot/1.2)")?.papel, "treino");
    assert.equal(roboDeIA("Mozilla/5.0 (compatible; Perplexity-User/1.0)")?.papel, "leitura");
    assert.equal(roboDeIA("Mozilla/5.0 (compatible; PerplexityBot/1.0)")?.papel, "indexacao");
  });

  test("gente e buscador comum não são robô de IA", () => {
    for (const ua of [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0)",
      "",
      null,
      undefined,
    ]) {
      assert.equal(roboDeIA(ua), null, String(ua));
    }
  });
});

describe("de onde veio a visita", () => {
  test("endereço anterior dos assistentes é reconhecido", () => {
    assert.equal(assistenteDaVisita("https://claude.ai"), "claude");
    assert.equal(assistenteDaVisita("https://chatgpt.com"), "chatgpt");
    assert.equal(assistenteDaVisita("https://www.perplexity.ai"), "perplexity");
    assert.equal(assistenteDaVisita("https://gemini.google.com"), "google");
  });

  test("a marcação do link vale quando não há endereço anterior", () => {
    // O ChatGPT acrescenta utm_source=chatgpt.com aos links que cita.
    assert.equal(assistenteDaVisita("utm:chatgpt.com"), "chatgpt");
  });

  test("domínio parecido não passa por assistente", () => {
    assert.equal(assistenteDaVisita("https://notclaude.ai"), null);
    assert.equal(assistenteDaVisita("https://claude.ai.golpe.com"), null);
    assert.equal(assistenteDaVisita("https://www.google.com"), null);
    assert.equal(assistenteDaVisita("lixo"), null);
    assert.equal(assistenteDaVisita(null), null);
  });
});

describe("o que o rastreio aceita gravar", () => {
  const BLOG = "blog.cliente.com";

  test("guarda só o site de origem, sem caminho nem parâmetros", () => {
    assert.equal(
      origemDaVisita("https://claude.ai/chat/abc-123?x=1", null, BLOG),
      "https://claude.ai",
    );
  });

  test("navegar dentro do próprio blog não é origem", () => {
    assert.equal(origemDaVisita(`https://${BLOG}/outro-artigo`, null, BLOG), null);
  });

  test("sem endereço anterior, cai na marcação do link", () => {
    assert.equal(origemDaVisita("", "chatgpt.com", BLOG), "utm:chatgpt.com");
    assert.equal(origemDaVisita(undefined, "ChatGPT.com", BLOG), "utm:chatgpt.com");
  });

  test("lixo vindo de fora é recusado, não gravado", () => {
    for (const [pagina, marca] of [
      ["javascript:alert(1)", null],
      ["x".repeat(600), null],
      [42, null],
      [null, "<script>"],
      [null, "a".repeat(80)],
      [{}, {}],
    ] as [unknown, unknown][]) {
      assert.equal(origemDaVisita(pagina, marca, BLOG), null, JSON.stringify([pagina, marca]).slice(0, 60));
    }
  });
});

describe("resumo do período", () => {
  const ev = (event_type: string, extra: object = {}) => ({
    event_type,
    article_id: "a1",
    created_at: "2026-11-19T10:00:00.000Z",
    ...extra,
  });

  test("leitura, indexação e treino não se misturam", () => {
    const r = resumirTrafegoDeIA([
      ev("ai_bot", { agente: "claude-user" }),
      ev("ai_bot", { agente: "claude-user", article_id: "a2" }),
      ev("ai_bot", { agente: "claude-searchbot" }),
      ev("ai_bot", { agente: "claudebot" }),
      ev("ai_bot", { agente: "chatgpt-user" }),
    ]);
    const claude = r.assistentes.find((l) => l.assistente === "claude")!;
    assert.deepEqual(
      [claude.leituras, claude.indexacoes, claude.treinos],
      [2, 1, 1],
    );
    assert.equal(r.total.leituras, 3);
  });

  test("clique de gente conta pelo site de onde ela veio", () => {
    const r = resumirTrafegoDeIA([
      ev("pageview", { referrer: "https://claude.ai" }),
      ev("pageview", { referrer: "utm:chatgpt.com" }),
      ev("pageview", { referrer: "https://www.google.com" }),
      ev("pageview", { referrer: null }),
    ]);
    assert.equal(r.total.cliques, 2);
    assert.equal(r.assistentes.find((l) => l.assistente === "claude")!.cliques, 1);
  });

  test("Claude, ChatGPT e Perplexity aparecem mesmo zerados, nessa ordem", () => {
    const r = resumirTrafegoDeIA([]);
    assert.deepEqual(r.assistentes.map((l) => l.assistente), ["claude", "chatgpt", "perplexity"]);
    assert.deepEqual(r.total, { leituras: 0, cliques: 0 });
    assert.deepEqual(r.artigos, []);
  });

  test("o artigo mais usado pela IA vem primeiro; treino não conta para ele", () => {
    const r = resumirTrafegoDeIA([
      ev("ai_bot", { agente: "claudebot", article_id: "a9" }),
      ev("ai_bot", { agente: "claude-user", article_id: "a2" }),
      ev("ai_bot", { agente: "perplexity-user", article_id: "a2" }),
      ev("pageview", { referrer: "https://claude.ai", article_id: "a1" }),
    ]);
    assert.deepEqual(r.artigos.map((a) => a.articleId), ["a2", "a1"]);
  });

  test("agente desconhecido é ignorado, não quebra a soma", () => {
    const r = resumirTrafegoDeIA([ev("ai_bot", { agente: "robo-novo" }), ev("ai_bot", { agente: null })]);
    assert.equal(r.total.leituras, 0);
  });
});

describe("período mostrado", () => {
  test("nos primeiros dias, começa no dia em que a contagem foi ligada", () => {
    assert.equal(
      inicioDoPeriodo(new Date("2026-11-25T12:00:00.000Z")).toISOString(),
      "2026-11-19T12:00:00.000Z",
    );
  });

  test("depois de 28 dias, vira janela móvel", () => {
    assert.equal(
      inicioDoPeriodo(new Date("2027-01-10T12:00:00.000Z")).toISOString(),
      "2026-12-13T12:00:00.000Z",
    );
  });
});

describe("série por dia para o gráfico", () => {
  const DIAS = ["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"];
  const em = (quando: string, event_type: string, extra: object) => ({
    event_type,
    article_id: "a1",
    created_at: quando,
    ...extra,
  });

  test("antes de a contagem existir é buraco, não zero", () => {
    const [claude] = seriesDiariasDeIA([], DIAS, "UTC");
    assert.deepEqual(claude.leituras, [null, null, 0, 0]);
  });

  test("cada evento cai no dia, no assistente e na métrica certos", () => {
    const s = seriesDiariasDeIA(
      [
        em("2026-11-19T15:00:00.000Z", "ai_bot", { agente: "claude-user" }),
        em("2026-11-20T09:00:00.000Z", "ai_bot", { agente: "claude-user" }),
        em("2026-11-20T10:00:00.000Z", "ai_bot", { agente: "claude-searchbot" }),
        em("2026-11-20T11:00:00.000Z", "ai_bot", { agente: "claudebot" }),
        em("2026-11-20T12:00:00.000Z", "pageview", { referrer: "utm:chatgpt.com" }),
      ],
      DIAS,
      "UTC",
    );
    const claude = s.find((x) => x.assistente === "claude")!;
    const gpt = s.find((x) => x.assistente === "chatgpt")!;
    assert.deepEqual(claude.leituras, [null, null, 1, 1]);
    assert.deepEqual(claude.indexacoes, [null, null, 0, 1]);
    // Treino não entra em série nenhuma: não diz nada sobre ser citado.
    assert.deepEqual(claude.cliques, [null, null, 0, 0]);
    assert.deepEqual(gpt.cliques, [null, null, 0, 1]);
  });

  test("o dia é o do fuso de quem opera", () => {
    // 01h UTC do dia 20 ainda é dia 19 em São Paulo.
    const [claude] = seriesDiariasDeIA(
      [em("2026-11-20T01:00:00.000Z", "ai_bot", { agente: "claude-user" })],
      DIAS,
      "America/Sao_Paulo",
    );
    assert.deepEqual(claude.leituras, [null, null, 1, 0]);
  });
});
