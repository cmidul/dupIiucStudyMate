/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Image solving can wait on vision extraction followed by text generation.
    proxyTimeout: 240_000,
  },
  async rewrites() {
    const backendApi = (process.env.STUDYMATE_BACKEND_API_URL || "http://127.0.0.1:8000/api/v1").replace(/\/+$/, "");
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendApi}/:path*`,
      },
    ];
  },
};

module.exports = (phase) => ({
  ...nextConfig,
  // Keep production builds from replacing files used by a running dev server.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
});

const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");

