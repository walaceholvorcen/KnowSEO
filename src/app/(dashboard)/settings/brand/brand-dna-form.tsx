"use client";

import { botao, campo } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { BrandDna } from "@/types";

export function BrandDnaForm({
  blogId,
  initial,
}: {
  blogId: string;
  initial: BrandDna | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [description, setDescription] = useState(initial?.description ?? "");
  const [targetAudience, setTargetAudience] = useState(
    initial?.target_audience ?? "",
  );
  const [tone, setTone] = useState(initial?.tone ?? "profesional y cercano");
  const [writingStyle, setWritingStyle] = useState(
    initial?.writing_style ?? "",
  );
  const [bannedTopics, setBannedTopics] = useState(
    initial?.banned_topics ?? "",
  );
  const [bannedWords, setBannedWords] = useState(initial?.banned_words ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const { error: saveError } = await supabase.from("brand_dna").upsert({
      blog_id: blogId,
      description,
      target_audience: targetAudience,
      tone,
      writing_style: writingStyle,
      banned_topics: bannedTopics,
      banned_words: bannedWords,
      updated_at: new Date().toISOString(),
    });

    // Sem esta checagem o botão dizia "Salvo" mesmo quando o upsert
    // falhava - o cliente achava que tinha configurado a marca e os
    // artigos saíam com tom genérico, sem nada denunciando o problema.
    if (saveError) {
      setSaving(false);
      setError(saveError.message);
      return;
    }

    await fetch("/api/onboarding/complete-step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "brand_dna" }),
    });

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
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          O que a sua empresa faz?
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={cn(campo(), "w-full")}
          placeholder="Ex: Somos uma agência de performance que cuida de anúncios para pequenas empresas..."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Público-alvo
        </label>
        <input
          value={targetAudience}
          onChange={(e) => setTargetAudience(e.target.value)}
          className={cn(campo(), "w-full")}
          placeholder="Ex: Donos de negócio de 25 a 55 anos que querem mais clientes"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Tom de voz
        </label>
        <input
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className={cn(campo(), "w-full")}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Regras de estilo
        </label>
        <textarea
          value={writingStyle}
          onChange={(e) => setWritingStyle(e.target.value)}
          rows={2}
          className={cn(campo(), "w-full")}
          placeholder="Ex: Trate o leitor por você. Frases curtas. Explique todo termo técnico."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Assuntos proibidos
        </label>
        <input
          value={bannedTopics}
          onChange={(e) => setBannedTopics(e.target.value)}
          className={cn(campo(), "w-full")}
          placeholder="Ex: Não citar concorrentes, não prometer resultado garantido"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Palavras proibidas
        </label>
        <input
          value={bannedWords}
          onChange={(e) => setBannedWords(e.target.value)}
          className={cn(campo(), "w-full")}
          placeholder="Ex: barato, low cost, garantido"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className={botao("primario")}
      >
        {saving ? "Salvando..." : saved ? "Salvo" : "Salvar"}
      </button>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          No se pudo guardar: {error}
        </p>
      )}
    </form>
  );
}
