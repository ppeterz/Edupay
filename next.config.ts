import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin', '@react-pdf/renderer'],
};

export default nextConfig;
