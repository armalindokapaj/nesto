import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
