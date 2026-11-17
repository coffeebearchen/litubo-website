# LITUBO 上线执行手册（RUNBOOK）

> 这份文件是**给执行者照做**的，不是说明文。每一步都有「怎么判断成功」。
> 前置：`deploy/preflight.sh` 全部通过；四项输入已确认（服务器、目录、数据库策略、域名现状）。
> 不在本手册里的动作，一律不做。

## 0. 先确认的四项输入

| # | 输入 | 本次取值 |
|---|---|---|
| 1 | 服务器地址 | `________` |
| 2 | SSH 用户（密钥登录） | `________` |
| 3 | 部署根目录 | `/srv/litubo`（默认） |
| 4 | 数据库策略 | `A 空库` / `B 导入本机内容`（本机快照 `backups/20261117-1915`） |
| 5 | 域名现状 | `________`（Wix？空白？指向哪台机？） |

## 1. 服务器体检（只读）

```bash
scp deploy/preflight.sh <user>@<host>:/tmp/
ssh <user>@<host> 'bash /tmp/preflight.sh'
```

**成功判据**：`FAIL 0`；WARN 项逐条确认（尤其 `3000` 端口是否被占、`8055` 是否已有 Directus）。

## 2. 建立目录与运行用户

```bash
ssh <user>@<host> '
  sudo useradd --system --create-home --shell /usr/sbin/nologin litubo 2>/dev/null || true
  sudo mkdir -p /srv/litubo/releases /srv/litubo/uploads /etc/litubo
  sudo chown -R litubo:litubo /srv/litubo
  sudo chmod 750 /etc/litubo
'
```

**成功判据**：`ls -ld /srv/litubo` 属主为 `litubo`。

## 3. 数据库

### 策略 A — 空库
```bash
# Directus 容器起来后按仓库 directus/schema 的 SQL 初始化角色与策略
ssh <user>@<host> 'cd /srv/litubo && docker compose -f docker-compose.yml up -d postgres directus'
```
**判据**：`curl -fsS http://127.0.0.1:8055/server/info` 返回 JSON。

### 策略 B — 导入本机内容
```bash
# 3.1 本机打包（数据库 + 上传），已有：backups/20261117-1915/litubo-backup-20261117-111615
# 3.2 上传
scp -r backups/20261117-1915/litubo-backup-20261117-111615 <user>@<host>:/srv/litubo/import/
# 3.3 服务器上（**先建库、再恢复，恢复前确认目标库为空**）
ssh <user>@<host> '
  cd /srv/litubo/import/litubo-backup-20261117-111615
  # 确认目标数据库为空（应为 0）
  docker exec litubo-cms-postgres-1 psql -U postgres -d litubo_cms -tAc "select count(*) from information_schema.tables where table_schema='"'"'public'"'"'"
  # 恢复
  docker exec -i litubo-cms-postgres-1 pg_restore -U postgres -d litubo_cms --clean --if-exists < database.dump
  tar xf uploads.tar -C /srv/litubo/uploads
'
```
**判据**：`select count(*) from products` = **37**；`select count(*) from posts` = **25**；`ls /srv/litubo/uploads | wc -l` ≈ 326。

## 4. 生产环境变量

```bash
ssh <user>@<host> '
  sudo install -m 640 -o root -g litubo /dev/null /etc/litubo/litubo.env
  sudoedit /etc/litubo/litubo.env    # 按 deploy/env.production.example 逐项填
'
```
**判据**：`sudo grep -c '^[A-Z]' /etc/litubo/litubo.env` ≥ 10；**`CMS_MODE=directus`**（写成 fixtures 会显示演示数据）。

## 5. 发布代码

```bash
LITUBO_HOST=<host> LITUBO_USER=<user> LITUBO_PATH=/srv/litubo ./deploy/deploy.sh
```
**判据**：脚本最后打印 `app up on <sha>`；`curl -fsS http://127.0.0.1:3000/` 有 HTML。

## 6. systemd

```bash
scp deploy/systemd/litubo.service <user>@<host>:/tmp/
ssh <user>@<host> '
  sudo cp /tmp/litubo.service /etc/systemd/system/litubo.service
  sudo systemctl daemon-reload
  sudo systemctl enable --now litubo
  systemctl --no-pager status litubo | head -12
'
```
**判据**：`active (running)`；`systemctl is-enabled litubo` = `enabled`。

## 7. Nginx

```bash
scp deploy/nginx/litubo.conf <user>@<host>:/tmp/
ssh <user>@<host> '
  sudo cp /tmp/litubo.conf /etc/nginx/sites-available/litubo.conf
  sudo ln -sfn /etc/nginx/sites-available/litubo.conf /etc/nginx/sites-enabled/litubo.conf
  sudo nginx -t && sudo systemctl reload nginx
'
```
**判据**：`curl -I -H "Host: litubo.com" http://127.0.0.1/` 返回 `200`。

## 8. DNS 切换（**执行前必须再向业主确认一次**）

1. 先记下当前解析（回滚用）：`dig +short litubo.com`、`dig +short www.litubo.com`
2. Cloudflare 里把 `@` 与 `www` 指向新服务器，**代理先关（DNS only）**
3. 等 TTL 生效，直接访问 `http://<server-ip>/` 与 `-H "Host: litubo.com"` 都通
4. 再打开 Cloudflare 代理（Full / Strict），确认 `https://litubo.com` 可访问

**判据**：`curl -I https://litubo.com/` = 200；证书由 Cloudflare 提供且无混合内容。

## 9. 上线后 10 分钟六项检查

```bash
for p in / /products /company/about /resources /support /sitemap.xml /robots.txt; do
  printf '%-16s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "https://litubo.com$p"
done
curl -s https://litubo.com/sitemap.xml | head -5     # 域名必须是 litubo.com
curl -sI https://litubo.com/es | head -1             # 必须 404
```

1. 上面 7 个路径全 `200`（`/es` 必须 `404`）
2. sitemap 里是 `https://litubo.com`，不是 IP 或 localhost
3. 产品详情、文章详情各点开一个
4. 后台 `/admin/login` 能登录；`/admin` 未登录 302
5. 提交一条测试询盘 → 后台可见 → **测完删除**
6. `curl -sI https://litubo.com/favicon.ico` 是 `image/x-icon` 且 > 3 KB（不是 78 字节的占位）

## 10. 回滚（要求 ≤5 分钟）

```bash
ssh <user>@<host> '
  prev=$(ls -1dt /srv/litubo/releases/* | sed -n 2p)
  ln -sfn "$prev" /srv/litubo/current
  sudo systemctl restart litubo
  sleep 2; curl -fsS http://127.0.0.1:3000/ >/dev/null && echo "rolled back to $prev"
'
```
数据库**不随代码回滚**；任何 schema 变更先快照、先备份，**只回退应用、不 DROP 列**。

## 11. 收尾

- 把 `git rev-parse --short HEAD` 与部署时间记进 `docs/project/BACKEND-DSH-V2-STATE.md`
- 生产 `.env` 不进 Git；`/etc/litubo/litubo.env` 权限保持 640
- 关闭 Cloudflare 的「开发模式」，确认缓存规则没有把 `/admin` 缓存
