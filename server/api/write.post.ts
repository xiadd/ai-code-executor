import { defineEventHandler, readBody } from "h3";
import { getRuntimeEnv } from "../utils/env";
import { buildFileKey, normalizeVirtualPath, resolveSessionId, VFS_ROOT } from "../utils/files";

export default defineEventHandler(async (event) => {
  const env = getRuntimeEnv(event);
  const body = (await readBody<{
    sessionId?: string;
    path?: string;
    content?: string;
  }>(event).catch(() => ({}))) || {};

  if (!body.path) {
    return new Response(JSON.stringify({ success: false, error: "No path" }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const sessionId = resolveSessionId(body.sessionId);

  try {
    const filePath = normalizeVirtualPath(body.path, VFS_ROOT);
    const key = buildFileKey(sessionId, filePath);
    const content = typeof body.content === "string" ? body.content : String(body.content ?? "");

    await env.CODE_BUCKET.put(key, content);

    return {
      success: true,
    };
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to write file",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }
});
