import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.2"],

  // Serve modern formats from the built-in Image Optimization API. AVIF is
  // preferred (smaller) with WebP as the fallback; browsers that support
  // neither fall back to the original. Order matters — first Accept match wins.
  images: {
    formats: ["image/avif", "image/webp"],
    // Production avatars are local (sharp → public/Assets/Uploads), but the
    // db:seed script assigns pravatar.cc URLs — allow that host so seeded dev
    // data renders through next/image instead of throwing "hostname not
    // configured". Add other avatar hosts here if the upload pipeline ever
    // stores remote URLs.
    remotePatterns: [{ protocol: "https", hostname: "i.pravatar.cc" }],
  },

  // Strip the `X-Powered-By: Next.js` response header (no functional value,
  // minor information-leak surface).
  poweredByHeader: false,

  // NOTE: lucide-react is already in Next 16's default optimizePackageImports
  // allowlist, so no explicit entry is needed for icon tree-shaking.
};

export default nextConfig;
