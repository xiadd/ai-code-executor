import type { RuntimeEnv } from "./env";

export const AUTH_SESSION_COOKIE = "sandbox_auth_session";
export const OAUTH_STATE_COOKIE = "sandbox_oauth_state";
export const OAUTH_NEXT_COOKIE = "sandbox_oauth_next";

const AUTH_SESSION_PREFIX = "auth/sessions";
const AUTH_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const OAUTH_STATE_TTL_SECONDS = 60 * 10;

export type AuthUser = {
  id: number;
  login: string;
  name: string;
  avatar: string;
  email: string | null;
  org: string;
  team?: string;
};

export type AuthSession = {
  sessionId: string;
  expiresAt: number;
  user: AuthUser;
};

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const renderLoginPage = (reason = "", nextPath = "/") => `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Login · Sandbox IDE</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      height: 100vh;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at 15% -10%, rgba(102, 167, 255, 0.34), transparent 42%),
        radial-gradient(circle at 90% 130%, rgba(72, 118, 197, 0.3), transparent 36%),
        linear-gradient(130deg, #090f1d, #101a33 52%, #141824);
      color: #e8efff;
      font-family: "Inter", "SF Pro Display", "Segoe UI", sans-serif;
      padding: 18px;
    }
    .card {
      width: 420px;
      max-width: 100%;
      padding: 22px;
      border-radius: 16px;
      border: 1px solid rgba(136, 174, 245, 0.34);
      background: rgba(14, 22, 41, 0.72);
      box-shadow: 0 28px 62px rgba(6, 10, 19, 0.48);
    }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { color: #a8bbdf; line-height: 1.6; font-size: 13px; }
    .error {
      margin-top: 14px;
      margin-bottom: 14px;
      font-size: 12px;
      border-radius: 10px;
      padding: 9px 10px;
      border: 1px solid rgba(223, 117, 117, 0.42);
      background: rgba(145, 46, 58, 0.36);
      color: #ffdadd;
    }
    button {
      margin-top: 12px;
      width: 100%;
      height: 42px;
      border-radius: 10px;
      border: 1px solid rgba(147, 186, 255, 0.38);
      background: linear-gradient(120deg, #1e3b84, #2752af);
      color: #f0f5ff;
      font-weight: 600;
      letter-spacing: .01em;
      cursor: pointer;
      font-size: 13px;
    }
    button:hover { filter: brightness(1.1); }
    .tip { margin-top: 12px; font-size: 11px; color: #8da5d2; }
  </style>
</head>
<body>
  <div class="card">
    <h1>GitHub Sign-in Required</h1>
    <p>This workspace is visible only to allowed organization members.</p>
    ${reason ? `<div class="error">${escapeHtml(reason)}</div>` : ""}
    <button onclick="location.href='/auth/login?next=${encodeURIComponent(nextPath)}'">Continue with GitHub</button>
    <div class="tip">After login, you will be redirected back automatically.</div>
  </div>
</body>
</html>`;

const parseCookies = (cookieHeader: string | null): Record<string, string> => {
  if (!cookieHeader) return {};

  const cookies: Record<string, string> = {};
  for (const chunk of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = chunk.trim().split("=");
    if (!rawKey) continue;
    const raw = rawValue.join("=") || "";
    try {
      cookies[rawKey] = decodeURIComponent(raw);
    } catch {
      cookies[rawKey] = raw;
    }
  }

  return cookies;
};

const readCookieHeader = (
  request: Request | { headers?: unknown } | undefined | null,
): string | null => {
  if (!request || typeof request !== "object") {
    return null;
  }

  const headers = (request as { headers?: unknown }).headers;
  if (!headers) {
    return null;
  }

  if (typeof (headers as Headers).get === "function") {
    try {
      return (headers as Headers).get("cookie");
    } catch {
      return null;
    }
  }

  if (typeof headers === "object") {
    const record = headers as Record<string, unknown>;
    const cookieValue = record.cookie ?? record.Cookie;
    return typeof cookieValue === "string" ? cookieValue : null;
  }

  return null;
};

