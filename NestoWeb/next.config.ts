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
