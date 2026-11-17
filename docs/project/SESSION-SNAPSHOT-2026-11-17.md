# LITUBO 会话快照 · 2026-11-17

> **这份文件是给"下一个接手的 AI"读的。** 读完它 + 跑一遍第 9 节的检查命令，就能接着干，不需要翻聊天记录。
> 记录时间：2026-11-17 22:40（Asia/Shanghai）。作者：本会话的执行 AI。

---

## 0. 三十秒读懂

- **站点**：LITUBO 公司官网（食品/包装检测设备），Nuxt 3 + Directus，**当前线上是 `https://tuboluo.com`**，`litubo.com` 仍在 Wix、**尚未切换**。
- **代码**：本地 `D:\LITUBO-website` = GitHub `coffeebearchen/litubo-website`，分支 `work/c-refined-v1` 与 `master` **都在 `fbb71d5`**。
- **服务器**：腾讯云 `43.165.125.203`（Ubuntu 24.04），LITUBO 跑在 `/srv/litubo`，systemd 服务 `litubo.service`，端口 `127.0.0.1:3311`。
- **同机还有另一个网站** `anyivalves.com`（不是我们的），**绝对不能碰**——详见第 7 节。
- **本次会话做完了**：后台 V2 收尾、产品 AI（文案/主图/上产品/批量）、品牌 logo 与 favicon、字体缩小 20%、Hero 图片接前台、文章 SEO 回填、**全局 AI 助手**（文章 SEO / 媒体 alt / 分类介绍 / 产品文案 / 站点体检）、内容与数据同步到线上。

---

## 1. 关键地址与凭据位置

| 项 | 值 |
|---|---|
| 线上站点 | `https://tuboluo.com`（`/es`、`/pt` 生产环境返回 404，属设计） |
| 后台登录 | `https://tuboluo.com/admin/login`，邮箱 **`dev@litubo.com`** |
| 后台密码 | 与本地 `D:\LITUBO-website\.env` 的 `DIRECTUS_ADMIN_PASSWORD` 相同；服务器侧在 `/etc/litubo/litubo.env` 与 Directus 容器的 `ADMIN_PASSWORD` |
| Directus API | `http://127.0.0.1:8055`（仅回环），库名 `litubo_cms`，库用户 `litubo` |
| 服务器 SSH | `ubuntu@43.165.125.203`（密钥登录，本机 `~/.ssh/id_ed25519`；**免密 sudo 可用**） |
| 服务器应用树 | `/srv/litubo/{releases,current,runtime}`，服务用户 `litubo`（uid 996） |
| 环境文件 | `/etc/litubo/litubo.env`（**640 root:litubo**，含 Directus token 与 DeepSeek key） |
| nginx | `/etc/nginx/sites-available/litubo-new` → `server_name tuboluo.com` → `127.0.0.1:3311` |
| 证书 | `/etc/letsencrypt/live/tuboluo.com/`（**只签了不带 www 的域名**） |
| 数据库备份 | `/opt/litubo-backup-*/`（部署前、恢复前各一份）；本地 `backups/20261117-1915/`（30.2 MB，DB+uploads） |
| 代码检查点 | GitHub 标签 `backup-20261117-*`（5 个） |

> 凭据规则：**不要把 `.env` 的值贴进聊天、文档或 Git**。改 key 用第 7.4 节的脚本。

---

## 2. 架构地图（改哪里）

### 2.1 前台（公开站）
- `pages/` — 30 个页面；产品详情 `pages/products/[category]/[slug].vue`，文章详情 `pages/resources/insights/[slug].vue`
- `components/global/` — 头部/页脚/巨型菜单/移动端导航/访客助手
- `composables/usePageHero.ts` + `server/api/cms/page-hero.get.ts` — 13 个页面的 Hero 覆盖（标题/正文/CTA/图片/alt）
- `useSeoHead.ts` — 全站 SEO 头（canonical、hreflang、OG、JSON-LD）

