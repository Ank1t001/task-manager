import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "https://main.task-manager-prod.pages.dev",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
