import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        {/* Aplica el modo oscuro antes del primer paint, evitando el flash
            del tema incorrecto. suppressHydrationWarning en <html> es
            necesario porque este script muta la clase antes de que React
            hidrate. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* Antes havia bg-white com dois dark: conflitantes. O fundo agora vem
          do token, que é papel no claro e tinta no escuro. */}
      <body className="min-h-full flex flex-col bg-background">
        {children}
      </body>
    </html>
  );
}
