# 交接文件 —— 下一个会话从这里开始

> 写入：2026-11-17　分支：`work/c-refined-v1`　HEAD：`5f3fb25`
> **这是唯一入口。读完本文件即可无缝接手，不需要读上一轮对话。**

---

## 0. 三十秒读懂

**项目**：LITUBO 外贸官网（食品/包装检测设备）。Nuxt 3 + Directus 12 + PostgreSQL。
**仓库**：`D:\LITUBO-website`（**注意：不是 `D:\LITUBO_New_Website`，那是空目录**）
**当前任务**：按 Codex 的 V2 设计包做**后台**改造，计划号 `BACKEND-DSH-V2-0e6e98d`。
**进度**：**V2-00 ~ V2-05 全部完成**（V2-04 十三页接完、V2-05 分类 tab 做完）。**下一步 V2-06（询盘 AI）**，然后 V2-07（视觉验收）。
**最近两个提交**：`2df3f73`（V2-04 收尾）、`5f3fb25`（V2-05 分类 tab）。都只在本地，**未推送**。

---

## 1. 立刻要做的三件事

```powershell
# 1) 确认位置和状态
Set-Location 'D:\LITUBO-website'
git log --oneline -3
git status --short          # 应该是干净的

# 2) 起 Docker（很可能停着，这是本项目的常见问题）
& 'C:\Program Files\Docker\Docker\resources\bin\docker.exe' start litubo-cms-postgres-1 litubo-cms-directus-1
# 等 30-60 秒，直到这个返回 200：
Invoke-RestMethod 'http://127.0.0.1:8055/server/info'

# 3) 起 dev server（用受管后台任务，不要用普通 shell）
$e = fnm env --shell powershell 2>&1; Invoke-Expression ($e -join "`n"); $null = fnm use 22.22.2
$env:CMS_MODE = 'directus'
npm run dev
```

Node 用 `22.22.2`（`fnm use 22.22.2`）。

> **注意：2026-11-17 11:10 业主指示停掉了 Supabase（11 个）和 deploy（3 个）两套容器**，为了给这台机器腾内存。如果别的项目要用它们：
> ```powershell
> docker start $(docker ps -aq --filter label=com.docker.compose.project=supabase)
> docker start $(docker ps -aq --filter label=com.docker.compose.project=deploy)
> ```
> 容器数据都在卷里，停容器没有删数据。

---

## 2. 设计包在哪

```
docs/project/reviews/2026-11-17-BACKEND-DSH-V2-0e6e98d/
├── 00-READ-ME-FIRST-V2.md
├── CURRENT-PLAN.json              plan_id / base_commit / excluded_plan
├── 01-specs/                      01报告 07施工 08UI 09验收 10API
├── 02-ui/                         UI-01..UI-05 五张设计图
└── 03-tables/                     02对应表 03字段 04路由 05队列 06AI 11Hero
```

**必读顺序**（原包要求，不要跳）：`00` → `01` → `07` → `08` → `09` → `10` → `02/03/04/05/06/11`。

**旧方案（`c963115` 版）已被业主明确作废，不要混用它的任何 UI 或 API 建议。**

---

## 3. 施工账本（权威进度表）

```
docs/project/BACKEND-DSH-V2-STATE.md
```

**每完成一批就更新它。** 下面是我停下的实际状态。

---

## 4. 已完成

| 任务 | 提交 | 做了什么 |
|---|---|---|
| **V2-00** | `d08ac31` | 建账本；核实 7 个日常页 / 7 个工具页 / posts 是真源 / `site_content` 24 列够用 |
| **V2-01** | `1e780e6` | **修称重三字段保存丢失**（表单有、payload 没有）；新建接口补白名单+枚举；删 `SMTP_HOST=...` 占位符；后台未读徽标 |
| **V2-02** | `55abc4a` | 五色分区导航；4 个重复路径改跳转；3 个独有工具保留 |
| **V2-03** | `55abc4a` | `/admin/posts`（读 `posts`，非 `content_items`）+ GET/PATCH |
| **V2-04** | `55abc4a` `b707a28` `2df3f73` | 13 页注册表；`/admin/page-content`；公开接口 `page-hero`；`usePageHero` 重写；**13/13 页已接** |
| **V2-05** | `0837b49` `5f3fb25` | `posts.cover_fit`（唯一新增列）；迁移 10 篇；DTO 输出 `coverFit`；页面优先读它。`/admin/page-content` 五个 tab，分类 tab 直接读写 `product_categories`，新增 `categories.get/patch.ts` |

### 已验证的（本地实测，不是"看代码觉得对"）

- 称重字段 `false` 与 `null` 保持区别（5/5 用例）
- 停 Directus 后 A01/A02 返回 503，假 slug 返回 404
- `coverFit=contain` / `cover` 在接口和渲染都正确
- Hero 覆盖：8 页建行→读 HTML→删行→回默认，无残留；CTA 半对用例保留默认整对
- 分类 tab：浏览器点选 5 个 tab、深链切 tab、0 console error；API 拒绝 4 类输入；含图片的往返还原一致
- 后台守卫：未登录 `/admin/page-content` → 302 `/admin/login`；无 `Origin` 的 PATCH → 403

---

## 5. 下一步：V2-06 询盘 AI（V2-04/V2-05 已完成，不要重做）

已完成的部分见 `BACKEND-DSH-V2-STATE.md` 的「V2-04 前台接线实测」「V2-05 分类小 tab 实测」，**两张表里已写清实现方式和边界，先读再动手**。

### V2-06：按 `01-specs/10-MINIMAL-SCHEMA-API-V2.md`

```
POST /api/admin/inquiries/:id/ai-proposal   只返回候选，不写 inquiries
POST /api/admin/inquiries/:id/ai-confirm    校验绑定/过期/原文未变，写现有 7 个 ai_* 列
Discard                                     只在浏览器丢候选，不清原文
```

**DeepSeek provider：已核实为「已配置」**（2026-11-17 查 `.env`，只看了是否存在、没打印值）：

```
AI_DEFAULT_PROVIDER = deepseek
DEEPSEEK_MODEL      = deepseek-v4-flash
DEEPSEEK_API_KEY    = 存在（35 字符，sk- 开头）
```

所以不要走"显示 Unavailable"那条分支。**但先读下面两条再动手：**

1. **业主尚未确认"是否允许把真实客户询盘内容发给 DeepSeek"**（账本「待业主确认 #2」仍未关闭）。本机库里有 22 条真实询盘。做接口没问题，**不要去跑一份带真实客户数据的联调**；用 `example.invalid` 之类的合成内容验证链路。
2. **可复用的现成设施**（不要另写一套 provider）：
   ```
   server/utils/aiProviderRegistry.ts        provider 注册表
   server/utils/deepseekStructuredProvider.ts DeepSeek 结构化调用
   server/utils/aiProposalEngine.ts           候选生成
   server/utils/aiTargetContract.ts           契约
   server/utils/aiContentIntake.ts            原文→源引用
   server/api/admin/ai/providers.get.ts       已配置查询接口
   ```

硬约束（原包要求，别放宽）：`ai_recommended_products` 和 `ai_draft_reply` 一期**不填**；`ai_confidence` 无依据时为 `null`；不许自动回复 / 自动分配 / 自动生成参数；Confirm 必须是**人**按的。

### V2-07：视觉验收

1440 + 390 截图，与 `02-ui/` 五张图并排，填差异表。**不能用设计图冒充实现截图。**
截图工具：`scripts/screenshot-viewport.mjs <url> <w> <h> <out.png>`，需要先起 headless Chrome 并开放 `127.0.0.1:9222`（CDP），否则报 `ECONNREFUSED 9222`。

---

## 6. 踩过的坑（别再踩）

### 坑 1：加数据库字段后接口 503

**症状**：新列建好了、数据也对，但 API 返回 503。

**原因**：Directus 公开服务角色 `site-readonly-policy` 的**字段白名单**没含新列。

**已踩两次**（称重三字段、`posts.cover_fit`）。**加任何新列后必须同步加白名单**：

```python
# 查：GET /permissions?filter[collection][_eq]=<表>
# 改：PATCH /permissions/<id> { "fields": [...旧, "新列"] }
```

### 坑 2：Chrome headless 低于 500px 只是裁切

`--window-size=320` 不会真的按 320 布局，只是把 500px 的渲染裁掉右边。
**我为此追过一个根本不存在的"手机横向溢出"bug。**

**正确做法**：用 `scripts/screenshot-viewport.mjs`（CDP `Emulation.setDeviceMetricsOverride`），它会同时报 `documentWidth` 和 `overflow`。

### 坑 3：Docker Desktop 会自己停

这个项目里反复发生。现象：`docker` 命令报 `npipe:////./pipe/dockerDesktopLinuxEngine` 找不到。
**处理**：启动 `Docker Desktop.exe`，等就绪，再 `docker start` 两个容器。

