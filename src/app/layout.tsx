import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Duas famílias, papéis separados: a sans carrega a interface inteira, a
// mono aparece só onde o número é o produto (a nota da auditoria, o score
// de visibilidade) - lida como instrumento (radar, medidor), não como
// manchete de revista. É por isso que trocamos a Instrument Serif: ela
// carregava floreio editorial que destoava de um produto que existe para
// medir coisa.
const sans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const display = IBM_Plex_Mono({
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
      className={`${sans.variable} ${display.variable} h-full antialiased`}
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
