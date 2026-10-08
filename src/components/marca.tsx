import Image from "next/image";
import { cn } from "@/lib/utils";

// O logotipo oficial do Ranknow: a palavra inteira, com o "o" de Now virando
// um círculo âmbar. São os arquivos do site institucional (ranknow.es), não
// uma reconstrução nossa - redesenhar marca é como se acaba com duas marcas
// parecidas e nenhuma certa.
//
// Isto substitui o logotipo anterior, que era vetor desenhado à mão (o "K" de
// Know com uma lâmina atravessando a haste) e vinha com a Montserrat Black
// itálica carregada em TODA página só para escrever "NOW SEO". Com a imagem,
// essa fonte saiu do produto: uma requisição a menos por página.
//
// Duas versões, porque o fundo mudar de cor não muda a tinta de um PNG:
// - `ranknow.png`         tinta escura, para fundo claro
// - `ranknow-branco.png`  branca, para fundo escuro
//
// Nota sobre a paleta (PROCESSO 15): o âmbar do logotipo é o mesmo espectro
// que o painel usa para dizer "atenção" num dado. Convivem porque o logotipo
// mora sempre no mesmo lugar (topo da barra e da porta de entrada), onde
// ninguém procura leitura de instrumento.

/** Proporção do arquivo oficial: 632 × 111. */
const LARGURA = 632;
const ALTURA = 111;

export function Logotipo({
  className,
  claro = false,
}: {
  className?: string;
  /** Força a versão branca. Use em superfície escura nos dois temas - é o
   *  caso da coluna da marca no login, que é escura por identidade e não
   *  por tema. */
  claro?: boolean;
}) {
  // A altura vem do font-size do container (text-base, text-xl...), como no
  // logotipo antigo - quem usa continua escrevendo `className="text-xl"`.
  const medida = "h-[1.15em] w-auto";

  if (claro) {
    return (
      <span role="img" aria-label="Ranknow" className={cn("block", className)}>
        <Image
          src="/marca/ranknow-branco.png"
          alt=""
          width={LARGURA}
          height={ALTURA}
          priority
          className={medida}
        />
      </span>
    );
  }

  return (
    <span role="img" aria-label="Ranknow" className={cn("block", className)}>
      <Image
        src="/marca/ranknow.png"
        alt=""
        width={LARGURA}
        height={ALTURA}
        priority
        className={cn(medida, "dark:hidden")}
      />
      <Image
        src="/marca/ranknow-branco.png"
        alt=""
        width={LARGURA}
        height={ALTURA}
        priority
        className={cn(medida, "hidden dark:block")}
      />
    </span>
  );
}
