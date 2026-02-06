import { defineEventHandler } from "h3";
import type { AuthSession } from "../../utils/auth";
import { tryGetRuntimeEnv } from "../../utils/env";

export default defineEventHandler((event) => {
  const session = (event.context as { authSession?: AuthSession }).authSession || null;
  const env = tryGetRuntimeEnv(event);
  const backendReady = Boolean(env && (env as { CODE_BUCKET?: unknown }).CODE_BUCKET);

  return {
    success: true,
    backendReady,
    user: session?.user || null,
  };
});