### 2.2 后台（`/admin`）
- 产品：`/admin/products`（列表）、`/admin/products/import`（从资料导入）、`/admin/products/[id]/{index,content,specs,media,faq,seo,preview}`
- 文章：`/admin/posts`（单页编辑器，**当前文章写在 `?id=`**）
- 结构化内容：`/admin/content-center/[id]/*`
- 媒体：`/admin/media`（**选中文件写在 `?id=`**）
- 页面内容：`/admin/page-content`（五个 tab）
- 询盘：`/admin/inquiries`

### 2.3 AI 层（重点）
- 目标定义：`server/utils/aiTargets/*.ts`（inquiry、productListing、productMedia、productIntake、specifications、contentDraft、visitorAssistant、**seoMeta、mediaAlt、categoryIntro**）
- 提案/确认模式：`aiProposalEngine` + `aiProposalReplayGuard`（一次性 ref）+ `aiGenerateRateLimit`（单飞 + 冷却）
- 后台 AI 接口：
  - `server/api/admin/ai/{seo-proposal,seo-confirm,media-alt-proposal,media-alt-confirm,media-alt-batch,category-proposal,category-confirm,site-audit,site-audit-summary}`
  - 产品：`server/api/admin/products/[id]/ai-listing-{proposal,confirm}`、`ai-media-{proposal,confirm}`、`intake/*`
  - 询盘：`server/api/admin/inquiries/[id]/ai-{proposal,confirm}`
- **全局助手**：`components/admin/AdminAiAssistant.vue`，挂在 `layouts/admin.vue`；右上角、可折叠、可拖动
- **铁律**：AI 只出候选 → 人确认 → 只写白名单列；产品 AI 仅 Draft；**永不自动发布/外发**

---

## 3. 本次会话完成清单（按提交）

| 提交 | 内容 |
|---|---|
| `2df3f73`～`a6e08b5` | V2-04 收尾（9 页 Hero）、V2-05（五 tab + 分类读写）、V2-06（询盘 AI）、V2-07（视觉验收） |
| `345a079` `4667335` | 验收截图与差异表；Hero 图片选择器 + 删测试草稿 |
| `c22f0e7` | `/admin` 裸路径也走鉴权 |
| `e553cda` `2605786` | 产品文案 AI、主图 + alt AI |
| `ef27db6` `66bd4bb` `7eea98a` | 上产品（单份）、导入页、批量 10 份 |
| `9df7b03` | 产品编辑器 7 个英文 tab |
| `70f1638` | 四个 AI 目标的 34 个单元测试 |
| `db77ec` `deb77ec` | 图片批量上传 + 自动关联 |
| `32be265` | 品牌 logo（#2F6B3A）+ favicon + theme-color |
| `5b051ff` | 字体整体缩小 20%（`--type-scale: 0.8`）+ 真 logo 上身 |
| `8557947` | 首页 hero 图那行型号标签删除 |
| `f0ec72a` `80e6559` `e4f6869` | 服务器隔离（档 2）、部署手册、key 同步脚本 |
| `3318555` | 文章 SEO 接线（页面原本忽略 seo 字段）+ 25 篇回填 + OG 用封面 |
| `d42e617` `8da6362` `e291c11` `71e87c5` `302903a` | 全局 AI 助手：SEO、媒体 alt、批量 alt、分类介绍、产品文案、可拖动、alt 全站回退 |
| `fbb71d5` | 站点体检（只读）+ 修哪里建议 |

---

## 4. 数据现状（2026-11-17 22:40）

| 项 | 值 |
|---|---|
| 产品 | 37（已发布 29；8 个 X-Ray 草稿是**业主主动暂缓**） |
| 文章 | 25（全部已发布，SEO 标题/描述 **25/25 已填**） |
| 产品分类 | 5 |
| 询盘 | 22（真实客户） |
| 上传文件 | 326（本地）/ 327（服务器多 1 个 Directus 自动缩略图，可重建） |
| 已描述图片 | 72 个文件有 title |
| 站点体检（线上实测） | 产品：2 个 SEO 标题偏短、8 个描述偏长（172–173 字符）；图片：56 张里 46 张无 alt、50 张未归文件夹；重复 SEO 标题 0 |

> **本地库是内容源头。** 服务器库由"本地 dump → 服务器恢复"同步（第 7.3 节）。

---

## 5. 业主已定的决策（不要再当成待办）

