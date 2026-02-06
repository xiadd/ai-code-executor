import { defineEventHandler, getQuery, getRequestURL } from "h3";
import { createGithubLoginRedirect, sanitizeNextPath } from "../../utils/auth";
import { getRuntimeEnv } from "../../utils/env";

export default defineEventHandler((event) => {
  const env = getRuntimeEnv(event);
  const requestURL = getRequestURL(event);
  const query = getQuery(event);
  const nextPath = sanitizeNextPath(typeof query.next === "string" ? query.next : "/");

  return createGithubLoginRedirect(requestURL, env, nextPath).response;
});
