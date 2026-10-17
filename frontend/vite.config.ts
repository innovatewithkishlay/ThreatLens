import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_PROXY_TARGET || "http://localhost:5002";
  return {
    plugins: [react()],
    define: {
      __BUILD__: JSON.stringify((env.RENDER_GIT_COMMIT || process.env.RENDER_GIT_COMMIT || "dev").slice(0, 7)),
    },
    server: {
      port: 5173,
      // The API runs on a separate port in development. Proxying keeps
      // requests same-origin so auth cookies just work.
      proxy: {
        "/api": { target, changeOrigin: false },
      },
    },
    build: {
      chunkSizeWarningLimit: 900,
    },
  };
});
