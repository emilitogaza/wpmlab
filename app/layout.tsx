import type { Metadata } from "next";
import { JetBrains_Mono, Mona_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const monaSans = Mona_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  axes: ["wdth"],
});

// The typing surface has to be monospaced or the caret shifts as characters
// resolve; JetBrains Mono also disambiguates l/1/I and 0/O, which matters once
// a test includes numbers.
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "wpmlab",
  description: "A typing-speed practice tool. Exact mode, live stats, and a per-second breakdown of every run.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${monaSans.variable} ${jetBrainsMono.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
