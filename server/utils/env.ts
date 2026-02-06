import { createError, type H3Event } from "h3";
import type { Sandbox } from "@cloudflare/sandbox";

export type RuntimeEnv = {
  Sandbox: DurableObjectNamespace<Sandbox>;
  CODE_BUCKET: R2Bucket;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_ALLOWED_ORG?: string;
  GITHUB_ALLOWED_TEAM?: string;
  R2_BUCKET_NAME?: string;
  R2_S3_ENDPOINT?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
};

export const tryGetRuntimeEnv = (event: H3Event): RuntimeEnv | null => {
  const contextCloudflare = (event.context as { cloudflare?: { env?: RuntimeEnv } }).cloudflare;
  if (contextCloudflare?.env) {
    return contextCloudflare.env;
  }

  const reqRuntime = (event as { req?: { runtime?: { cloudflare?: { env?: RuntimeEnv } } } }).req?.runtime;
  if (reqRuntime?.cloudflare?.env) {
    return reqRuntime.cloudflare.env;
  }

  const globalEnv = (globalThis as { __env__?: RuntimeEnv }).__env__;
  if (globalEnv) {
    return globalEnv;
  }

  return null;
};

export const getRuntimeEnv = (event: H3Event): RuntimeEnv => {
  const env = tryGetRuntimeEnv(event);
  if (!env) {
    throw createError({
      statusCode: 500,
      statusMessage: "Cloudflare bindings unavailable. Use wrangler dev/deploy.",
    });
  }
  return env;
};
