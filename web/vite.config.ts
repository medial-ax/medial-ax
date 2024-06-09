import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react-swc";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import svgr from "vite-plugin-svgr";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/ma/",
  plugins: [
    wasm(),
    react(),
    topLevelAwait(),
    svgr({
      include: ["**/*.svg", "**/*.svg?react"],
      exclude: ["**/*.svg?raw"],
    }),
  ],
  server: {
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), "../ma-rs/pkg"] },
  },
  worker: {
    format: "es",
  },
  build: {
    rollupOptions: {
      output: { format: "es" },
    },
  },
});
