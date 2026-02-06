import { defineEventHandler, getQuery } from "h3";
import { getRuntimeEnv } from "../utils/env";
import {
  buildFileKey,
  decodeObjectPath,
  getDirectoryPrefix,
  normalizeVirtualPath,
  resolveSessionId,
  VFS_ROOT,
} from "../utils/files";

export default defineEventHandler(async (event) => {
  const env = getRuntimeEnv(event);
  const query = getQuery(event);
  const sessionId = resolveSessionId(
    typeof query.session === "string" ? query.session : undefined,
  );

  try {
    const directoryPath = normalizeVirtualPath(
      typeof query.path === "string" ? query.path : undefined,
      VFS_ROOT,
    );
    const prefix = getDirectoryPrefix(sessionId, directoryPath);

    const listed = await env.CODE_BUCKET.list({
      prefix,
      delimiter: "/",
    });

    const directories = (listed.delimitedPrefixes || []).map((folderPrefix) => {
      const name = folderPrefix.slice(prefix.length).replace(/\/$/, "");
      const path = directoryPath === "/" ? `/${name}` : `${directoryPath}/${name}`;

      return {
        name,
        path,
        type: "directory" as const,
        size: "-",
        modified: "",
      };
    });

    const files = listed.objects
      .map((obj) => decodeObjectPath(sessionId, obj.key))
      .filter((item): item is { name: string; path: string } => Boolean(item))
      .filter((item) => {
        const expectedPrefix = directoryPath === "/" ? "/" : `${directoryPath}/`;
        const relative = item.path.slice(expectedPrefix.length);
        return !relative.includes("/") && item.name !== ".keep";
      })
      .map((item) => {
        const objectKey = buildFileKey(sessionId, item.path);
        const object = listed.objects.find((entry) => entry.key === objectKey);

        return {
          name: item.name,
          path: item.path,
          type: "file" as const,
          size: object ? String(object.size) : "0",
          modified: object?.uploaded ? object.uploaded.toISOString() : "",
        };
      });

    const merged = [...directories, ...files].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      success: true,
      files: merged,
    };
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to list files",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }
});
