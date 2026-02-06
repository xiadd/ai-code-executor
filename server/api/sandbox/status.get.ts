import { defineEventHandler, getQuery } from "h3";
import { resolveSessionId } from "../../utils/files";
import { isSandboxSessionRunning } from "../../utils/sandbox";

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const sessionId = resolveSessionId(
    typeof query.session === "string" ? query.session : undefined,
  );

  return {
    success: true,
    running: isSandboxSessionRunning(sessionId),
  };
});
