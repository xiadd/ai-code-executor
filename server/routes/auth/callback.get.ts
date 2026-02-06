import { defineEventHandler, getRequestURL } from "h3";
import { completeGithubCallback } from "../../utils/auth";
import { getRuntimeEnv } from "../../utils/env";

export default defineEventHandler(async (event) => {
  const env = getRuntimeEnv(event);
  const requestURL = getRequestURL(event);
  return completeGithubCallback(
    (event as { request?: Request; req?: { headers?: unknown } }).request
      ?? (event as { req?: { headers?: unknown } }).req,
    requestURL,
    env,
  );
});
