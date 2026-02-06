import { defineEventHandler, getQuery, getRequestURL } from "h3";
import {
  getAuthSessionIdFromRequest,
  loadAuthSession,
  renderLoginPage,
  sanitizeNextPath,
} from "../utils/auth";
import { tryGetRuntimeEnv } from "../utils/env";

export default defineEventHandler(async (event) => {
  const requestURL = getRequestURL(event);
  const env = tryGetRuntimeEnv(event);

  if (env) {
    const authSessionId = getAuthSessionIdFromRequest(
      (event as { request?: Request; req?: { headers?: unknown } }).request
        ?? (event as { req?: { headers?: unknown } }).req,
    );
    if (authSessionId) {
      const session = await loadAuthSession(env, authSessionId);
      if (session) {
        return Response.redirect(new URL("/", requestURL.origin).toString(), 302);
      }
    }
  }

  const query = getQuery(event);
  const nextPath = sanitizeNextPath(
    typeof query.next === "string" ? query.next : "/",
  );
  const reason = typeof query.reason === "string" ? query.reason.slice(0, 220) : "";

  return new Response(renderLoginPage(reason, nextPath), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
