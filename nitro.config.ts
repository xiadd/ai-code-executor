import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  preset: "cloudflare_module",
  compatibilityDate: "2025-07-15",
  experimental: {
    websocket: true,
  },
  cloudflare: {
    nodeCompat: true,
    dev: {
      // Avoid Wrangler containers assertion in `vite dev`.
      configPath: "./wrangler.dev.jsonc",
    },
  },
});
