export const WORKSPACE_ROOT = "/workspace";
export const VFS_ROOT = "/";
export const SESSION_OBJECT_ROOT = "sessions";

export const resolveSessionId = (
  raw: string | null | undefined,
  fallback = "default",
): string => (raw && raw.trim() ? raw.trim() : fallback);

export const normalizeVirtualPath = (
  rawPath: string | null | undefined,
  fallback = VFS_ROOT,
): string => {
  const input = rawPath && rawPath.trim() ? rawPath.trim() : fallback;
  const absolute = input.replace(/\\/g, "/").startsWith("/")
    ? input.replace(/\\/g, "/")
    : `/${input.replace(/\\/g, "/")}`;

  const segments: string[] = [];

  for (const part of absolute.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      segments.pop();
      continue;
    }
    segments.push(part);
  }

  return segments.length ? `/${segments.join("/")}` : VFS_ROOT;
};

export const toRelativePath = (path: string): string =>
  path === VFS_ROOT ? "" : path.replace(/^\//, "");

export const getSessionPrefix = (sessionId: string): string =>
  `${SESSION_OBJECT_ROOT}/${sessionId}`;

export const getDirectoryPrefix = (sessionId: string, directoryPath: string): string => {
  const relativePath = toRelativePath(directoryPath);
  const sessionPrefix = getSessionPrefix(sessionId);
  return relativePath ? `${sessionPrefix}/${relativePath}/` : `${sessionPrefix}/`;
};

export const buildFileKey = (sessionId: string, filePath: string): string => {
  const relativePath = toRelativePath(filePath);
  if (!relativePath) {
    throw new Error("Path points to root directory");
  }
  return `${getSessionPrefix(sessionId)}/${relativePath}`;
};

export const decodeObjectPath = (
  sessionId: string,
  key: string,
): { name: string; path: string } | null => {
  const sessionPrefix = `${getSessionPrefix(sessionId)}/`;
  if (!key.startsWith(sessionPrefix)) return null;

  const relativePath = key.slice(sessionPrefix.length);
  if (!relativePath || relativePath === ".keep") return null;

  const slashIndex = relativePath.lastIndexOf("/");
  const name = slashIndex >= 0 ? relativePath.slice(slashIndex + 1) : relativePath;

  return { name, path: `/${relativePath}` };
};

export const listAllKeysWithPrefix = async (
  bucket: R2Bucket,
  prefix: string,
): Promise<string[]> => {
  const keys: string[] = [];
  let cursor: string | undefined;

  do {
    const listed = await bucket.list({ prefix, cursor });
    keys.push(...listed.objects.map((object) => object.key));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  return keys;
};
