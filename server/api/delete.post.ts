import { defineEventHandler, readBody } from "h3";
import { getRuntimeEnv } from "../utils/env";
import {
  buildFileKey,
  listAllKeysWithPrefix,
  normalizeVirtualPath,
  resolveSessionId,
  VFS_ROOT,
} from "../utils/files";

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
    const targetPath = normalizeVirtualPath(body.path, VFS_ROOT);
    if (targetPath === VFS_ROOT) {
      return new Response(JSON.stringify({ success: false, error: "Cannot delete root path" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const baseKey = buildFileKey(sessionId, targetPath);
    const keys = new Set<string>([baseKey, `${baseKey}/.keep`]);

    const nested = await listAllKeysWithPrefix(env.CODE_BUCKET, `${baseKey}/`);
    for (const key of nested) {
      keys.add(key);
    }

    const targets = Array.from(keys).filter(Boolean);
    if (targets.length > 0) {
      await env.CODE_BUCKET.delete(targets);
    }

    return {
      success: true,
    };
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete path",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }
});
