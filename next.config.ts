import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.2"],

  // Serve modern formats from the built-in Image Optimization API. AVIF is
  // preferred (smaller) with WebP as the fallback; browsers that support
  // neither fall back to the original. Order matters — first Accept match wins.
  images: {
    formats: ["image/avif", "image/webp"],
    // Avatar/post-image uploads (sharp → Vercel Blob, see lib/uploads.ts) live
    // on Blob's own subdomain. The db:seed script assigns pravatar.cc URLs —
    // allow that host so seeded dev data renders through next/image instead of
    // throwing "hostname not configured". OAuth sign-in (Google/Facebook)
    // stores the provider's profile-picture URL verbatim in `users.avatar`, so
    // their photo CDNs need the same allowance. Add other hosts here if the
    // upload pipeline ever stores remote URLs from a new provider.
    remotePatterns: [
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "platform-lookaside.fbsbx.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },

  // Strip the `X-Powered-By: Next.js` response header (no functional value,
  // minor information-leak surface).
  poweredByHeader: false,

  // NOTE: lucide-react is already in Next 16's default optimizePackageImports
  // allowlist, so no explicit entry is needed for icon tree-shaking.
};

export default nextConfig;
