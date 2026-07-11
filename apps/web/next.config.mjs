/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The web app imports workspace TS packages directly (no prebuild step).
  transpilePackages: ["@rotation/shared", "@rotation/db", "@rotation/queue"],
  // pg / bullmq must stay external to the server bundle (moved out of
  // `experimental` in Next 15.5). @sentry/node pulls in OpenTelemetry, which
  // uses node: scheme requires webpack can't bundle — keep it external too.
  serverExternalPackages: ["pg", "bullmq", "ioredis", "@sentry/node"],
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
