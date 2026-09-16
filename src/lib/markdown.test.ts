import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { markdownParaHtml } from "./markdown.ts";

describe("markdown da resposta da IA", () => {
  test("títulos, parágrafos e listas", () => {
    const html = markdownParaHtml(
      "## Melhores agências\n\nTexto de abertura.\n\n- Uma\n- Duas\n\n1. Primeira\n2. Segunda",
    );
    assert.equal(
      html,
      "<h2>Melhores agências</h2>\n<p>Texto de abertura.</p>\n<ul>\n<li>Uma</li>\n<li>Duas</li>\n</ul>\n<ol>\n<li>Primeira</li>\n<li>Segunda</li>\n</ol>",
    );
  });

  test("negrito, itálico, código e link http", () => {
    const html = markdownParaHtml(
      "Use **DataKnow** ou *outra*, veja [o site](https://dataknow.es/x) e `**cru**`.",
    );
    assert.equal(
      html,
      '<p>Use <strong>DataKnow</strong> ou <em>outra</em>, veja <a href="https://dataknow.es/x" target="_blank" rel="noopener noreferrer">o site</a> e <code>**cru**</code>.</p>',
    );
  });

  test("link que não é http/https fica como texto", () => {
    const html = markdownParaHtml("[x](javascript:alert(1))");
    assert.ok(!html.includes("<a"));
  });

  test("HTML vindo do texto é escapado", () => {
    const html = markdownParaHtml('<script>alert("x")</script> & <b>não</b>');
    assert.ok(!html.includes("<script"));
    assert.ok(!html.includes("<b>"));
    assert.ok(html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp;"));
  });
});
