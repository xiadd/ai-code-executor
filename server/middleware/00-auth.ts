import { defineEventHandler, getRequestURL } from "h3";
import { assertAuthenticatedRequest } from "../utils/auth";
import { tryGetRuntimeEnv } from "../utils/env";

const isLocalDevHost = (hostname: string): boolean =>
  hostname === "localhost"
  || hostname === "127.0.0.1"
  || hostname === "0.0.0.0"
  || hostname.endsWith(".localhost");

export default defineEventHandler(async (event) => {
  const env = tryGetRuntimeEnv(event);
  if (!env) {
    return;
  }
  // In plain `vite dev` the Cloudflare proxy can be stubbed and provide no bindings.
  // Skip auth middleware in that case so UI development still works.
  if (!(env as { CODE_BUCKET?: unknown }).CODE_BUCKET) {
    return;
  }

  const requestURL = getRequestURL(event);
  // Local development only: bypass login so APIs/pages are directly usable.
  if (isLocalDevHost(requestURL.hostname)) {
    return;
  }

  const auth = await assertAuthenticatedRequest(
    (event as { request?: Request; req?: { headers?: unknown } }).request
      ?? (event as { req?: { headers?: unknown } }).req,
    requestURL,
    env,
  );

  if (auth.response) {
    return auth.response;
  }

  if (auth.session) {
    (event.context as { authSession?: unknown }).authSession = auth.session;
  }
});
