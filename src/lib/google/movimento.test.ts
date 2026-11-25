import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { compararPeriodos, semMovimento } from "./movimento.ts";
import type { LinhaDoGoogle } from "./desempenho.ts";

const l = (chave: string, posicao: number, impressoes = 50, cliques = 0): LinhaDoGoogle => ({
  chave,
  posicao,
  impressoes,
  cliques,
  ctr: 0,
});
const vazio = { consultasAgora: [], consultasAntes: [], paginasAgora: [], paginasAntes: [], consultaPagina: [] };

describe("o que mudou no Google", () => {
  test("ganhar 2 posições é subir; 1 é ruído", () => {
    const m = compararPeriodos({
      ...vazio,
      consultasAntes: [l("a", 12), l("b", 9)],
      consultasAgora: [l("a", 7), l("b", 8.2)],
    });
    assert.deepEqual(m.subiram.map((x) => x.chave), ["a"]);
    assert.equal(m.cairam.length, 0);
  });

  test("perder posição é cair", () => {
    const m = compararPeriodos({ ...vazio, consultasAntes: [l("a", 4)], consultasAgora: [l("a", 9)] });
    assert.deepEqual(m.cairam.map((x) => x.chave), ["a"]);
  });

  test("amostra pequena não entra na comparação", () => {
    const m = compararPeriodos({ ...vazio, consultasAntes: [l("a", 30, 3)], consultasAgora: [l("a", 5, 40)] });
    assert.equal(m.subiram.length, 0);
  });

  test("quase lá: posição 8 a 20 com impressão", () => {
    const m = compararPeriodos({ ...vazio, consultasAgora: [l("a", 12), l("b", 3), l("c", 25), l("d", 15, 4)] });
    assert.deepEqual(m.quaseLa.map((x) => x.chave), ["a"]);
  });

  test("página que perdeu 30% dos cliques está decaindo; a que sumiu também", () => {
    const m = compararPeriodos({
      ...vazio,
      paginasAntes: [l("/a", 5, 100, 10), l("/b", 5, 100, 10), l("/c", 5, 100, 2), l("/d", 5, 100, 8)],
      paginasAgora: [l("/a", 5, 100, 6), l("/b", 5, 100, 9)],
    });
    assert.deepEqual(m.decaindo.map((x) => x.chave), ["/d", "/a"]);
    assert.equal(m.decaindo[0].agora, 0);
  });

  test("duas páginas na mesma consulta é disputa", () => {
    const m = compararPeriodos({
      ...vazio,
      consultaPagina: [
        { ...l("seguro auto", 9, 30), pagina: "/x" },
        { ...l("seguro auto", 14, 20), pagina: "/y" },
        { ...l("outra", 3, 40), pagina: "/x" },
        { ...l("outra", 50, 2), pagina: "/z" },
        { ...l("seguro de auto", 9, 10), pagina: "/y" },
        { ...l("seguro de auto", 9, 10), pagina: "/x" },
      ],
    });
    // A home junto de outra página não é disputa.
    assert.ok(
      semMovimento(
        compararPeriodos({
          ...vazio,
          consultaPagina: [
            { ...l("marca", 1, 30), pagina: "https://site.es/" },
            { ...l("marca", 3, 20), pagina: "https://site.es/sobre" },
          ],
        }),
      ),
    );
    // As duas consultas com o mesmo par viram uma disputa só.
    assert.deepEqual(m.disputas, [{ consulta: "seguro auto", paginas: ["/x", "/y"], impressoes: 50, consultas: 2 }]);
  });

  test("sem nada a dizer", () => {
    assert.ok(semMovimento(compararPeriodos(vazio)));
  });
});
