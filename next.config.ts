import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(process.env.PLAYWRIGHT === '1' ? { distDir: '.next-playwright' } : {}),
};

export default nextConfig;
