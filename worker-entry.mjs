import nitroEntry from "./.output/server/index.mjs";

export { Sandbox } from "@cloudflare/sandbox";

const runtime = nitroEntry?.default ?? nitroEntry;

export default {
  async fetch(request, env, ctx) {
    if (typeof runtime?.fetch === "function") {
      return runtime.fetch(request, env, ctx);
    }

    if (typeof runtime === "function") {
      return runtime(request, env, ctx);
    }

    return new Response("Nitro runtime is not ready. Run `pnpm build` first.", {
      status: 500,
    });
  },
  async scheduled(controller, env, ctx) {
    if (typeof runtime?.scheduled === "function") {
      return runtime.scheduled(controller, env, ctx);
    }
  },
};
