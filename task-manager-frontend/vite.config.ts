import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectManifest: {
        swDest: "dist/sw.js",
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
      registerType: "prompt",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
      manifest: {
        name: "Task Flow",
        short_name: "Task Flow",
        description: "AI-Powered Task Management",
        theme_color: "#432dd7",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globIgnores: ["**/sw.js"],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      },
    }),
  ],
});
