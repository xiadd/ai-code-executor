# Cloudflare Sandbox IDE (Nitro + React)

这个项目已改造成：
- 后端：Nitro 3（Cloudflare module preset）
- 前端：React + TailwindCSS + shadcn/ui（Base style）
- 运行时：Cloudflare Worker + Sandbox Container + R2
- 鉴权：GitHub OAuth（组织/团队限制）

## 功能

- 左侧文件树（R2 持久化）
- 中间编辑器（多文件 tab）
- 右侧终端（xterm + WebSocket）
- 一键启动/停止 Sandbox
- 文件直接存 R2，不开 Sandbox 也可编辑
- 支持 GitHub 组织成员登录控制
- 不再启动任何额外转发服务

## 目录

- `src/` React 前端
- `server/` Nitro API/路由
- `Dockerfile` Sandbox 容器镜像
- `worker-entry.mjs` Wrangler 入口（转发到 Nitro 构建产物，并导出 `Sandbox`）

## 本地启动

### 1) 安装依赖

```bash
pnpm install
```

### 2) 前端 + Nitro 本地开发（不走 Cloudflare 绑定）

```bash
pnpm dev
```

说明：这个模式主要用于 UI 开发；会读取 `wrangler.dev.jsonc`（不含 containers），避免 wrangler 容器代理报错。R2/Sandbox 绑定在该模式不可用。

### 3) Cloudflare 本地联调（推荐验证后端能力）

先构建：

```bash
pnpm build
```

然后用 wrangler 跑：

```bash
pnpm dev:cf
```

这样会强制加载根目录 `wrangler.jsonc`（不是 `.output/server/wrangler.json`），并启用容器、R2、DO 绑定。
本地 `localhost` 访问时会自动跳过 GitHub 登录（仅开发环境便捷调试）。

## 部署

```bash
pnpm deploy
```

## OAuth 配置

`wrangler.jsonc` 已包含：
- `GITHUB_CLIENT_ID`
- `GITHUB_ALLOWED_ORG`
- `GITHUB_ALLOWED_TEAM`

`GITHUB_CLIENT_SECRET` 必须走 Secret：

```bash
wrangler secret put GITHUB_CLIENT_SECRET
```

## R2 挂载配置

需要配置：
- `R2_BUCKET_NAME`
- `R2_S3_ENDPOINT` 或 `R2_ACCOUNT_ID`
- 可选：`R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`

## 注意

- `lite` 规格由 Cloudflare 固定，CPU/内存/磁盘不能细粒度自定义。
- 本地 `wrangler dev` 对 R2 mount 可能有限制；生产部署后可正常挂载。
