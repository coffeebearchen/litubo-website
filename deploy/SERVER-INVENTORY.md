# 服务器资源分配表（43.165.125.203）

> 这台机器上跑着**两个互不相关的网站**。任何部署前先看这张表，再跑 `deploy/check-isolation.sh`。
> 最后核对：2026-11-17 20:15（档 2 完成后）

## 谁在用这台机

| 站 | 域名 | 应用 | 端口（仅回环） | CMS | 数据目录 |
|---|---|---|---|---|---|
| **anyivalves.com** | anyivalves.com / www | `anyi-web.service`（另有 `anyi-v2-production-*.service`） | **3322** | Docker `anyi-production-directus-1` | 8065 |
| **tuboluo.com**（LITUBO） | tuboluo.com（litubo.com 待切） | `litubo.service`（用户 `litubo`） | **3311** | Docker `litubo-new-directus-1` | 8055 |
| deploy 栈（旧，无人管） | — | `deploy_server_1` | **8080（公网！）** | mysql/redis 容器 | — |

## LITUBO 的资源归属（档 2 之后）

| 项 | 值 | 说明 |
|---|---|---|
| 系统用户 | `litubo`（uid 996，nologin） | 进程与文件都归它，不用 `DynamicUser` |
| 应用树 | `/srv/litubo/` | `releases/` + `current` 软链 + `runtime/node-22.22.2` |
| 环境文件 | `/etc/litubo/litubo.env`（**640 root:litubo**） | 与旧的 `/etc/litubo-new/web.env` 并存，旧文件仅回滚用 |
| systemd unit | `/etc/systemd/system/litubo.service` | `User=litubo`、`ProtectSystem=strict`、`ReadWritePaths=/srv/litubo`、`MemoryMax=800M` |
| CMS 数据 | `/data/litubo-new/{postgres,uploads}` | Docker 卷路径沿用；已按 project `litubo-new` 独占 |
| nginx | `/etc/nginx/sites-available/litubo-new` | `server_name tuboluo.com` → `127.0.0.1:3311` |
| 证书 | `/etc/letsencrypt/live/tuboluo.com/` | litubo.com 证书待切域名后签发 |
| 备份 | `/opt/litubo-backup-<时间戳>/` | release 包 + `pg_dump` + 配置 |

## 升级 LITUBO 的唯一正确姿势

```bash
# 1) 本机构建并打包
npx nuxt build && tar czf rel.tar.gz -C .output .
# 2) 上传并解到新 release 目录（不覆盖旧的）
scp rel.tar.gz ubuntu@43.165.125.203:/tmp/
ssh ubuntu@43.165.125.203 '
  sudo mkdir -p /srv/litubo/releases/<sha>
  sudo tar xzf /tmp/rel.tar.gz -C /srv/litubo/releases/<sha>
  sudo chown -R litubo:litubo /srv/litubo/releases/<sha>
  sudo chmod -R a+rX /srv/litubo/releases/<sha>
  sudo ln -sfn /srv/litubo/releases/<sha> /srv/litubo/current
  sudo systemctl restart litubo'
# 3) 冒烟
curl -sk -o /dev/null -w '%{http_code}\n' --resolve tuboluo.com:443:127.0.0.1 https://tuboluo.com/
```

**禁止**：
- 改 `/opt/anyi`、任何 `anyi-*` 容器/服务/证书
- 碰 `deploy_*` 栈（尤其 `8080`）
- 用 `docker system prune -a`（会删掉其他项目的基础镜像）
- 在服务器上跑 `npm run build`（3.7 GB 内存会被吃光）

## 回滚（≤2 分钟）

```bash
# 切回上一个 release
sudo ln -sfn /srv/litubo/releases/<上一个sha> /srv/litubo/current && sudo systemctl restart litubo

# 或者切回档 2 之前的旧服务（unit 仍在，已 disable）
sudo systemctl stop litubo && sudo systemctl start litubo-web
```

## 仍然共享、无法在本机解决的部分

| 共享项 | 风险 | 缓解 |
|---|---|---|
| Docker 守护进程 | 升级/重启/磁盘满，两站一起受影响 | 不在共享 daemon 上做大版本升级；已用独立 compose project + 内存上限 |
| nginx | 一份坏配置 `reload` 会同时影响两站 | 每次改完先 `nginx -t`；每站一个 vhost 文件，互不改 |
| 内核 / 磁盘 | 全局 | 监控磁盘（现 28G/59G 已用）；磁盘告警自己配 |
| 真隔离 | 以上都消除不了 | 要彻底隔离，需要另开一台虚拟机 |
