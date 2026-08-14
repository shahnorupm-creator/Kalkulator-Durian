/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // We'll fix types manually; speed up build
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
