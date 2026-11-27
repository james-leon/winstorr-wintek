import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

// Standalone TanStack Start config (Lovable wrapper removed).
// Nitro auto-detects the deploy platform (Vercel sets VERCEL at build time).
export default defineConfig({
  server: { host: "0.0.0.0", port: 8080, strictPort: false },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({ server: { entry: "./src/server.ts" } }),
    viteReact(),
  ],
});
