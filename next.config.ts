import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep production builds away from the live dev server cache. Running
  // `next build` while `next dev` is open can otherwise corrupt `.next`.
  distDir: process.env.NODE_ENV === "development" ? ".next" : ".next-build",
};

export default nextConfig;
