import { defineConfig } from "vite";

/**
 * Bundles the Claude Code PreToolUse guard into one file that runs with plain `node` from any directory, so a project
 * being supervised does not need this repository's dependencies installed. Output: dist/guard/claude-hook.js, the path
 * guard/claude-code/settings.json points at. Built after the app (`npm run build`), which empties dist/ first.
 */
export default defineConfig({
  build: {
    ssr: "src/commander/guard/claude-hook.ts",
    outDir: "dist/guard",
    emptyOutDir: false,
    target: "node22",
    minify: false,
    // The hook loads its pieces lazily; inline them, or the output is a file plus a folder that must travel together.
    rollupOptions: { output: { format: "es", entryFileNames: "claude-hook.js", inlineDynamicImports: true } },
  },
  ssr: { noExternal: true },
});