| 决策 | 内容 |
|---|---|
| 8 个 X-Ray 草稿 | **暂不上线**（只缺主图；媒体库里只有 XR-180C 的图，型号不同不得套用） |
| es / pt 翻译 | **暂不做**（界面 236 键已齐；`/es` 保持 noindex、生产 404） |
| HubSpot | **暂不接**（询盘只留本地；`hubspot_sync_status=not_configured` 不是故障） |
| WhatsApp | 保持 `wa.me` 点对点人工接，不做自动回复 |
| 图片 | **必须人工上传**；AI 只做"从图库挑 + 写 alt"，**绝不生成设备照片** |
| 稿件 | AI 出候选，**人确认才写库**；发布必须人点 |

---

## 6. 未完成 / 下一步

| 优先级 | 项 | 说明 |
|---|---|---|
| 高 | **Hero 文案重写**（13 页） | 需要新 target + proposal/confirm + 面板动作（`site_content` 的 title/body/eyebrow） |
| 高 | **跨集合批量** | 现有批量只有"媒体 alt 5 张/次"；需要一个通用批量运行器 + 预览列表 |
| 中 | 线上 46 张图补 alt | 媒体库 → ✦ AI →「Describe up to 5」，每轮 5 张，逐条确认 |
| 中 | 8 个产品描述偏长、2 个标题偏短 | 站点体检已列出，用助手或手动改 |
| 中 | `www.tuboluo.com` | DNS 仍指向停放商 `203.161.32.251`，需业主改 A 记录到 `43.165.125.203`，之后签 www 证书 |
| 低 | 切 `litubo.com` | 现指向 Wix（`185.230.63.x`）；`www.litubo.com` 在 Cloudflare。切换前要抄下原解析做回滚 |
| 低 | 产品页面模块/FAQ 文案、文章大纲起草 | 属于下一阶段，未开工 |

---

## 7. 运维手册（照着做）

### 7.1 部署一个新版本

```bash
# 本机：构建并打包（不要用 6GB 堆，会打死 DSH）
cd D:\LITUBO-website
NODE_OPTIONS=--max-old-space-size=2560 npx nuxt build
tar czf rel.tar.gz -C .output .
scp rel.tar.gz ubuntu@43.165.125.203:/tmp/
# 服务器：解到新目录、切软链、重启
REL=$(git rev-parse --short HEAD)
ssh ubuntu@43.165.125.203 "sudo mkdir -p /srv/litubo/releases/$REL && sudo tar xzf /tmp/rel.tar.gz -C /srv/litubo/releases/$REL && sudo chown -R litubo:litubo /srv/litubo/releases/$REL && sudo chmod -R a+rX /srv/litubo/releases/$REL && sudo ln -sfn /srv/litubo/releases/$REL /srv/litubo/current && sudo systemctl restart litubo"
```

**判据**：`systemctl is-active litubo` = active；`curl -sk -o /dev/null -w '%{http_code}' -H 'Host: tuboluo.com' https://127.0.0.1/` = 200。

### 7.2 回滚（≤2 分钟）

```bash
ssh ubuntu@43.165.125.203 "sudo ln -sfn /srv/litubo/releases/<上一个sha> /srv/litubo/current && sudo systemctl restart litubo"
```

### 7.3 内容同步（本地 → 服务器）

```bash
# 本机导出（用 docker cp，别用 PowerShell 管道，二进制会被改写）
docker exec litubo-cms-postgres-1 pg_dump -U litubo -d litubo_cms --clean --if-exists -Fc -f /tmp/sync.dump
docker cp litubo-cms-postgres-1:/tmp/sync.dump %TEMP%\sync.dump
scp %TEMP%\sync.dump ubuntu@43.165.125.203:/tmp/
# 服务器：先备份、停服务、恢复、起服务
ssh ubuntu@43.165.125.203 'sudo docker exec litubo-new-postgres-1 pg_dump -U litubo -d litubo_cms --clean --if-exists -Fc -f /tmp/pre.dump && sudo docker stop litubo-new-directus-1 && sudo systemctl stop litubo && sudo docker exec -i litubo-new-postgres-1 pg_restore -U litubo -d litubo_cms --clean --if-exists --no-owner --no-privileges < /tmp/sync.dump && sudo docker start litubo-new-directus-1 && sudo systemctl start litubo'
```

