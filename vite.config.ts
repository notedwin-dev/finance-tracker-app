/// <reference types="vitest" />
import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://sheets.googleapis.com https://www.googleapis.com https://api.coingecko.com https://api.data.gov.my https://overpass-api.de https://generativelanguage.googleapis.com http://localhost:3001; frame-src https://accounts.google.com https://*.googleusercontent.com;",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
        manifest: {
          name: "ZenFinance Tracker",
          short_name: "ZenFinance",
          description:
            "Private AI-powered finance tracker with Google Sheets storage.",
          theme_color: "#6366f1",
          background_color: "#0f172a",
          display: "standalone",
          icons: [
            {
              src: "/images/ZenFinance.svg",
              sizes: "192x192",
              type: "image/svg+xml",
              purpose: "any",
            },
            {
              src: "/images/ZenFinance.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "any",
            },
            {
              src: "/images/ZenFinance.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "maskable",
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test-setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
    },
  };
});
