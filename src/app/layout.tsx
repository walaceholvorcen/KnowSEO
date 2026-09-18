import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { headers } from "next/headers";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { CABECALHO_BLOG, resolveBlogByHost } from "@/lib/tenant";
import { localeDoBlog } from "@/lib/idioma";
import "./globals.css";

// Duas famílias da mesma superfamília Plex, papéis separados:
// - Sans: toda a interface, inclusive o veredito que abre cada tela.
// - Mono: só onde o conteúdo é número lido como instrumento (nota, score).
// Serifada saiu de vez do painel: com ela no veredito o produto parecia
// revista - feedback real de usuário - e não ferramenta de medição.
const sans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Know SEO",
  description: "Generación y publicación automática de contenido SEO",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // O único script escrito à mão no app precisa do nonce da CSP. Ler o
  // cabeçalho torna as páginas dinâmicas - e é exigência do nonce, que muda
  // a cada pedido e não existe numa página gerada no build.
  const h = await headers();
  const nonce = h.get("x-nonce") ?? undefined;
  // O painel é em português; o blog, na língua do cliente. Antes tudo saía
  // "es" - painel em português e blog brasileiro declarados como espanhol
  // para o Google e para o leitor de tela.
  const hostDoBlog = h.get(CABECALHO_BLOG);
  const blog = hostDoBlog ? await resolveBlogByHost(hostDoBlog) : null;
  const lang = blog ? localeDoBlog(blog) : "pt-BR";

  return (
    <html
      lang={lang}
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        {/* Aplica el modo oscuro antes del primer paint, evitando el flash
            del tema incorrecto. suppressHydrationWarning en <html> es
            necesario porque este script muta la clase antes de que React
            hidrate. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* Antes havia bg-white com dois dark: conflitantes. O fundo agora vem
          do token, que é papel no claro e tinta no escuro. */}
      <body className="min-h-full flex flex-col bg-background">
        {children}
      </body>
    </html>
  );
}
