import { getSandbox } from "@cloudflare/sandbox";
import { defineEventHandler, readBody } from "h3";
import { getRuntimeEnv } from "../../utils/env";
import { resolveSessionId } from "../../utils/files";
import { ensureSandboxRuntime, markSandboxSessionRunning } from "../../utils/sandbox";

export default defineEventHandler(async (event) => {
  const env = getRuntimeEnv(event);
  const body = (await readBody<{ sessionId?: string }>(event).catch(() => ({}))) || {};
  const sessionId = resolveSessionId(body.sessionId);

  const sandbox = getSandbox(env.Sandbox, sessionId, { normalizeId: true });

  try {
    const runtime = await ensureSandboxRuntime(sandbox, env, sessionId);
    markSandboxSessionRunning(sessionId);

    return {
      success: true,
      running: true,
      mounted: runtime.mounted,
      mountMessage: runtime.mountMessage,
    };
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to start sandbox",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }
});
