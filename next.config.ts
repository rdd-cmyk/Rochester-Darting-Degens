import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
