import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    // The database tests are slow and have their own config: vitest.db.config.ts.
    include: ["tests/*.test.ts"],
  },
});
