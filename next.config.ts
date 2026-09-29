import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the repository's maintained AGENTS.md intact during local previews.
  agentRules: false,
  async headers() {
    return ['/join', '/invites', '/api/invites'].map(source => ({ source, headers: [
      { key: 'Cache-Control', value: 'no-store' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ] }));
  },
  async rewrites() {
    return process.env.RDD_VISUAL_FIXTURE === '1'
      ? [{ source: '/visual-api/:path*', destination: 'http://127.0.0.1:54321/:path*' }]
      : [];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "github.com",
        pathname: "/user-attachments/assets/**",
      },
      {
        protocol: "https",
        hostname: "user-images.githubusercontent.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
