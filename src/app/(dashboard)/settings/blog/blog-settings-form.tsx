"use client";

import { botao, campo } from "@/components/ui";
import { BotaoSalvar } from "@/components/botao-salvar";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { IdentidadeVisual } from "./identidade-visual";
import { normalizarDominio, numeroWhatsAppNaUrl } from "@/lib/cta";
import { ehDominioRaiz, isSafeCustomDomain } from "@/lib/dominio";
import { erroNoSlug } from "@/lib/blog-endereco";
import type { Blog } from "@/types";

export function BlogSettingsForm({
  blog,
  prefixoDoEndereco,
}: {
  blog: Blog;
  /** "know-seo.vercel.app/b/" - o que vem antes do slug no endereço. */
  prefixoDoEndereco: string;
}) {
  const router = useRouter();

  const [nome, setNome] = useState(blog.name);
  const [slug, setSlug] = useState(blog.subdomain);
  const [customDomain, setCustomDomain] = useState(blog.custom_domain ?? "");
  const [primaryColor, setPrimaryColor] = useState(
    blog.theme.primary_color ?? "#15191c",
  );
  const [secondaryColor, setSecondaryColor] = useState(
    blog.theme.secondary_color ?? "#15191c",
  );
  // O logo sobe sozinho e já grava; guardar aqui evita que salvar o resto do
  // formulário reescreva o tema com o valor antigo da carga da página.
  const [logoUrl, setLogoUrl] = useState(blog.theme.logo_url);
  const [ctaText, setCtaText] = useState(blog.cta_config.button_text ?? "");
  const [ctaUrl, setCtaUrl] = useState(blog.cta_config.button_url ?? "");
  const [whatsapp, setWhatsapp] = useState(
    blog.cta_config.whatsapp_number ?? "",
  );
  const [ctaType, setCtaType] = useState<"link" | "whatsapp">(
    blog.cta_config.type,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const numeroNaUrl = ctaType === "link" ? numeroWhatsAppNaUrl(ctaUrl) : null;

  // Apex ("cliente.com") ou "www." apontados para nós substituiriam o site
  // do cliente pelo blog. O aviso em publicar-no-dominio.tsx cobre o dado
  // já salvo; aqui o erro aparece na digitação e barra o salvamento.
  const dominioDigitado = normalizarDominio(customDomain);
  const dominioEhRaiz =
    !!dominioDigitado &&
    (ehDominioRaiz(dominioDigitado) || dominioDigitado.startsWith("www."));
  // .vercel.app, IP e host sem ponto: o certificado *.vercel.app cobre um
  // nível só e a Vercel não aceita esse host como domínio de projeto - o
  // endereço morreria no TLS. Não há sugestão a oferecer, só o erro.
  const dominioInvalido =
    !!dominioDigitado && !dominioEhRaiz && !isSafeCustomDomain(dominioDigitado);
  const slugErro = slug === blog.subdomain ? null : erroNoSlug(slug);
  const dominioSugerido = `blog.${dominioDigitado.replace(/^www\./, "")}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (dominioEhRaiz || dominioInvalido || slugErro) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    setAviso(null);

    // O campo aceita o que o cliente colar da barra do navegador. Sem
    // normalizar, "https://cliente.com/" nunca casa com o host que chega
    // na requisição e o domínio próprio não funciona, calado.
    const dominio = normalizarDominio(customDomain);
    if (dominio !== customDomain) setCustomDomain(dominio);

    // Pelo servidor, não pelo client do Supabase: é lá que o domínio raiz e
    // o slug são recusados de verdade - a validação acima é só conforto.
    const res = await fetch("/api/blog/configuracoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // O nome do cliente vem do cadastro e não tinha onde ser corrigido:
        // um "testando dataknow" digitado no primeiro dia ficava no topo do
        // blog publicado e na barra lateral para sempre.
        name: nome.trim() || blog.name,
        custom_domain: dominio || null,
        subdomain: slug,
        theme: {
          ...blog.theme,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          logo_url: logoUrl,
        },
        cta_config: {
          type: ctaType,
          button_text: ctaText,
          button_url: ctaUrl || null,
          whatsapp_number: whatsapp || null,
        },
      }),
    });
    const resposta = await res.json().catch(() => ({}));

    // Mesmo defeito que existia no DNA da Marca: sem checar o erro, a tela
    // dava o salvamento por feito e o blog continuava com a cor antiga.
    if (!res.ok) {
      setSaving(false);
      setError(resposta.error ?? "erro ao salvar");
      return;
    }
    setAviso(resposta.aviso ?? null);

    if (dominio) {
      await fetch("/api/onboarding/complete-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "domain_connected" }),
      });
    }

    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
    >
      <div>
        <label
          htmlFor="nome-do-blog"
          className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Nome do cliente
        </label>
        <input
          id="nome-do-blog"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          className={cn(campo(), "w-full")}
          placeholder="Nome da empresa"
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Aparece no topo do blog publicado, no compartilhamento e na barra
          lateral do painel.
        </p>
      </div>

      <div>
        <label
          htmlFor="slug-do-blog"
          className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Endereço do blog
        </label>
        <div className="flex items-center rounded-lg border border-slate-300 focus-within:border-cobalto-500 focus-within:ring-3 focus-within:ring-cobalto-500/15 dark:border-slate-700 dark:focus-within:border-cobalto-400 dark:focus-within:ring-cobalto-400/20">
          <span className="whitespace-nowrap rounded-l-lg bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            {prefixoDoEndereco}
          </span>
          <input
            id="slug-do-blog"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().trim())}
            aria-invalid={!!slugErro}
            aria-describedby="slug-ajuda"
            className="w-full min-w-0 rounded-r-lg bg-transparent px-3 py-2 text-sm outline-none"
            placeholder="nome-do-cliente"
          />
        </div>
        <p
          id="slug-ajuda"
          className={cn(
            "mt-1 text-xs",
            slugErro ? "text-nota-critico" : "text-slate-500 dark:text-slate-400",
          )}
        >
          {slugErro ??
            (slug !== blog.subdomain
              ? "Os links do endereço atual continuam funcionando: redirecionam para o novo."
              : "Letras minúsculas sem acento, números e hífen.")}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Domínio próprio (opcional)
        </label>
        <input
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
          aria-invalid={dominioEhRaiz || dominioInvalido}
          aria-describedby={
            dominioEhRaiz || dominioInvalido ? "dominio-raiz-erro" : undefined
          }
          className={cn(campo(), "w-full")}
          placeholder="blog.suempresa.com"
        />
        {dominioEhRaiz ? (
          <div
            id="dominio-raiz-erro"
            className="mt-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2.5 text-sm"
          >
            <p className="text-nota-critico">
              Esse é o endereço principal do site. Use um subdomínio, como{" "}
              {dominioSugerido}.
            </p>
            <button
              type="button"
              onClick={() => setCustomDomain(dominioSugerido)}
              className={cn(botao("secundario", "sm"), "mt-2")}
            >
              Usar {dominioSugerido}
            </button>
          </div>
        ) : dominioInvalido ? (
          <p id="dominio-raiz-erro" className="mt-1 text-xs text-nota-critico">
            Esse endereço não pode receber o blog. Use um subdomínio do site do
            cliente, como blog.suaempresa.com.
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Use um subdomínio, como blog.suaempresa.com. O passo a passo para
            apontar o DNS está logo abaixo, pronto para enviar ao cliente.
          </p>
        )}
      </div>

      <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
        <IdentidadeVisual
          blogNome={nome || blog.name}
          ctaText={ctaText}
          logo={logoUrl}
          setLogo={setLogoUrl}
          principal={primaryColor}
          setPrincipal={setPrimaryColor}
          secundaria={secondaryColor}
          setSecundaria={setSecondaryColor}
        />
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Botão de call-to-action nos artigos
        </label>
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              checked={ctaType === "link"}
              onChange={() => setCtaType("link")}
            />
            Link
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              checked={ctaType === "whatsapp"}
              onChange={() => setCtaType("whatsapp")}
            />
            WhatsApp
          </label>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Texto do botão
        </label>
        <input
          value={ctaText}
          onChange={(e) => setCtaText(e.target.value)}
          className={cn(campo(), "w-full")}
          placeholder="Saber más"
        />
      </div>

      {ctaType === "link" ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            URL do botão
          </label>
          <input
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            className={cn(campo(), "w-full")}
            placeholder="https://suempresa.com/contacto"
          />
          {numeroNaUrl && (
            <div className="mt-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2.5 text-sm">
              <p className="text-slate-600 dark:text-slate-400">
                Esse é um link de WhatsApp. Como o tipo está em Link, cada
                conversa é contada como clique comum e o relatório deixa de
                mostrar quantas pessoas chamaram no WhatsApp.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCtaType("whatsapp");
                  setWhatsapp(numeroNaUrl);
                  setCtaUrl("");
                }}
                className="mt-2 rounded-lg border border-cobalto-600 px-3 py-1.5 text-sm font-semibold text-cobalto-700 dark:text-cobalto-300 hover:bg-cobalto-50 dark:hover:bg-cobalto-900/40"
              >
                Usar como WhatsApp ({numeroNaUrl})
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Número de WhatsApp
          </label>
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className={cn(campo(), "w-full")}
            placeholder="34600000000"
          />
        </div>
      )}

      <BotaoSalvar
        salvando={saving}
        salvo={saved}
        disabled={dominioEhRaiz || dominioInvalido || !!slugErro}
      />

      {aviso && <p className="text-sm text-nota-atencao">{aviso}</p>}

      {error && (
        <p className="text-sm text-nota-critico">Não foi possível salvar: {error}</p>
      )}
    </form>
  );
}
