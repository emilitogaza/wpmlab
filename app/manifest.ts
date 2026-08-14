import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "wpmlab",
    short_name: "wpmlab",
    description: "A typing-speed practice tool. Exact mode, live stats, and a per-second breakdown of every run.",
    start_url: "/",
    display: "standalone",
    // neutral-50, the light page fill — a manifest can only carry one static
    // colour, so the splash matches the light theme.
    background_color: "#faf9fc",
    theme_color: "#faf9fc",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
