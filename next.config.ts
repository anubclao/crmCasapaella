import type { NextConfig } from "next";

/**
 * Next.js config for Casa Paella CRM.
 *
 * Workarounds for Hostinger Shared hosting (applies to any shared Node.js host
 * that uses a reverse proxy in front of the Node server):
 *
 *  1. `output: "standalone"` — bundles only what's needed into `.next/standalone`,
 *     cutting deploy size by ~70%. Required for Hostinger Shared.
 *
 *  2. `outputFileTracingIncludes` — Windows + Node 24 standalone sometimes drops
 *     webpack runtime chunks (bundle5.js). Force them in.
 *
 *  3. `headers()` — Hostinger's reverse proxy serves `_next/static/*` JS as
 *     `text/plain` → Chrome's strict MIME check rejects execution → blank page.
 *     Force the correct Content-Type here.
 */
const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,

  // Baileys uses native WebSocket bindings (bufferutil/utf-8-validate) that
  // Next.js's webpack bundler cannot resolve. Keep it external so it requires
  // the native module at runtime.
  serverExternalPackages: [
    "@whiskeysockets/baileys",
    "libsignal",
    "sharp",
    "detect-libc",
    "iconv-lite",
    "mysql2",
    "bcryptjs",
  ],

  outputFileTracingIncludes: {
    "**/*": ["./node_modules/next/dist/compiled/webpack/**/*"],
  },

  // `sharp` (used by Next Image optimization) tries to import `child_process`
  // from a browser-bound chunk. Force webpack to ignore it on the client.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        sharp: false,
        "detect-libc": false,
        "iconv-lite": false,
        mysql2: false,
        bcryptjs: false,
        libsignal: false,
        "string_decoder": false,
        "audio-decode": false,
        "link-preview-js": false,
        "node:module": false,
        "node:url": false,
        "node:path": false,
        "node:fs": false,
        "node:crypto": false,
        crypto: false,
      };
    }
    return config;
  },

  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/_next/static/:path*.css",
        headers: [
          { key: "Content-Type", value: "text/css; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // API routes: disable cache, force JSON
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },

  // Allow the Baileys WS / WhatsApp Webhook to receive large payloads
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