**判据**：产品 37 / 文章 25 / 询盘 22；`/` 200。**恢复会替换 Directus 用户与 token 行**，若站点报 503，用 7.4 重新同步 `DIRECTUS_TOKEN`。

### 7.4 换 AI Key

```bash
node scripts/sync-ai-env.mjs --host 43.165.125.203 --user ubuntu
```
脚本：读本地 `.env` → 替换服务器同名行 → 重启 → 用 sha256 前 8 位比对，**不打印密钥值**。

### 7.5 部署前隔离检查（只读）

```bash
ssh ubuntu@43.165.125.203 'bash -s' < deploy/check-isolation.sh
```

### 7.6 端口与资源分配

| 端口 | 谁 |
|---|---|
| 3311 | **LITUBO 应用**（回环） |
| 8055 | **LITUBO Directus**（回环） |
| 3322 / 8065 | anyivalves（**不要碰**） |
| 18075 | anyi staging 网关（**不要碰**） |
| 8080 | 旧 deploy 栈（**公网暴露，未处理**） |

内存：整机 3.7 GB；LITUBO 服务约 60 MB，Directus 约 220 MB，Postgres 约 35 MB。

---

## 8. 踩过的坑（同一条不要再踩）

1. **内存**：本机 15.5 GB，`nuxt build` 用 6 GB 堆会打死 DSH（`Desktop renderer exited: oom`）；PowerShell 曾报"页面文件太小"直接崩。构建用 `--max-old-space-size=2560`，typecheck 前先关 dev/Chrome。
2. **PowerShell 管道截断会杀进程**：`git merge ... | Select-Object -First 6` 关掉了管道，git 被中断，工作区半更新。**git 命令不要接 `Select-Object -First`。**
3. **`Set-Content -NoNewline` 会粘行**：写 `.env` 时整个文件被拼成一行；写多行文件用 `[IO.File]::WriteAllLines` 或 Python。
4. **Directus 字段名不统一**：`posts` 有 `updated_at`，`products` 的 `updated_at` **不可读**；`content_items` 没有 `slug`（在 `content_item_locales` 里）。查字段前先 `/fields`。
5. **后台 API 需要 Origin**：直接 curl 会被 `CSRF: Origin mismatch` 拦，要带 `Origin: https://tuboluo.com` 且 Host 一致。
6. **正文是分语言的**：`posts.body_*` 读取要取 `.en`，`String(对象)` 会得到 `[object Object]`（曾差点把正文写坏）。
7. **`www.tuboluo.com` 打不开**：DNS 指向停放商，不是服务器；改 DNS 才能签 www 证书。
8. **两个 agent 同时动服务器**：17:12 有一次并行的构建/部署（不是本会话），导致 DSH OOM。**同一时间只让一个 agent 操作这台机。**
9. **`.tools/` 132 MB**：本地下载的 Node 运行时，已加进 `.gitignore`，不要提交。
10. **截图/报告**：`reports/` 已忽略，不要入库。

---

## 9. 下次开工检查清单（先跑这些）

```bash
cd D:\LITUBO-website
git status --short            # 应为空
git log --oneline -3
git rev-parse --short HEAD    # 期望 fbb71d5 或更新

# 本地服务
docker ps --format '{{.Names}}\t{{.Status}}'   # 期望 litubo-cms-* 三个 Up
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8055/server/info   # 200
# 站点（生产包在服务器上，本地 dev 需自己起：npm run dev）

# 服务器
ssh ubuntu@43.165.125.203 'systemctl is-active litubo; readlink -f /srv/litubo/current'
ssh ubuntu@43.165.125.203 'bash -s' < deploy/check-isolation.sh
```

---

## 10. 一句话交接

> **代码在 `fbb71d5`（本地 = GitHub = 服务器 release），内容以本地 Directus 库为准并已同步到服务器；线上是 `tuboluo.com`；AI 助手在后台右上角，能做文章/内容 SEO、媒体 alt（含批量 5 张）、分类介绍、产品文案、站点体检；下一步优先做 Hero 文案与跨集合批量。**
