import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, IBM_Plex_Serif } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Três famílias da mesma superfamília Plex (a IBM desenhou as três para
// funcionar juntas), cada uma com um papel só:
// - Sans: toda a interface.
// - Mono: só onde o conteúdo é número lido como instrumento (a nota da
//   auditoria, o score de visibilidade) - nunca frase inteira, mono em
//   sentença longa lê mecânico, sem ritmo.
// - Serif: a frase de veredito que abre cada tela (Lede) e nomes próprios
//   de destaque (o negócio encontrado no Google Meu Negócio) - o papel que
//   a Instrument Serif tinha antes, só que sem o floreio editorial dela.
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

const serif = IBM_Plex_Serif({
  variable: "--font-plex-serif",
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
      className={`${sans.variable} ${mono.variable} ${serif.variable} h-full antialiased`}
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
