/// <reference types="vitest/config" />

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  // Pre-bundle the TipTap / ProseMirror graph at server start. Without this,
  // a cold-cache dev server (e.g. a fresh Docker container) only discovers
  // these ESM packages when the TagEditor first mounts inside a modal, then
  // force-reloads the page to optimize them — which tears the editor down
  // before its contentEditable ever renders (TagEditor "fails to mount in
  // Docker"). Listing them forces eager pre-bundling so the mount is stable.
  optimizeDeps: {
    include: [
      "@tiptap/core",
      "@tiptap/react",
      "@tiptap/suggestion",
      "@tiptap/extension-document",
      "@tiptap/extension-paragraph",
      "@tiptap/extension-text",
      "@tiptap/extension-placeholder",
      "@tiptap/extension-history",
      "@tiptap/pm/state",
      "@tiptap/pm/model",
      "@tiptap/pm/view",
    ],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    exclude: ["e2e/**", "node_modules/**"],
  },
});