const buildSetCookie = (
  name: string,
  value: string,
  options: {
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Lax" | "Strict" | "None";
    path?: string;
  } = {},
): string => {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || "/"}`);
  if (typeof options.maxAge === "number") parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
};

export const sanitizeNextPath = (raw: string | null | undefined): string => {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw;
};

const createRandomToken = (): string =>
  crypto.randomUUID().replace(/-/g, "") + crypto.getRandomValues(new Uint32Array(1))[0];

const getAuthSessionKey = (sessionId: string): string =>
  `${AUTH_SESSION_PREFIX}/${sessionId}.json`;

export const loadAuthSession = async (
  env: RuntimeEnv,
  authSessionId: string,
): Promise<AuthSession | null> => {
  const object = await env.CODE_BUCKET.get(getAuthSessionKey(authSessionId));
  if (!object) return null;

  try {
    const raw = await object.text();
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.expiresAt || parsed.expiresAt <= Date.now()) {
      await env.CODE_BUCKET.delete(getAuthSessionKey(authSessionId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const saveAuthSession = async (
  env: RuntimeEnv,
  session: AuthSession,
): Promise<void> => {
  await env.CODE_BUCKET.put(getAuthSessionKey(session.sessionId), JSON.stringify(session));
};

export const deleteAuthSession = async (
  env: RuntimeEnv,
  authSessionId: string,
): Promise<void> => {
  await env.CODE_BUCKET.delete(getAuthSessionKey(authSessionId));
};

const exchangeGithubCodeForToken = async (
  env: RuntimeEnv,
  code: string,
  redirectUri: string,
): Promise<string> => {
  const clientId = (env.GITHUB_CLIENT_ID || "").trim();
  const clientSecret = (env.GITHUB_CLIENT_SECRET || "").trim();

  if (!clientId || !clientSecret) {
    throw new Error("Missing GitHub OAuth credentials");
  }

  const payload = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: payload.toString(),
  });

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
  };

  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(tokenData.error || "Failed to fetch GitHub access token");
  }

  return tokenData.access_token;
};

const getGithubUser = async (accessToken: string) => {
  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "cloudflare-sandbox-ide",
    },
  });

  if (!userResponse.ok) {
    throw new Error("Failed to fetch GitHub user");
  }

  return (await userResponse.json()) as {
    id: number;
    login: string;
    name?: string | null;
    avatar_url?: string | null;
    email?: string | null;
  };
};

const ensureGithubOrgMembership = async (
  accessToken: string,
  allowedOrg: string,
): Promise<boolean> => {
  const membershipResponse = await fetch(
    `https://api.github.com/user/memberships/orgs/${allowedOrg}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "cloudflare-sandbox-ide",
      },
    },
  );

  if (membershipResponse.status === 404) return false;
  if (!membershipResponse.ok) {
    throw new Error("Failed to validate organization membership");
  }

  const membership = (await membershipResponse.json()) as { state?: string };
  return membership.state === "active";
};

const ensureGithubTeamMembership = async (
  accessToken: string,
  allowedOrg: string,
  allowedTeam: string,
  userLogin: string,
): Promise<boolean> => {
  const teamsResponse = await fetch(
    `https://api.github.com/orgs/${allowedOrg}/teams?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "cloudflare-sandbox-ide",
      },
    },
  );

  if (!teamsResponse.ok) {
    throw new Error("Failed to fetch organization teams");
  }

  const teams = (await teamsResponse.json()) as Array<{
    id: number;
    name: string;
    slug: string;
  }>;

  const targetTeam = teams.find(
    (team) => team.name === allowedTeam || team.slug === allowedTeam,
  );

  if (!targetTeam) {
    throw new Error("Configured team was not found");
  }

  const memberResponse = await fetch(
    `https://api.github.com/teams/${targetTeam.id}/memberships/${userLogin}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "cloudflare-sandbox-ide",
      },
    },
  );

  if (memberResponse.status === 404) return false;
  if (!memberResponse.ok) {
    throw new Error("Failed to validate team membership");
  }

  const membership = (await memberResponse.json()) as { state?: string };
  return membership.state === "active";
};

const publicPaths = new Set([
  "/login",
  "/auth/login",
  "/auth/callback",
  "/auth/logout",
  "/favicon.ico",
]);

const publicPrefixes = [
  "/assets/",
  "/@vite",
  "/@id/",
  "/src/",
  "/node_modules/",
  "/__vite",
  "/.well-known/",
];

const isPublicPath = (pathname: string): boolean => {
  if (publicPaths.has(pathname)) return true;
  return publicPrefixes.some((prefix) => pathname.startsWith(prefix));
};

const createUnauthorizedApiResponse = (clearCookie: string | null = null) => {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
  if (clearCookie) headers.append("Set-Cookie", clearCookie);
  return new Response(
    JSON.stringify({ success: false, error: "Unauthorized" }),
    { status: 401, headers },
  );
};

