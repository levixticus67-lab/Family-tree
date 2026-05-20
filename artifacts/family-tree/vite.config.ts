import { defineConfig } from "vite";
  import react from "@vitejs/plugin-react";
  import tailwindcss from "@tailwindcss/vite";
  import path from "path";
  import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

  // PORT is only needed for the dev/preview server, not for `vite build`.
  // Default to 3000 so external CI (Firebase, Netlify, etc.) can build without it.
  const rawPort = process.env.PORT;
  const port = rawPort ? Number(rawPort) : 3000;

  // BASE_PATH controls the Vite `base` and is baked into import.meta.env.BASE_URL.
  // Default to "/" so production builds at root domains work correctly.
  // Replit workflows set this to the artifact path (e.g. /family-tree/).
  const basePath = process.env.BASE_PATH ?? "/";

  export default defineConfig({
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      runtimeErrorOverlay(),
      ...(process.env.NODE_ENV !== "production" &&
      process.env.REPL_ID !== undefined
        ? [
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer({
                root: path.resolve(import.meta.dirname, ".."),
              }),
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  });
  