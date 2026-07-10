import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import { getContext } from "@/lib/context";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rotation",
  description: "Drop clips, pick hooks, download ready-to-post Reels.",
};

// Sets data-theme before paint from the server value, else localStorage /
// prefers-color-scheme — avoids a theme flash on load.
const noFlashScript = `(function(){try{var el=document.documentElement;var t=el.getAttribute('data-theme');if(!t){var ls=localStorage.getItem('rotation-theme');t=ls||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');el.setAttribute('data-theme',t);}}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Theme preference follows the user across devices (stored on the user row).
  let theme: string | undefined;
  try {
    const ctx = await getContext();
    theme = ctx?.user.theme_preference ?? undefined;
  } catch {
    theme = undefined;
  }

  return (
    <ClerkProvider>
      <html
        lang="en"
        data-theme={theme}
        className={`${display.variable} ${body.variable} ${mono.variable}`}
        suppressHydrationWarning
      >
        <head>
          <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
        </head>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
