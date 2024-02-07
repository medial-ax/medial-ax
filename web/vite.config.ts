import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react-swc";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [wasm(), react(), topLevelAwait()],
  server: {
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), "../ma-rs/pkg"] },
  },
});
