# Sandbox IDE (Cloudflare Workers + Sandbox)

一个轻量版的在线 IDE，重点在于 Cloudflare Sandbox 能力：

- 手动启动 / 关闭 Sandbox
- 文件存储在 R2（即使不开 Sandbox 也能编辑）
- 通过 xterm.js 连接终端（WebSocket）
- Sandbox 启动时尝试把 R2 挂载到 `/workspace`
- 运行 JS / Python / Shell 文件
- 已关闭端口转发服务（`start-server/services`）

## 前置条件

- Cloudflare 账号（你有 paid plan，满足容器能力要求）
- 已安装 Node.js / pnpm / Wrangler
- 已登录 Cloudflare：`npx wrangler login`
- 已创建 GitHub OAuth App（需要组织成员权限）

## 本地开发

```bash
pnpm install
pnpm dev
```

首次本地运行会构建容器镜像，时间会明显更长（几分钟是正常现象）。

## 部署到 Cloudflare

```bash
pnpm deploy
```

本项目不需要额外手动创建 KV / D1。`wrangler.jsonc` 已配置：

- `containers`（Sandbox 镜像）
- `durable_objects`（Sandbox DO 绑定）
- `r2_buckets`（文件存储）
- `migrations`（SQLite class）

## R2 配置

1. 在 Cloudflare 创建 R2 bucket（默认示例名：`cloudflare-sandbox-files`）。
2. 在 `wrangler.jsonc` 里更新：
   - `r2_buckets[].bucket_name`
   - `vars.R2_BUCKET_NAME`
   - `vars.R2_ACCOUNT_ID`
   - `vars.R2_S3_ENDPOINT`
3. 设置 R2 S3 API 密钥（用于 sandbox mount）：

```bash
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

说明：`wrangler dev` 下 bucket mount 可能不可用（FUSE 限制），生产部署后可正常挂载。即使本地 mount 失败，R2 文件编辑功能仍可用。

## GitHub 鉴权配置

当前项目已接入 GitHub OAuth，只有允许组织成员可访问页面和 API。

1. 在 `wrangler.jsonc` 配置：
   - `vars.GITHUB_CLIENT_ID`
   - `vars.GITHUB_ALLOWED_ORG`
   - `vars.GITHUB_ALLOWED_TEAM`（可选，留空则只校验组织）
2. 设置 OAuth client secret（不要写入代码）：

```bash
wrangler secret put GITHUB_CLIENT_SECRET
```

## 一键部署链接（Deploy Button）

你这个仓库的 Deploy Button：

```md
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/xiadd/cloudflare-sandbox)
```

直接访问链接：

```txt
https://deploy.workers.cloudflare.com/?url=https://github.com/xiadd/cloudflare-sandbox
```

## 主要 API

- `POST /api/sandbox/start`：启动 sandbox
- `POST /api/sandbox/stop`：关闭 sandbox（终止进程并销毁实例）
- `GET /api/sandbox/status`：返回当前 Worker 进程内记录的运行状态
- `GET /api/auth/me`：返回当前登录用户
- `GET /api/files`：列目录
- `GET /api/read`：读文件
- `POST /api/write`：写文件
- `POST /api/mkdir`：创建目录
- `POST /api/delete`：删除文件/目录
- `GET /ws`：终端 WebSocket 连接
