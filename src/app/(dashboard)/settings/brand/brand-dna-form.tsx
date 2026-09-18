"use client";

import { campo } from "@/components/ui";
import { BotaoSalvar } from "@/components/botao-salvar";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { salvarDnaDaMarca } from "../../acoes";
import { dnaContradizIdioma, type IdiomaDoBlog } from "@/lib/idioma";
import type { BrandDna } from "@/types";

export function BrandDnaForm({
  blogId,
  initial,
  idioma,
}: {
  blogId: string;
  initial: BrandDna | null;
  /** Idioma real do blog (domínio primeiro). A regra de estilo em texto
   *  livre não consegue mudá-lo, e o cliente precisa saber disso aqui,
   *  antes de descobrir pelo artigo. */
  idioma: IdiomaDoBlog;
}) {
  const router = useRouter();

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
  const [provas, setProvas] = useState(initial?.provas ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const { erro: saveError } = await salvarDnaDaMarca(blogId, {
      description,
      target_audience: targetAudience,
      tone,
      writing_style: writingStyle,
      banned_topics: bannedTopics,
      banned_words: bannedWords,
      provas,
    });

    // Sem esta checagem o botão dizia "Salvo" mesmo quando o upsert
    // falhava - o cliente achava que tinha configurado a marca e os
    // artigos saíam com tom genérico, sem nada denunciando o problema.
    if (saveError) {
      setSaving(false);
      setError(saveError);
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
        <label
          htmlFor="dna-provas"
          className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Dados e casos reais
        </label>
        <p className="mb-1.5 text-sm text-slate-500 dark:text-slate-400">
          Números, resultados e histórias que só a sua empresa tem. É o que
          faz a IA citar o seu artigo e não o do concorrente. Os artigos só
          usam o que estiver aqui: sem isto, não inventam dado nenhum.
        </p>
        <textarea
          id="dna-provas"
          value={provas}
          onChange={(e) => setProvas(e.target.value)}
          rows={4}
          className={cn(campo(), "w-full")}
          placeholder="Ex: 140 clientes atendidos desde 2015. Custo por lead médio caiu 38% em 6 meses para uma rede de clínicas. 9 em cada 10 clientes renovam o contrato."
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
        {dnaContradizIdioma(writingStyle, idioma.codigo) && (
          <p className="mt-1.5 text-sm text-nota-atencao">
            Esta regra pede outro idioma e é ignorada: pautas e artigos
            deste blog saem em {idioma.rotulo}.
          </p>
        )}
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

      <BotaoSalvar salvando={saving} salvo={saved} />

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Não foi possível salvar: {error}
        </p>
      )}
    </form>
  );
}
