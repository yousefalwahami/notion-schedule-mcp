import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Vercel deployment with pdf-parse
  serverExternalPackages: ["pdf-parse", "mammoth", "@napi-rs/canvas"],
};

export default nextConfig;
