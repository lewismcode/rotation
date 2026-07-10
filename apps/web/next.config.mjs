/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The web app imports workspace TS packages directly (no prebuild step).
  transpilePackages: ["@rotation/shared", "@rotation/db", "@rotation/queue"],
  experimental: {
    // pg / bullmq must stay external to the server bundle.
    serverComponentsExternalPackages: ["pg", "bullmq", "ioredis"],
  },
  webpack(config) {
    // Workspace packages use ESM-style ".js" specifiers that actually point at
    // ".ts" source. Let webpack resolve them the way tsc (Bundler) does.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
