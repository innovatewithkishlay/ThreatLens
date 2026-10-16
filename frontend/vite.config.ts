import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_PROXY_TARGET || "http://localhost:5002";
  return {
    plugins: [react()],
    server: {
      port: 5173,
      // The API runs on a separate port in development. Proxying keeps
      // requests same-origin so auth cookies just work.
      proxy: {
        "/api": { target, changeOrigin: false },
        "/auth": { target, changeOrigin: false },
      },
    },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            charts: ["recharts"],
            d3: ["d3", "topojson-client"],
            motion: ["framer-motion"],
          },
        },
      },
    },
  };
});
