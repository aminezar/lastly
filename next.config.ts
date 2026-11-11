import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The estate routes read data/seed-estate.json at runtime; ship it with them on serverless hosts (Vercel).
  outputFileTracingIncludes: {
    "/heirloom": ["./data/**/*"],
    "/api/estate/*": ["./data/**/*"],
  },
};

export default nextConfig;
