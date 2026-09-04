"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Blog } from "@/types";

export function BlogSettingsForm({ blog }: { blog: Blog }) {
  const router = useRouter();
  const supabase = createClient();

  const [customDomain, setCustomDomain] = useState(blog.custom_domain ?? "");
  const [primaryColor, setPrimaryColor] = useState(
    blog.theme.primary_color ?? "#22518a",
  );
  const [ctaText, setCtaText] = useState(blog.cta_config.button_text ?? "");
  const [ctaUrl, setCtaUrl] = useState(blog.cta_config.button_url ?? "");
  const [whatsapp, setWhatsapp] = useState(
    blog.cta_config.whatsapp_number ?? "",
  );
  const [ctaType, setCtaType] = useState<"link" | "whatsapp">(
    blog.cta_config.type,
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    await supabase
      .from("blogs")
      .update({
        custom_domain: customDomain || null,
        theme: { ...blog.theme, primary_color: primaryColor },
        cta_config: {
          type: ctaType,
          button_text: ctaText,
          button_url: ctaUrl || null,
          whatsapp_number: whatsapp || null,
        },
      })
      .eq("id", blog.id);

    if (customDomain) {
      await fetch("/api/onboarding/complete-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "domain_connected" }),
      });
    }

    setSaving(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Domínio próprio (opcional)
        </label>
        <input
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-navy-500 dark:focus:border-navy-400"
          placeholder="blog.suempresa.com"
        />
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Depois de salvar, aponte um registro CNAME do seu domínio para o
          endereço fornecido no README de deploy.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Cor principal
        </label>
        <input
          type="color"
          value={primaryColor}
          onChange={(e) => setPrimaryColor(e.target.value)}
          className="h-10 w-20 rounded-lg border border-slate-300 dark:border-slate-700"
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
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-navy-500 dark:focus:border-navy-400"
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
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-navy-500 dark:focus:border-navy-400"
            placeholder="https://suempresa.com/contacto"
          />
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Número de WhatsApp
          </label>
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-navy-500 dark:focus:border-navy-400"
            placeholder="34600000000"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
