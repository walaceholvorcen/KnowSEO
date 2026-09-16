"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { botao, campo } from "@/components/ui";
import { cn } from "@/lib/utils";
import { destacaDoFundo, textoSobre } from "@/lib/contrast";
import { paletaDoLogo, type Paleta } from "@/lib/paleta";

// A identidade do cliente num lugar só: logo, cor principal e cor
// secundária. Antes existia só a cor principal, e o `logo_url` do tema
// estava no banco desde o primeiro dia sem nenhuma tela que o preenchesse.
//
// As cores são lidas do próprio logo no navegador (canvas), não por IA:
// é instantâneo, não custa chamada e o cliente confere o resultado na hora.
// O arquivo local também evita o problema de ler a imagem do site dele,
// que costuma bloquear uso externo.

interface LeituraDoLogo {
  paleta: Paleta | null;
  /** Largura / altura: é o que a capa e o carrossel precisam para desenhar. */
  proporcao: number | null;
}

async function coresDoArquivo(arquivo: File): Promise<LeituraDoLogo> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new window.Image();
    img.src = url;
    await img.decode();
    // 200px de lado bastam: a cor dominante de um logo não muda por
    // olhar a imagem em tamanho real, e o navegador não trava.
    const escala = Math.min(1, 200 / Math.max(img.width, img.height, 1));
    const tela = document.createElement("canvas");
    tela.width = Math.max(1, Math.round(img.width * escala));
    tela.height = Math.max(1, Math.round(img.height * escala));
    const proporcao = img.height ? img.width / img.height : null;
    const ctx = tela.getContext("2d");
    if (!ctx) return { paleta: null, proporcao };
    ctx.drawImage(img, 0, 0, tela.width, tela.height);
    return {
      paleta: paletaDoLogo(ctx.getImageData(0, 0, tela.width, tela.height).data, 1),
      proporcao,
    };
  } catch {
    // SVG que referencia fonte ou imagem externa não desenha no canvas.
    // Não é erro do cliente: ele escolhe as cores à mão.
    return { paleta: null, proporcao: null };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Amostra({ cor }: { cor: string }) {
  return (
    <span
      className="inline-block h-5 w-5 rounded border border-slate-300 align-middle dark:border-slate-700"
      style={{ backgroundColor: cor }}
      aria-hidden
    />
  );
}

function CampoDeCor({
  id,
  rotulo,
  valor,
  onChange,
  apoio,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  apoio: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {rotulo}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="h-9.5 w-14 rounded-lg border border-slate-300 dark:border-slate-700"
        />
        <input
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          aria-label={`${rotulo} em hexadecimal`}
          className={cn(campo(), "tabular w-28 font-mono")}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{apoio}</p>
    </div>
  );
}

export function IdentidadeVisual({
  blogNome,
  ctaText,
  logo,
  setLogo,
  principal,
  setPrincipal,
  secundaria,
  setSecundaria,
}: {
  blogNome: string;
  ctaText: string;
  logo: string | null;
  setLogo: (url: string | null) => void;
  principal: string;
  setPrincipal: (cor: string) => void;
  secundaria: string;
  setSecundaria: (cor: string) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sugestao, setSugestao] = useState<Paleta | null>(null);

  const corTexto = textoSobre(principal);

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setEnviando(true);
    const leitura = await coresDoArquivo(arquivo);
    setSugestao(leitura.paleta);

    const corpo = new FormData();
    corpo.append("arquivo", arquivo);
    if (leitura.proporcao) corpo.append("proporcao", String(leitura.proporcao));
    try {
      const res = await fetch("/api/blog/logo", { method: "POST", body: corpo });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar.");
      setLogo(data.url as string);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar.");
    }
    setEnviando(false);
  }

  async function remover() {
    setEnviando(true);
    await fetch("/api/blog/logo", { method: "DELETE" });
    setLogo(null);
    setSugestao(null);
    setEnviando(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Logo do cliente
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-16 w-32 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800">
            {logo ? (
              <Image
                src={logo}
                alt={`Logo de ${blogNome}`}
                width={112}
                height={48}
                unoptimized
                className="max-h-12 w-auto object-contain"
              />
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Sem logo
              </span>
            )}
          </div>

          <input
            ref={entrada}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="sr-only"
            onChange={(e) => escolher(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={enviando}
            className={botao("secundario", "sm")}
          >
            <Upload size={14} aria-hidden />
            {enviando ? "Enviando..." : logo ? "Trocar logo" : "Enviar logo"}
          </button>
          {logo && (
            <button
              type="button"
              onClick={remover}
              disabled={enviando}
              className={botao("fantasma", "sm")}
            >
              <Trash2 size={14} aria-hidden />
              Remover
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          PNG, JPG, WEBP ou SVG, até 2 MB. Fundo transparente fica melhor: o
          logo aparece no topo do blog, na capa do artigo e no carrossel.
        </p>
        {erro && <p className="mt-1 text-sm text-nota-critico">{erro}</p>}
      </div>

      {sugestao && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Cores lidas do logo: <Amostra cor={sugestao.principal} />{" "}
            <span className="tabular font-mono text-xs">
              {sugestao.principal}
            </span>{" "}
            e <Amostra cor={sugestao.secundaria} />{" "}
            <span className="tabular font-mono text-xs">
              {sugestao.secundaria}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              setPrincipal(sugestao.principal);
              setSecundaria(sugestao.secundaria);
            }}
            className={botao("secundario", "sm")}
          >
            Usar estas cores
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <CampoDeCor
          id="cor-principal"
          rotulo="Cor principal"
          valor={principal}
          onChange={setPrincipal}
          apoio="Cabeçalho do blog, capa do artigo e fundo do carrossel."
        />
        <CampoDeCor
          id="cor-secundaria"
          rotulo="Cor secundária"
          valor={secundaria}
          onChange={setSecundaria}
          apoio="Acento: botão de convite, filete da capa e do carrossel."
        />
      </div>

      {/* Prévia com o mesmo cálculo de contraste que o blog usa. O cliente vê
          o resultado antes de publicar em vez de descobrir depois. */}
      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <div
          className="px-4 py-5 text-center"
          style={{ backgroundColor: principal, color: corTexto }}
        >
          {logo ? (
            <Image
              src={logo}
              alt=""
              width={140}
              height={44}
              unoptimized
              className="mx-auto max-h-11 w-auto object-contain"
            />
          ) : (
            <p className="font-semibold">{blogNome}</p>
          )}
          <p className="mt-3">
            <span
              className="inline-block rounded-lg px-4 py-2 text-sm font-semibold"
              style={{
                backgroundColor: secundaria,
                color: textoSobre(secundaria),
              }}
            >
              {ctaText || "Saber mais"}
            </span>
          </p>
        </div>
      </div>

      {!destacaDoFundo(principal) && (
        <p className="text-sm text-nota-atencao">
          A cor principal é clara demais: o cabeçalho quase some no fundo
          branco do blog. Escolha um tom mais fechado.
        </p>
      )}
    </div>
  );
}
