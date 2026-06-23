/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@volga/shared", "@volga/game-core"],
};

export default nextConfig;