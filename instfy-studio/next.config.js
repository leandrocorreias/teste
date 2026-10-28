// Serving under a sub-path of another site (e.g. instfy.com/comercial) requires
// basePath at BUILD time; it cannot be switched at runtime.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  reactStrictMode: true,
  // The repository root holds an unrelated lockfile; pin tracing to this app.
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ['playwright', 'playwright-core', '@prisma/client'],
  eslint: { ignoreDuringBuilds: false },
};
module.exports = nextConfig;