const createUnauthorizedWebSocketResponse = (clearCookie: string | null = null) => {
  const headers = new Headers();
  if (clearCookie) headers.append("Set-Cookie", clearCookie);
  return new Response("Unauthorized", { status: 401, headers });
};

const createUnauthorizedPageRedirect = (
  url: URL,
  clearCookie: string | null = null,
) => {
  const loginURL = new URL("/login", url.origin);
  loginURL.searchParams.set("next", sanitizeNextPath(`${url.pathname}${url.search}`));

  const headers = new Headers({ Location: loginURL.toString() });
  if (clearCookie) headers.append("Set-Cookie", clearCookie);

  return new Response(null, { status: 302, headers });
};

export const assertAuthenticatedRequest = async (
  request: Request | { headers?: unknown } | undefined,
  url: URL,
  env: RuntimeEnv,
): Promise<{ session: AuthSession | null; response: Response | null }> => {
  if (isPublicPath(url.pathname)) {
    return { session: null, response: null };
  }

  const cookies = parseCookies(readCookieHeader(request));
  const authSessionId = cookies[AUTH_SESSION_COOKIE];
  const secureCookie = url.protocol === "https:";

  const clearAuthCookie = buildSetCookie(AUTH_SESSION_COOKIE, "", {
    maxAge: 0,
    sameSite: "Lax",
    secure: secureCookie,
  });

  if (!authSessionId) {
    if (url.pathname === "/ws") {
      return { session: null, response: createUnauthorizedWebSocketResponse() };
    }
    if (url.pathname.startsWith("/api/")) {
      return { session: null, response: createUnauthorizedApiResponse() };
    }
    return { session: null, response: createUnauthorizedPageRedirect(url) };
  }

  const session = await loadAuthSession(env, authSessionId);
  if (session) {
    return { session, response: null };
  }

  if (url.pathname === "/ws") {
    return {
      session: null,
      response: createUnauthorizedWebSocketResponse(clearAuthCookie),
    };
  }
  if (url.pathname.startsWith("/api/")) {
    return {
      session: null,
      response: createUnauthorizedApiResponse(clearAuthCookie),
    };
  }
  return {
    session: null,
    response: createUnauthorizedPageRedirect(url, clearAuthCookie),
  };
};

export const createGithubLoginRedirect = (
  requestURL: URL,
  env: RuntimeEnv,
  nextPath: string,
): { response: Response; state: string; oauthURL: URL } => {
  const clientId = (env.GITHUB_CLIENT_ID || "").trim();
  const allowedOrg = (env.GITHUB_ALLOWED_ORG || "").trim();
  if (!clientId || !allowedOrg) {
    return {
      response: new Response("Missing GitHub OAuth configuration", { status: 500 }),
      state: "",
      oauthURL: new URL(requestURL.origin),
    };
  }

  const state = createRandomToken();
  const redirectUri = `${requestURL.origin}/auth/callback`;
  const oauthURL = new URL("https://github.com/login/oauth/authorize");
  oauthURL.searchParams.set("client_id", clientId);
  oauthURL.searchParams.set("redirect_uri", redirectUri);
  oauthURL.searchParams.set("scope", "read:user read:org read:team");
  oauthURL.searchParams.set("state", state);

  const secureCookie = requestURL.protocol === "https:";
  const headers = new Headers({ Location: oauthURL.toString() });
  headers.append(
    "Set-Cookie",
    buildSetCookie(OAUTH_STATE_COOKIE, state, {
      maxAge: OAUTH_STATE_TTL_SECONDS,
      sameSite: "Lax",
      secure: secureCookie,
    }),
  );
  headers.append(
    "Set-Cookie",
    buildSetCookie(OAUTH_NEXT_COOKIE, nextPath, {
      maxAge: OAUTH_STATE_TTL_SECONDS,
      sameSite: "Lax",
      secure: secureCookie,
    }),
  );

  return {
    response: new Response(null, { status: 302, headers }),
    state,
    oauthURL,
  };
};

