# 生产部署工件（草案，未执行）

> 状态：**DRAFT**。这些文件**没有被使用过**，也没有连过任何服务器。它们是为"获得部署授权后"准备的施工材料。
> 依据：`docs/OPERATIONS-HANDBOOK.md` D-043 —— Nuxt 以 **systemd 宿主进程**运行，**不用 Dockerfile**；Nginx 用**独立虚拟主机**反代到 `127.0.0.1:3000`；Cloudflare 在前面负责 DNS/TLS/缓存。
> 授权边界：合并 `master`、部署、改 DNS/Cloudflare 都需要**单独明确授权**。本文件不构成授权。

## 目录

```
deploy/
├── README.md                  ← 本文件：上线清单
├── env.production.example     ← 生产环境变量清单（只有键名与占位，无真实值）
├── systemd/litubo.service     ← systemd unit
├── nginx/litubo.conf          ← Nginx 虚拟主机
└── deploy.sh                  ← 发布脚本（rsync + 构建 + 重启 + 健康检查）
```

## 上线前必须满足的 8 个条件

| # | 条件 | 现状 | 谁做 |
|---|---|---|---|
| 1 | 生产构建通过 | ✅ 本地已通过（`.output` 14.6 MB） | 已完成 |
| 2 | 合并到 `master` | ❌ 工作分支领先 **142** 个提交 | 需你授权后我执行快进合并 |
| 3 | Release Review（`RELEASE-SAFETY-GATES`） | ❌ 未做 | 需按闸门逐项取证 |
| 4 | 服务器就绪（Node 22.22.2、Nginx、systemd） | ❓ 未确认 | 需你提供服务器与访问方式 |
| 5 | 生产数据库（初始化或导入） | ❌ 未决定：新建空库 还是 导入本机 41 产品/32 文章/22 询盘 | 需你决定 |
| 6 | 上传文件（`dev-data/uploads`） | ❌ 未迁移 | 数据库定了才能定 |
| 7 | 生产环境变量（`/etc/litubo/litubo.env`） | ❌ 未准备 | 需你提供生产凭据（我不读不打印） |
| 8 | DNS / Cloudflare | ❌ 未动，且属禁止自动执行项 | 需你明确授权 |

## 发布流程（获授权后按此执行）

```bash
# 0) 本地：确认干净且已合并
git status --short              # 应为空（.tools/ 已忽略）
git log --oneline -1

# 1) 构建并打包（本地或跳板机）
NODE_ENV=production npm ci
NODE_ENV=production npm run build
tar czf litubo-$(git rev-parse --short HEAD).tar.gz .output package.json

# 2) 上传到服务器（示例；主机名/用户按实际替换）
scp litubo-*.tar.gz <user>@<host>:/srv/litubo/releases/

# 3) 服务器上：解包到新 release，切换软链
ssh <user>@<host> '
  cd /srv/litubo/releases && tar xzf litubo-*.tar.gz -C $(basename litubo-*.tar.gz .tar.gz)
  ln -sfn /srv/litubo/releases/$(basename litubo-*.tar.gz .tar.gz) /srv/litubo/current
  sudo systemctl restart litubo
  curl -fsS http://127.0.0.1:3000/ >/dev/null && echo "app up"
'

# 4) 冒烟（对着真实域名，DNS 切换后）
curl -I https://litubo.com/
curl -I https://litubo.com/products
curl -I https://litubo.com/sitemap.xml
curl -I https://litubo.com/robots.txt
```

## 回滚（要求 ≤5 分钟）

```bash
# 切回上一个 release，重启，验证
ssh <user>@<host> '
  ls -1dt /srv/litubo/releases/* | sed -n 2p
  ln -sfn $(ls -1dt /srv/litubo/releases/* | sed -n 2p) /srv/litubo/current
  sudo systemctl restart litubo
  curl -fsS http://127.0.0.1:3000/ >/dev/null && echo "rolled back"
'
```

数据库**不随代码回滚**：任何 schema 变更都必须先导出 schema 快照 + 数据库备份，并且**只回退应用、不 DROP 列**（项目既定规矩）。

## 上线后 10 分钟内必须看的 6 件事

1. `/`、`/products`、一个产品详情页、一篇文章详情页 → 200
2. `sitemap.xml` 里的域名是 `https://litubo.com`，不是 `localhost`
3. `robots.txt` 允许抓取，且 `sitemap` 指向正确域名
4. 后台 `/admin/login` 能登录，`/admin` 未登录时 302
5. 提交一条测试询盘 → 后台能看到（**测完删掉**）
6. `https://litubo.com/es` 在生产应 **404**（`previewLocales` 在生产为空）

## 已知的、不阻塞上线的缺口

- 没有 favicon（`public/favicon.ico` 不存在，`nuxt.config` 未定义 `rel: icon`）
- `content/fixtures/*` 里有 17 处图片路径指向不存在的文件（只在 `CMS_MODE=fixtures` 演示模式可见）
- 8 个 X-ray 产品仍是草稿（缺主图）、7 篇 `test-*` 文章仍是草稿（不应发布）
