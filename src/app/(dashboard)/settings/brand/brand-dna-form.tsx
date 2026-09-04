"use client";

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

    // Sem esta checagem o botão dizia "Guardado ✓" mesmo quando o upsert
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
          ¿Qué hace tu empresa?
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-cobalto-500 dark:focus:border-cobalto-400"
          placeholder="Ej: Somos una clínica dental en Madrid especializada en ortodoncia invisible..."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Público objetivo
        </label>
        <input
          value={targetAudience}
          onChange={(e) => setTargetAudience(e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-cobalto-500 dark:focus:border-cobalto-400"
          placeholder="Ej: Adultos de 25-45 años preocupados por su salud dental"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Tono de voz
        </label>
        <input
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-cobalto-500 dark:focus:border-cobalto-400"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Reglas de estilo adicionales
        </label>
        <textarea
          value={writingStyle}
          onChange={(e) => setWritingStyle(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-cobalto-500 dark:focus:border-cobalto-400"
          placeholder="Ej: Usa 'tú' en vez de 'usted'. Evita tecnicismos sin explicarlos."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Temas prohibidos
        </label>
        <input
          value={bannedTopics}
          onChange={(e) => setBannedTopics(e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-cobalto-500 dark:focus:border-cobalto-400"
          placeholder="Ej: No mencionar competidores, no dar consejos médicos definitivos"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Palabras prohibidas
        </label>
        <input
          value={bannedWords}
          onChange={(e) => setBannedWords(e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-cobalto-500 dark:focus:border-cobalto-400"
          placeholder="Ej: barato, low cost, garantizado"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-cobalto-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cobalto-700 disabled:opacity-50"
      >
        {saving ? "Guardando..." : saved ? "Guardado ✓" : "Guardar"}
      </button>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          No se pudo guardar: {error}
        </p>
      )}
    </form>
  );
}
