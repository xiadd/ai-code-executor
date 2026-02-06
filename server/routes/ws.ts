import { getSandbox } from "@cloudflare/sandbox";
import {
  createError,
  defineEventHandler,
  getHeader,
  getQuery,
} from "h3";
import { getRuntimeEnv } from "../utils/env";
import { resolveSessionId } from "../utils/files";
import { ensureSandboxRuntime, markSandboxSessionRunning } from "../utils/sandbox";

export default defineEventHandler(async (event) => {
  const request =
    (event as { request?: Request; req?: Request }).request
    ?? (event as { req?: Request }).req;
  if (!request) {
    throw createError({ statusCode: 400, statusMessage: "Missing request object" });
  }

  const upgrade = (getHeader(event, "upgrade") || "").toLowerCase();
  if (upgrade !== "websocket") {
    throw createError({ statusCode: 400, statusMessage: "Expected websocket" });
  }

  const env = getRuntimeEnv(event);
  const query = getQuery(event);
  const sessionId = resolveSessionId(
    typeof query.session === "string" ? query.session : undefined,
    `term-${Date.now()}`,
  );

  const sandbox = getSandbox(env.Sandbox, sessionId, { normalizeId: true });

  try {
    await ensureSandboxRuntime(sandbox, env, sessionId);
    markSandboxSessionRunning(sessionId);
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to start sandbox terminal",
    });
  }

  return sandbox.wsConnect(request, 9000);
});
