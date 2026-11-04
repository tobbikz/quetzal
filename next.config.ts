import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Docker image (Dockerfile sets DOCKER_BUILD=1). Local `next start` stays non-standalone.
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' as const } : {}),
  // Avoid SQLite "database is locked" during `next build` page-data collect.
  experimental: { cpus: 1 },
};

export default nextConfig;