### 坑 4：PowerShell 偶尔整个崩掉

见过 `Fatal error. Releasing the double mapped memory failed`。
**处理**：重试一次通常就好。**不要**由此推断代码有问题。

### 坑 5：`.env` 里的占位符

`SMTP_HOST=...`（字面三个点）曾导致每条询盘都报"邮件发送失败"。
**已删。** 现在 SMTP 未配置时只提示一次。

### 坑 6：这台机器只有 15.5 GB 内存 —— 大堆构建会打死 DSH

**现象**：DSH 弹「应用无法启动或已意外停止 / Desktop renderer exited: oom」。
崩溃日志在 `%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-*-renderer.log`，`--- error ---` 一行就是 `oom`。

**原因**（2026-11-17 实测，两次）：本机同时跑着 Docker Desktop（PostgreSQL + Directus + 一整套 Supabase + deploy 栈）、Electron GUI 和 Nuxt dev server，空闲物理内存常年在 **1 GB 上下**。此时再跑
`NODE_OPTIONS=--max-old-space-size=6144 nuxt build`，Windows 会先把 Chromium 渲染进程 OOM 掉 —— **不是 DSH 的 bug，也不是会话文件损坏，不要重装**。

**处理**：

1. 先看 `Get-CimInstance Win32_Process -Filter "Name='node.exe'"`，把还在跑的孤儿 `nuxt build` / `nuxt dev` 杀掉（它会一直占着 1 GB+）
2. 半成品 `.output` 要删掉，否则可能被误当成"构建成功"
3. **在本机 GUI 开着的时候不要跑 `nuxt build`**。用 `npm run typecheck` + dev server 实测 + 浏览器 CDP 检查代替；真要构建，先关掉无关的 Docker 栈或退出 GUI
4. 跑 `typecheck` 前先关掉 dev server 和 headless Chrome：它们的**提交内存**远大于工作集（实测关掉两项后余量从 2.7 GB 回到 3.9 GB，typecheck 一次通过）

