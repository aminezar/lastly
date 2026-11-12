import type { NextConfig } from "next";

// Set on an old host after the demo moves to a new address, e.g. LASTLY_MOVED_TO=https://new.onrender.com,
// so every old link (and the PayPal return URLs) lands on the new one.
const movedTo = process.env.LASTLY_MOVED_TO?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  // The estate routes read data/seed-estate.json at runtime; ship it with them on serverless hosts (Vercel).
  outputFileTracingIncludes: {
    "/estate": ["./data/**/*"],
    "/api/estate/*": ["./data/**/*"],
  },
  async redirects() {
    if (movedTo) {
      return [{ source: "/:path*", destination: `${movedTo}/:path*`, permanent: false }];
    }
    // The executor portal used to live at /heirloom; old links and bookmarks still work.
    return [{ source: "/heirloom", destination: "/estate", permanent: true }];
  },
};

export default nextConfig;
