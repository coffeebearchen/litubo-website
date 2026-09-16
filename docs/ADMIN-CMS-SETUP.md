# LITUBO Admin CMS — 安装与操作手册

> 适用版本：阶段 1（Directus + PostgreSQL 基础环境）
> 面向读者：负责初始化和日常维护的操作人员
> 技术要求：能运行命令行；需要访问腾讯云服务器的 SSH 权限

---

## 目录

1. [前提条件](#1-前提条件)
2. [本地开发环境启动](#2-本地开发环境启动-windows-docker-desktop)
3. [管理员首次初始化](#3-管理员首次初始化)
4. [日常操作命令](#4-日常操作命令)
5. [Schema 快照导出与应用](#5-schema-快照导出与应用)
6. [腾讯云生产环境部署](#6-腾讯云生产环境部署)
7. [安全边界说明](#7-安全边界说明)
8. [保密变量清单](#8-保密变量清单)
9. [常见问题](#9-常见问题)

---

## 1. 前提条件

**本地开发（Windows）：**
- Docker Desktop for Windows（已安装并运行）
- 已克隆本项目到本地

**腾讯云生产：**
- Docker Engine + Docker Compose Plugin 已安装（`docker compose version` 可运行）
- SSH 访问服务器的权限
- 服务器有足够磁盘空间（建议 `/data` 目录至少 20 GB）

---

## 2. 本地开发环境启动（Windows / Docker Desktop）

### 2.1 创建本地 `.env` 文件

复制模板，**不要提交 `.env` 到 Git**：

```
copy .env.example .env
```

用文本编辑器打开 `.env`，填写以下变量（其他可暂时保留默认值）：

| 变量 | 说明 |
|---|---|
| `DB_PASSWORD` | 随机生成，至少 16 位，例如用密码管理器生成 |
| `DIRECTUS_SECRET` | 随机生成，至少 32 位随机字符串 |
| `DIRECTUS_ADMIN_EMAIL` | 你的管理员邮箱 |
| `DIRECTUS_ADMIN_PASSWORD` | 初始密码，首次登录后立即修改 |

本地开发时 `POSTGRES_DATA_DIR=./dev-data/postgres` 和 `DIRECTUS_UPLOADS_DIR=./dev-data/uploads` 保持默认即可。

### 2.2 启动服务

```
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d
```

首次启动需要下载镜像（postgres:16-alpine 约 80 MB，directus:11 约 300 MB），请耐心等待。

### 2.3 确认启动成功

```
docker compose logs -f directus
```

看到以下字样表示启动完成，按 Ctrl+C 退出日志：

```
Server started at http://0.0.0.0:8055
```

健康检查：

```
curl http://localhost:8055/server/health
```

期望返回：`{"status":"ok"}`

### 2.4 访问管理界面

浏览器打开：**http://localhost:8055/admin**

用 `.env` 中设置的 `DIRECTUS_ADMIN_EMAIL` 和 `DIRECTUS_ADMIN_PASSWORD` 登录。

---

## 3. 管理员首次初始化

首次登录后请立即完成以下步骤：

### 3.1 修改密码

1. 点击右上角用户头像 → **Profile**
2. 修改密码为强密码并保存
3. 更新 `.env` 中的 `DIRECTUS_ADMIN_PASSWORD`（用于记录，不用于登录）

### 3.2 创建 API Token（前台 adapter 阶段使用）

> **已被取代（FINAL-RELEASE-PRODUCTION-READY-01A / 01C / 01D）：不要按本节创建 token。** `DIRECTUS_TOKEN` 是 `nuxt-server` 最小权限服务用户的 static token，不是 Administrator token；值由部署 secret manager 提供、由 provisioning 第 32 步安装（D-038），并在运行时注入 Nuxt 服务进程环境（D-039）。见 `docs/project/PRODUCTION-PROVISIONING-RUNBOOK.md` §2。以下步骤仅作历史记录保留。

> **本阶段（阶段 1）不需要创建 Token。** 以下步骤留待前台 adapter 开发阶段执行。

1. **Settings** → **API Tokens** → **Create Token**
2. 填写名称（如 `nuxt-server`），角色选 `Administrator`
3. 复制生成的 Token，写入服务器 `.env` 的 `DIRECTUS_TOKEN` 字段
4. Token 只显示一次，请立即保存到密码管理器

### 3.3 创建集合（Collections）

> **本阶段（阶段 1）暂不手动创建集合。** 集合将在阶段 2–3 按规格逐步建立，建立后导出 schema 快照。

如需从已有快照恢复，见第 5 节。

---

## 4. 日常操作命令

所有命令在**项目根目录**执行。

### 本地开发

```bash
# 启动
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d

# 停止（数据保留在 dev-data/）
docker compose -f docker-compose.yml -f docker-compose.local.yml down

# 查看日志
docker compose logs -f directus
docker compose logs -f postgres

# 重启 Directus（不重启数据库）
docker compose restart directus
```

### 腾讯云生产

```bash
# 启动
docker compose -f docker-compose.yml up -d

# 停止（数据保留在 /data/litubo/）
docker compose -f docker-compose.yml down

# 更新 Directus 镜像
docker compose -f docker-compose.yml pull directus
docker compose -f docker-compose.yml up -d directus
```

> ⚠️ 绝不使用 `docker compose down --volumes`，该命令会清空数据库。

---

## 5. Schema 快照导出与应用

Schema 快照记录所有集合定义，确保新环境可以一键恢复，无需手动建表。

### 5.1 导出快照（集合设置完成后执行）

**本地：**

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml exec directus \
  npx directus schema snapshot /schema/phase1.yaml
```

**生产：**

```bash
docker compose -f docker-compose.yml exec directus \
  npx directus schema snapshot /schema/phase1.yaml
```

导出后文件出现在 `directus/schema/phase1.yaml`，将其提交到 Git。

### 5.2 应用快照（新环境初始化时）

```bash
# 本地
docker compose -f docker-compose.yml -f docker-compose.local.yml exec directus \
  npx directus schema apply --yes /schema/phase1.yaml

# 生产
docker compose -f docker-compose.yml exec directus \
  npx directus schema apply --yes /schema/phase1.yaml
```

`--yes` 跳过交互确认。执行前确保 Directus 已完全启动。

---

## 6. 腾讯云生产环境部署

### 6.1 首次部署步骤

```bash
# 1. SSH 登录服务器
ssh user@<server-host>

# 2. 创建数据目录（bind mount 必须提前存在）
sudo mkdir -p /data/litubo/postgres /data/litubo/uploads

# 3. 设置目录权限
# postgres 容器以 uid 999 运行
sudo chown -R 999:999 /data/litubo/postgres
# directus 容器以 uid 1000 (node) 运行
sudo chown -R 1000:1000 /data/litubo/uploads

# 4. 进入项目目录
cd /path/to/litubo-website

# 5. 创建生产 .env（从 .env.example 复制后填入真实值）
cp .env.example .env
nano .env   # 或 vim .env

# 生产 .env 关键差异：
# POSTGRES_DATA_DIR=/data/litubo/postgres
# DIRECTUS_UPLOADS_DIR=/data/litubo/uploads
# DIRECTUS_PUBLIC_URL=http://localhost:8055  （保持，通过 SSH 隧道访问）

# 6. 启动
docker compose -f docker-compose.yml up -d

# 7. 确认启动
docker compose logs -f directus
```

### 6.2 访问生产 Directus Admin

在**管理员本机**（不是服务器）建立 SSH 隧道：

```bash
ssh -L 8055:localhost:8055 user@<server-host>
```

保持该终端窗口开启，然后在浏览器访问：

**http://localhost:8055/admin**

这是唯一合法的生产管理员访问方式。隧道断开后无法访问。

### 6.3 升级 Directus

```bash
# 拉取新镜像
docker compose -f docker-compose.yml pull directus
# 重建容器（数据不丢失）
docker compose -f docker-compose.yml up -d directus
# 运行数据库迁移（Directus 启动时自动执行，也可手动触发）
docker compose -f docker-compose.yml exec directus npx directus database migrate:latest
```

升级前建议先备份 PostgreSQL：

```bash
docker compose -f docker-compose.yml exec postgres \
  pg_dump -U litubo litubo_cms > /data/litubo/backups/$(date +%Y%m%d).sql
```

---

## 7. 安全边界说明

| 规则 | 配置依据 |
|---|---|
| Directus 端口仅绑定 `127.0.0.1:8055` | `docker-compose.yml` ports 配置 |
| Directus 不对公网暴露 | 无 `0.0.0.0` 绑定；Nginx 无 Directus 路由 |
| 无 `admin.litubo.com` 子域 | 本期不创建 |
| 生产访问只通过 SSH 隧道 | 见 6.2 节 |
| 公开注册关闭 | `PUBLIC_REGISTRATION=false` |
| 所有密钥只在 `.env` 中 | `.env` 已在 `.gitignore` 排除 |
| 前台不直接调用 Directus | 预留 `directusUrl` / `cmsMode` runtimeConfig，adapter 阶段才实现 |

**验证腾讯云无公网暴露（在服务器上执行）：**

```bash
# 应看到 127.0.0.1:8055，而非 0.0.0.0:8055
ss -tlnp | grep 8055
```

**从外部验证（在本地执行，应超时）：**

```bash
curl --max-time 5 http://<server-public-ip>:8055/server/health
```

---

## 8. 保密变量清单

以下变量必须保密，**绝对不能**提交到 Git、写入文档或发送到聊天工具：

| 变量 | 说明 |
|---|---|
| `DB_PASSWORD` | PostgreSQL 密码 |
| `DIRECTUS_SECRET` | JWT 签名密钥，泄露后需立即更换并重启 Directus |
| `DIRECTUS_ADMIN_EMAIL` | 管理员邮箱 |
| `DIRECTUS_ADMIN_PASSWORD` | 管理员密码 |
| `DIRECTUS_TOKEN` | 前台 adapter 使用的 API Token（阶段 3 创建） |

> **运行时注入（D-039）：** Nuxt 服务端 secret——`DIRECTUS_TOKEN`、`SMTP_PASS`、`SUBMISSION_IP_SECRET`、`HUBSPOT_ACCESS_TOKEN`、`OPENAI_API_KEY`、`DEEPSEEK_API_KEY`——只在运行时由部署 secret manager 注入 Nuxt 服务进程环境；构建不需要它们，构建产物也不包含它们。构建好的 server 不会自行读取 `.env` 文件。见 `docs/project/PRODUCTION-PROVISIONING-RUNBOOK.md` §2。

管理方式建议：使用密码管理器（如 1Password、Bitwarden）存储，服务器 `.env` 文件权限设为 `600`：

```bash
chmod 600 .env
```

---

## 9. 常见问题

**Q: `docker compose up` 后 Directus 启动失败，日志显示数据库连接错误。**

A: PostgreSQL 健康检查通过前 Directus 会等待并重试。如持续失败，检查 `.env` 中 `DB_USER` / `DB_PASSWORD` / `DB_DATABASE` 是否与 PostgreSQL 实际配置一致。

**Q: 升级后管理界面显示数据库迁移提示。**

A: 运行 `docker compose exec directus npx directus database migrate:latest`，或重启 Directus（启动时自动迁移）。

**Q: `directus/schema/phase1.yaml` 不存在，如何初始化集合？**

A: 首次部署时需按 CMS 规格文档（`docs/ADMIN-CMS-SPEC.md`）在 Directus Admin 界面手动创建集合，完成后运行 snapshot 命令导出并提交到 Git，此后新环境可用 `schema apply` 恢复。

**Q: 本地 `dev-data/` 目录占用空间过大。**

A: 可安全删除 `dev-data/`，下次启动时 Directus 会重新初始化（本地数据会丢失，生产数据不受影响）。
