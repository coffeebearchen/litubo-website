# 交接文件 —— 下一个会话从这里开始

> 写入：2026-11-17　分支：`work/c-refined-v1`　HEAD：`b707a28`
> **这是唯一入口。读完本文件即可无缝接手，不需要读上一轮对话。**

---

## 0. 三十秒读懂

**项目**：LITUBO 外贸官网（食品/包装检测设备）。Nuxt 3 + Directus 12 + PostgreSQL。
**仓库**：`D:\LITUBO-website`（**注意：不是 `D:\LITUBO_New_Website`，那是空目录**）
**当前任务**：按 Codex 的 V2 设计包做**后台**改造，计划号 `BACKEND-DSH-V2-0e6e98d`。
**进度**：V2-00 ~ V2-05 基本完成，V2-04 前台只接了 4/13 页，V2-06/V2-07 未做。

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
| **V2-04** | `55abc4a` `b707a28` | 13 页注册表；`/admin/page-content`；公开接口 `page-hero`；`usePageHero`；**只接了 4 页** |
| **V2-05** | `0837b49` | `posts.cover_fit`（唯一新增列）；迁移 10 篇；DTO 输出 `coverFit`；页面优先读它 |

### 已验证的（本地实测，不是"看代码觉得对"）

- 称重字段 `false` 与 `null` 保持区别（5/5 用例）
- 停 Directus 后 A01/A02 返回 503，假 slug 返回 404
- `coverFit=contain` / `cover` 在接口和渲染都正确
- 邮箱 HTML 注入被拒绝；备件不要求姓名但要求型号

---

## 5. 未完成（照这个顺序做）

### V2-04 剩余：9 个页面还没接 Hero

已接：`about` `quality-manufacturing` `downloads` `videos`

**待接**：

```
company/global-service        → company.global-service
company/become-a-partner      → company.become-a-partner
resources/index               → resources.overview
support/[requestType]         → support.technical-support / manual-request / service-training（三条 key）
support/request-spare-parts   → support.request-spare-parts
support/send-product-test     → support.send-product-test
pages/index.vue               → home（首页最特殊，有 9 个原有块）
```

**接法**（照已接的 4 页抄）：

```ts
const { hero } = await usePageHero('company.global-service', {
  eyebrow: '...', title: '...', body: '...',
  ctaPrimaryLabel: '...', ctaPrimaryPath: '...',
})
```

模板里把写死的 `eyebrow` / `h1` / `intro` 换成 `{{ hero.eyebrow }}` / `{{ hero.title }}` / `{{ hero.body }}`。

**注意**：
- `pages/support/[requestType].vue` 是动态路由，服务 3 个 key，要按 `requestType` 选 key
- `global-service` 和 `become-a-partner` 目前的标题来自 i18n（`t('pages...')`），替换时保留 i18n 作为默认值
- 首页有 9 个原有 `site_content` 块，**不要动它们**，只接 hero

### V2-05 剩余：分类小 tab

`/admin/page-content` 加第三个 tab「Product categories」，读写现有 `product_categories`。
**不要**把分类名字/简介/图片复制进 `site_content`。

### V2-06：询盘 AI（未开始）

按 `01-specs/10-MINIMAL-SCHEMA-API-V2.md`：

```
POST /api/admin/inquiries/:id/ai-proposal   只返回候选，不写 inquiries
POST /api/admin/inquiries/:id/ai-confirm    校验绑定/过期/原文未变，写现有 7 个 ai_* 列
Discard                                     只在浏览器丢候选，不清原文
```

**先查 DeepSeek provider 配没配。** 没配就显示 `Unavailable`，保留人工流程——这也算完成。

硬约束：`ai_recommended_products` 和 `ai_draft_reply` 一期**不填**；`ai_confidence` 无依据时为 `null`；不许自动回复/分配/生成参数。

### V2-07：视觉验收

1440 + 390 截图，与 `02-ui/` 五张图并排，填差异表。**不能用设计图冒充实现截图。**

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

---

## 7. 当前环境的事实

| 项 | 状态 |
|---|---|
| SMTP 邮件通知 | **未配置**（业主选方案 C：用后台未读徽标代替） |
| 企业微信 webhook | **未配置** |
| 后台未读徽标 | ✅ 已做，显示 `status=new` 的数量（22 条） |
| DeepSeek AI | **未核实** |
| 询盘总数 | 22 条（测试数据已清理） |
| 已发布产品 | 29 个（4 分类，含 conveyors） |
| 已发布文章 | 25 篇（共 33 条 posts） |
| 称重型号归类 | 12/12 |

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
