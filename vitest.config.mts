import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// One test runner for the workspace. Tests live beside their code as *.test.ts.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./apps/consumer/src", import.meta.url)),
    },
  },
  test: {
    include: ["apps/*/src/**/*.test.{ts,tsx}", "apps/*/worker/**/*.test.{ts,tsx}", "packages/*/src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
