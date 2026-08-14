import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // let a second machine on the LAN hit the dev server (for testing races) —
  // Next blocks cross-origin dev assets by default and the page never hydrates.
  // Dev only, no effect on production builds.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.*.*.*", "172.16.*.*", "*.local"],
};

export default nextConfig;
