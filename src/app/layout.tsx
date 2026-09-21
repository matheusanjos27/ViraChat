import type { Metadata } from "next";
import { Newsreader, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "ViraChat — Atendimento com IA no WhatsApp",
  description:
    "IA responde no WhatsApp; o humano assume quando quiser. Central de conversas multi-número.",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${sora.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full font-sans text-ink">
        {children}
      </body>
    </html>
  );
}
