import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Duas famílias, papéis separados: a sans carrega a interface inteira, a
// serifada aparece só onde o número é o produto (a nota da auditoria, o
// score de visibilidade). Nada de serifada como enfeite em título de card.
const sans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const display = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
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
