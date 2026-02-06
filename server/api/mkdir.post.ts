import { defineEventHandler, readBody } from "h3";
import { getRuntimeEnv } from "../utils/env";
import { buildFileKey, normalizeVirtualPath, resolveSessionId, VFS_ROOT } from "../utils/files";

export default defineEventHandler(async (event) => {
  const env = getRuntimeEnv(event);
  const body = (await readBody<{ sessionId?: string; path?: string }>(event).catch(() => ({}))) || {};

  if (!body.path) {
    return new Response(JSON.stringify({ success: false, error: "No path" }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const sessionId = resolveSessionId(body.sessionId);

  try {
    const folderPath = normalizeVirtualPath(body.path, VFS_ROOT);
    if (folderPath === VFS_ROOT) {
      return { success: true };
    }

    const folderKey = `${buildFileKey(sessionId, folderPath)}/.keep`;
    await env.CODE_BUCKET.put(folderKey, "");

    return {
      success: true,
    };
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create folder",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }
});
