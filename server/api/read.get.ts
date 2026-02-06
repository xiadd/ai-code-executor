import { defineEventHandler, getQuery } from "h3";
import { getRuntimeEnv } from "../utils/env";
import { buildFileKey, normalizeVirtualPath, resolveSessionId, VFS_ROOT } from "../utils/files";

export default defineEventHandler(async (event) => {
  const env = getRuntimeEnv(event);
  const query = getQuery(event);
  const sessionId = resolveSessionId(
    typeof query.session === "string" ? query.session : undefined,
  );
  const rawPath = typeof query.path === "string" ? query.path : "";

  if (!rawPath) {
    return new Response(JSON.stringify({ success: false, error: "No path" }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  try {
    const filePath = normalizeVirtualPath(rawPath, VFS_ROOT);
    const key = buildFileKey(sessionId, filePath);
    const object = await env.CODE_BUCKET.get(key);

    if (!object) {
      return new Response(JSON.stringify({ success: false, error: "File not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const content = await object.text();
    return {
      success: true,
      content,
    };
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to read file",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }
});
