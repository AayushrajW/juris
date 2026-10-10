import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The database tests start a real Postgres (PGlite) inside Node, which is slow,
// so they run on their own: `npm run test:db`. See db/ and tests/db/.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
