import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  reactStrictMode: true,
  
  images: {
    remotePatterns: [],
  },
  
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },
};

export default nextConfig;

