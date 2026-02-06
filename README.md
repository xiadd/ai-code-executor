# Sandbox IDE (Cloudflare Workers + Sandbox)

一个轻量版的在线 IDE，重点在于 Cloudflare Sandbox 能力：

- 手动启动 / 关闭 Sandbox
- 通过 xterm.js 连接终端（WebSocket）
- 在 `/workspace` 文件系统内读写文件
- 运行 JS / Python / Shell 文件
- 启动并暴露 HTTP 服务端口（预览链接）

## 前置条件

- Cloudflare 账号（你有 paid plan，满足容器能力要求）
- 已安装 Node.js / pnpm / Wrangler
- 已登录 Cloudflare：`npx wrangler login`

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
- `migrations`（SQLite class）

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
- `POST /api/sandbox/stop`：关闭 sandbox（终止进程、取消暴露端口）
- `GET /api/sandbox/status`：返回当前 Worker 进程内记录的运行状态
- `GET /api/files`：列目录
- `GET /api/read`：读文件
- `POST /api/write`：写文件
- `POST /api/mkdir`：创建目录
- `POST /api/delete`：删除文件/目录
- `POST /api/start-server`：启动并暴露服务
- `POST /api/stop-server`：停止服务
- `GET /api/services`：获取已暴露端口
- `GET /ws`：终端 WebSocket 连接
