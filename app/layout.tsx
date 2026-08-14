import type { Metadata } from "next";
import { Mona_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// The one and only typeface. Numbers stay width-stable everywhere because the
// base styles apply tabular figures globally (font-variant-numeric on body) —
// without that, Mona Sans digits are strongly proportional (a "1" is ~40%
// narrower than an "8") and every live readout would jitter as values tick.
const monaSans = Mona_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "wpmlab",
  description: "A typing-speed practice tool. Exact mode, live stats, and a per-second breakdown of every run.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${monaSans.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
