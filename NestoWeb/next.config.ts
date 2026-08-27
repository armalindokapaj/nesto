import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Document Passport uploads (PRD_18 §12) send real file bytes through a
    // Server Action; the framework default (1MB) is too small for a scan/
    // drawing. See node_modules/next/dist/docs/01-app/02-guides/server-actions.md.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Phase 3 Track B — next.config.ts previously set no security headers at all.
  // Vercel supplies HSTS, but clickjacking protection and CSP are not on by
  // default and were not set here.
  //
  // What this CSP is honest about: script-src and style-src carry
  // 'unsafe-inline', because Next injects inline bootstrap script and style,
  // and the nonce-based alternative in Next's own CSP guide requires dynamic
  // rendering on EVERY page to generate a per-request nonce — a real cost for
  // the statically-rendered marketing routes. So this is NOT XSS mitigation.
  //
  // What it does buy, and these are not nothing: frame-ancestors blocks
  // clickjacking (the gap named in the finding), object-src blocks plugin-based
  // injection, base-uri blocks <base> tag hijacking of every relative URL, and
  // form-action stops an injected form posting credentials to another origin.
  // connect-src/img-src keep exfiltration and beacon loading same-origin.
  //
  // Upgrading to nonces is a deliberate follow-up with a known cost, not an
  // oversight.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Redundant with frame-ancestors for modern browsers, kept for older ones.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // This app asks for none of these; denying them removes the prompt entirely.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
    ];
  },
  // Sign-in lives at "/" (the landing page), not a dedicated route — alias
  // the URLs people naturally guess so they don't hit a 404.
  async redirects() {
    return [
      { source: "/login", destination: "/", permanent: false },
      { source: "/signin", destination: "/", permanent: false },
      { source: "/sign-in", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