export const completeGithubCallback = async (
  request: Request | { headers?: unknown } | undefined,
  requestURL: URL,
  env: RuntimeEnv,
): Promise<Response> => {
  const secureCookie = requestURL.protocol === "https:";
  const clearStateCookie = buildSetCookie(OAUTH_STATE_COOKIE, "", {
    maxAge: 0,
    sameSite: "Lax",
    secure: secureCookie,
  });
  const clearNextCookie = buildSetCookie(OAUTH_NEXT_COOKIE, "", {
    maxAge: 0,
    sameSite: "Lax",
    secure: secureCookie,
  });

  const redirectToLogin = (reason: string) => {
    const loginURL = new URL("/login", requestURL.origin);
    loginURL.searchParams.set("reason", reason.slice(0, 220));
    const headers = new Headers({ Location: loginURL.toString() });
    headers.append("Set-Cookie", clearStateCookie);
    headers.append("Set-Cookie", clearNextCookie);
    return new Response(null, { status: 302, headers });
  };

  const urlCode = (requestURL.searchParams.get("code") || "").trim();
  const urlState = (requestURL.searchParams.get("state") || "").trim();
  if (!urlCode || !urlState) {
    return redirectToLogin("GitHub callback parameters are missing");
  }

  const cookies = parseCookies(readCookieHeader(request));
  const expectedState = cookies[OAUTH_STATE_COOKIE];
  const nextPath = sanitizeNextPath(cookies[OAUTH_NEXT_COOKIE] || "/");

  if (!expectedState || expectedState !== urlState) {
    return redirectToLogin("OAuth state validation failed");
  }

  const allowedOrg = (env.GITHUB_ALLOWED_ORG || "").trim();
  const allowedTeam = (env.GITHUB_ALLOWED_TEAM || "").trim();
  if (!allowedOrg) {
    return redirectToLogin("No allowed GitHub org is configured");
  }

  try {
    const accessToken = await exchangeGithubCodeForToken(
      env,
      urlCode,
      `${requestURL.origin}/auth/callback`,
    );

    const user = await getGithubUser(accessToken);
    const orgAllowed = await ensureGithubOrgMembership(accessToken, allowedOrg);
    if (!orgAllowed) {
      return redirectToLogin(`Current account is not in org ${allowedOrg}`);
    }

    if (allowedTeam) {
      const teamAllowed = await ensureGithubTeamMembership(
        accessToken,
        allowedOrg,
        allowedTeam,
        user.login,
      );
      if (!teamAllowed) {
        return redirectToLogin(`Current account is not in team ${allowedTeam}`);
      }
    }

    const authSessionId = createRandomToken();
    const authSession: AuthSession = {
      sessionId: authSessionId,
      expiresAt: Date.now() + AUTH_SESSION_TTL_SECONDS * 1000,
      user: {
        id: user.id,
        login: user.login,
        name: user.name || user.login,
        avatar: user.avatar_url || "",
        email: user.email || null,
        org: allowedOrg,
        team: allowedTeam || undefined,
      },
    };

    await saveAuthSession(env, authSession);

    const headers = new Headers({
      Location: new URL(nextPath, requestURL.origin).toString(),
    });
    headers.append(
      "Set-Cookie",
      buildSetCookie(AUTH_SESSION_COOKIE, authSessionId, {
        maxAge: AUTH_SESSION_TTL_SECONDS,
        sameSite: "Lax",
        secure: secureCookie,
      }),
    );
    headers.append("Set-Cookie", clearStateCookie);
    headers.append("Set-Cookie", clearNextCookie);

    return new Response(null, { status: 302, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub login failed";
    return redirectToLogin(message);
  }
};

export const createLogoutResponse = async (
  request: Request | { headers?: unknown } | undefined,
  requestURL: URL,
  env: RuntimeEnv,
): Promise<Response> => {
  const cookies = parseCookies(readCookieHeader(request));
  const authSessionId = cookies[AUTH_SESSION_COOKIE];
  if (authSessionId) {
    await deleteAuthSession(env, authSessionId);
  }

  const secureCookie = requestURL.protocol === "https:";
  const headers = new Headers({
    Location: new URL("/login", requestURL.origin).toString(),
  });

  headers.append(
    "Set-Cookie",
    buildSetCookie(AUTH_SESSION_COOKIE, "", {
      maxAge: 0,
      sameSite: "Lax",
      secure: secureCookie,
    }),
  );
  headers.append(
    "Set-Cookie",
    buildSetCookie(OAUTH_STATE_COOKIE, "", {
      maxAge: 0,
      sameSite: "Lax",
      secure: secureCookie,
    }),
  );
  headers.append(
    "Set-Cookie",
    buildSetCookie(OAUTH_NEXT_COOKIE, "", {
      maxAge: 0,
      sameSite: "Lax",
      secure: secureCookie,
    }),
  );

  return new Response(null, { status: 302, headers });
};

export const getAuthSessionIdFromRequest = (
  request: Request | { headers?: unknown } | undefined,
): string | null => {
  const cookies = parseCookies(readCookieHeader(request));
  return cookies[AUTH_SESSION_COOKIE] || null;
};
