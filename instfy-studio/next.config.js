/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The repository root holds an unrelated lockfile; pin tracing to this app.
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ['playwright', 'playwright-core', '@prisma/client'],
  eslint: { ignoreDuringBuilds: false },
};
module.exports = nextConfig;
