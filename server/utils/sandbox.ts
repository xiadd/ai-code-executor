import type { Sandbox } from "@cloudflare/sandbox";
import type { RuntimeEnv } from "./env";
import { WORKSPACE_ROOT, getSessionPrefix } from "./files";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const activeSandboxSessions = new Set<string>();
const mountedSandboxSessions = new Set<string>();

const getMountConfig = (env: RuntimeEnv): { bucketName: string; endpoint: string } | null => {
  const bucketName = (env.R2_BUCKET_NAME || "").trim();
  const endpoint = (env.R2_S3_ENDPOINT || "").trim() || (
    (env.R2_ACCOUNT_ID || "").trim()
      ? `https://${(env.R2_ACCOUNT_ID || "").trim()}.r2.cloudflarestorage.com`
      : ""
  );

  if (!bucketName || !endpoint) {
    return null;
  }

  return { bucketName, endpoint };
};

export const isSandboxSessionRunning = (sessionId: string): boolean =>
  activeSandboxSessions.has(sessionId);

export const markSandboxSessionRunning = (sessionId: string): void => {
  activeSandboxSessions.add(sessionId);
};

export const clearSandboxSession = (sessionId: string): void => {
  activeSandboxSessions.delete(sessionId);
  mountedSandboxSessions.delete(sessionId);
};

const ensureBucketMounted = async (
  sandbox: Sandbox,
  env: RuntimeEnv,
  sessionId: string,
): Promise<{ mounted: boolean; message?: string }> => {
  if (mountedSandboxSessions.has(sessionId)) {
    return { mounted: true };
  }

  const mountConfig = getMountConfig(env);
  if (!mountConfig) {
    return {
      mounted: false,
      message: "missing R2 mount vars (R2_BUCKET_NAME / R2_S3_ENDPOINT)",
    };
  }

  const options: {
    endpoint: string;
    provider: "r2";
    prefix: string;
    credentials?: {
      accessKeyId: string;
      secretAccessKey: string;
    };
  } = {
    endpoint: mountConfig.endpoint,
    provider: "r2",
    prefix: `/${getSessionPrefix(sessionId)}`,
  };

  if (env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY) {
    options.credentials = {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    };
  }

  try {
    await sandbox.mountBucket(mountConfig.bucketName, WORKSPACE_ROOT, options);
    mountedSandboxSessions.add(sessionId);
    return { mounted: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    if (lower.includes("already mounted")) {
      mountedSandboxSessions.add(sessionId);
      return { mounted: true };
    }

    if (
      lower.includes("wrangler dev")
      || lower.includes("fuse")
      || lower.includes("operation not permitted")
    ) {
      return {
        mounted: false,
        message: "local wrangler dev cannot mount R2 (works after deploy)",
      };
    }

    if (
      lower.includes("missingcredentialserror")
      || lower.includes("no credentials found")
      || lower.includes("aws_access_key_id")
      || lower.includes("aws_secret_access_key")
    ) {
      return {
        mounted: false,
        message: "R2 mount skipped: missing R2 S3 credentials",
      };
    }

    throw error;
  }
};

const ensureTerminalServer = async (sandbox: Sandbox) => {
  let terminalRunning = false;

  try {
    const process = await sandbox.getProcess("pty-server");
    if (process) {
      terminalRunning = (await process.getStatus()) === "running";
    }
  } catch {
    terminalRunning = false;
  }

  if (terminalRunning) return;

  await sandbox.startProcess("python3 /workspace/terminal-server.py", {
    processId: "pty-server",
    cwd: WORKSPACE_ROOT,
  });

  await sleep(1200);
};

export const ensureSandboxRuntime = async (
  sandbox: Sandbox,
  env: RuntimeEnv,
  sessionId: string,
): Promise<{ mounted: boolean; mountMessage?: string }> => {
  const mountResult = await ensureBucketMounted(sandbox, env, sessionId);
  await ensureTerminalServer(sandbox);

  return {
    mounted: mountResult.mounted,
    mountMessage: mountResult.message,
  };
};