**根因数字**（2026-11-17 11:10 实测，重启前）：物理 15.5 GB、页面文件 16 GB、提交上限 31.5 GB、**已用 28.8 GB**。
进程私有提交合计只有 20.3 GB（WSL 虚拟机 4.6 GB、Edge 1.8 GB、WebView2 1.2 GB、ChatGPT 1.2 GB、DSH 1.1 GB），剩下约 8.5 GB 是内核/会话等非进程占用 —— **这部分只能靠重启回收**。
同一批崩溃日志：10 次里 6 次发生在 DSH 接手之前（06:04–10:26），所以这是机器长期贴着上限，不是某次操作或删文件造成的。

**旁证**：`nuxt dev` 启动时偶尔会刷 `Failed to resolve import "#app-manifest"` —— 这是启动竞态（`.nuxt/manifest/meta/dev.json` 在报错后几秒才写出来），页面照常 200，水合正常，`0 console error`。不要在这上面浪费时间。

---

## 7. 当前环境的事实

| 项 | 状态 |
|---|---|
| SMTP 邮件通知 | **未配置**（业主选方案 C：用后台未读徽标代替） |
| 企业微信 webhook | **未配置** |
| 后台未读徽标 | ✅ 已做，显示 `status=new` 的数量（22 条） |
| DeepSeek AI | ✅ **已配置**：`AI_DEFAULT_PROVIDER=deepseek`、`DEEPSEEK_MODEL=deepseek-v4-flash`、`DEEPSEEK_API_KEY` 存在。**但业主尚未确认可否用真实客户数据调用** |
| 询盘总数 | 22 条（测试数据已清理） |
| 已发布产品 | 29 个（4 分类，含 conveyors） |
| 已发布文章 | 25 篇（共 33 条 posts） |
| 称重型号归类 | 12/12 |
| `site_content` 行数 | 9 行（1 个 `home.hero` + 8 个首页块）；其余 12 个 hero key 首次发布时才建行 |
| Supabase / deploy 容器 | 2026-11-17 11:10 由业主指示**已停止**（腾内存），数据在卷里 |

---

## 8. 规矩（业主明确要求，不要违反）

```
❌ 不部署、不改 DNS、不碰 Wix
❌ 不对客户外发
❌ 不自动启用生产 AI
❌ 不编造产品参数 / 精度 / 认证 / 交期 / 客户案例
❌ 不把"代码里有"说成"已经跑通"
❌ 不把"设计图"当"实现截图"
✅ 小批提交，每批验证并演练回退（要求 ≤5 分钟）
✅ 回退只撤该批改动，不整库恢复、不删新列
✅ 无法验证的，明说无法验证
```

---

## 9. 常用命令

```powershell
# 类型检查
$e = fnm env --shell powershell 2>&1; Invoke-Expression ($e -join "`n"); $null = fnm use 22.22.2
npm run typecheck

# Directus 管理员查询（凭据在 .env，不要打印）
# DIRECTUS_ADMIN_EMAIL / DIRECTUS_ADMIN_PASSWORD

# 窄视口截图
node scripts/screenshot-viewport.mjs http://localhost:3000/company/about 390 1200 out.png
```

---

## 10. 一句话接续

> **读 `docs/project/BACKEND-DSH-V2-STATE.md` 看进度，然后继续 V2-04 剩下的 9 个页面。**
> 接法照 `pages/company/about.vue` 的 `usePageHero` 用法抄。
