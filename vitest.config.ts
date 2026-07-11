import { defineConfig } from "vitest/config";

// Unit tests across the monorepo. These cover pure logic only (filtergraph
// building, aspect/reframe rules, fan-out pairing, HDR + rotation detection,
// slugging, tenant scoping) so CI needs no Postgres/Redis/R2/ffmpeg.
export default defineConfig({
  test: {
    include: [
      "packages/**/*.test.ts",
      "apps/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
    environment: "node",
  },
});
