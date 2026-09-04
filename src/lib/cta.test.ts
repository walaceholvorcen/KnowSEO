import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { numeroWhatsAppNaUrl, normalizarDominio } from "./cta.ts";

describe("link de WhatsApp colado no campo de URL", () => {
  test("reconhece o formato que veio do cliente real", () => {
    // Exatamente a URL que estava salva com tipo "Link" e fazia o relatório
    // contar conversa de WhatsApp como clique genérico.
    assert.equal(
      numeroWhatsAppNaUrl(
        "https://api.whatsapp.com/send/?phone=34683512797&text=Hola&type=phone_number",
      ),
      "34683512797",
    );
  });

  test("reconhece as outras formas do link", () => {
    assert.equal(numeroWhatsAppNaUrl("https://wa.me/34683512797"), "34683512797");
    assert.equal(
      numeroWhatsAppNaUrl("https://web.whatsapp.com/send?phone=+34 683 512 797"),
      "34683512797",
    );
    assert.equal(
      numeroWhatsAppNaUrl("https://www.wa.me/34683512797"),
      "34683512797",
    );
  });

  test("link comum não é confundido com WhatsApp", () => {
    assert.equal(numeroWhatsAppNaUrl("https://suempresa.com/contacto"), null);
    assert.equal(numeroWhatsAppNaUrl("https://exemplo.com/wa.me/123456789"), null);
  });

  test("convite de grupo não vira número", () => {
    // O código do convite é uma sequência longa; sem o corte viraria um
    // "telefone" que não existe.
    assert.equal(
      numeroWhatsAppNaUrl("https://chat.whatsapp.com/ABC123def456"),
      null,
    );
  });

  test("entrada vazia ou inválida não quebra", () => {
    assert.equal(numeroWhatsAppNaUrl(""), null);
    assert.equal(numeroWhatsAppNaUrl("nao e url"), null);
    assert.equal(numeroWhatsAppNaUrl("wa.me/34683512797"), null);
  });

  test("número curto demais para ter código de país é recusado", () => {
    assert.equal(numeroWhatsAppNaUrl("https://wa.me/1234"), null);
  });
});

describe("domínio próprio", () => {
  test("tira esquema, caminho e barra final", () => {
    assert.equal(normalizarDominio("https://dataknow.es/"), "dataknow.es");
    assert.equal(
      normalizarDominio("http://blog.cliente.com/algo"),
      "blog.cliente.com",
    );
    assert.equal(normalizarDominio("  BLOG.Cliente.COM  "), "blog.cliente.com");
  });

  test("hostname já limpo passa intacto", () => {
    assert.equal(normalizarDominio("blog.cliente.com"), "blog.cliente.com");
  });

  test("vazio continua vazio", () => {
    assert.equal(normalizarDominio(""), "");
    assert.equal(normalizarDominio("   "), "");
  });
});
