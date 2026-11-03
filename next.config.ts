import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `output: 'standalone'` for Docker images — leave off for local `next start`.
  // Avoid SQLite "database is locked" during `next build` page-data collect.
  experimental: { cpus: 1 },
};

export default nextConfig;
