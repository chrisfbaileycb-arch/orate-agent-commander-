import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ["src/**/*.test.{ts,tsx}"],
      // The engine's end-to-end suites start real servers and run the real hook as a subprocess.
      testTimeout: 15_000,
      hookTimeout: 30_000,
    },
  }),
);
