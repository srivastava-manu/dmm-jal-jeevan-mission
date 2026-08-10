import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy the API so the browser sees one origin — the session cookie is same-origin
    // and no CORS is needed. The browser never talks to Postgres, only to /api.
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
