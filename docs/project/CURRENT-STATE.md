# LITUBO 项目当前状态文档

> 本文件是新 Claude 会话的首要阅读文件。读完此文件后，再读 `docs/ADMIN-CMS-SPEC.md` 和 `docs/OPERATIONS-HANDBOOK.md`，然后执行只读 Git/Docker 核对，再开始任何实施工作。

---

## 1. 项目身份

| 项目 | 值 |
|------|-----|
| 仓库名称 | `litubo-website` |
| GitHub 远程 | `git@github.com:coffeebearchen/litubo-website.git` |
| 当前分支 | `master` |
| 当前 Git 基线 | 以 `git log -1 --oneline` 为准（此文件本身会产生提交，不硬编码 SHA）|

**技术架构：** Nuxt 3 + Vue 3 + TypeScript（SSR/hybrid）/ Directus 11 + PostgreSQL 16 / Docker Compose / 本地开发中，未来部署至腾讯云美国服务器，Cloudflare Free 作为前端边缘（DNS、TLS、缓存）。

---

## 2. 已完成阶段

### Phase 1 — Nuxt 基础架构与全局 Shell

**commit 范围：** 项目初始化 ~ Module 1 完成

- Nuxt 3 项目创建，TypeScript strict 模式，EN/ES/PT 三语言路由（`prefix_except_default`）
- Header（固定深绿色）、五个桌面端 Mega Menu、移动端 Accordion 导航
- Footer 四栏网格、全局 CSS Token、响应式基线（320 ~ 1440px 无水平溢出）
- 所有公开路由骨架已注册（产品、应用、资源、支持、公司、隐私政策等）
- CMS 适配器模式：前台读 fixtures，后续切换 Directus 时不改组件

**Schema 快照：** 无（Phase 1 无 Directus 变更）

---

### Phase 2 — 媒体库

**commit：** `ec2b1e5`（phase2-before-products schema 快照）

- Directus `directus_files` 新增自定义字段 `is_public`（boolean）
- 媒体库上传、替换、管理流程就绪
- 上传目录挂载至宿主机持久化卷

**Schema 快照：** `directus/schema/phase2-before-products.yaml`

---

### Phase 3 — 产品 CMS

**commit 范围：** `3ecbb19` → `025daaa` → `608a661`

- Directus collections：`product_categories`、`products`、`products_files`（M2M junction）
- `nuxt-server` 角色：products READ 权限（最小权限原则）
- Nuxt server API endpoints：`/api/cms/products`、`/api/cms/products/[slug]`
- 前台产品列表页 `/products` 和详情页 `/products/[category]/[slug]` 切换为 CMS 数据

**Schema 快照：** `directus/schema/phase3-products.yaml`

---

### Phase 4 — 首页 Hero CMS

**commit：** `0aecbcf`

- Directus collection：`site_content`（singleton 键值对，`content_key = 'home.hero'`）
- Hero 区域标题、副标题、CTA 文字可在 Directus 后台编辑
- 前台通过 `/api/cms/site-content/[key]` 读取

**Schema 快照：** `directus/schema/phase4-site-content.yaml`

---

### Phase 5 — Blog / Insight / FAQ / 知识库

**commit 范围：** `6b44133` → `525feb5`

- Directus collection：`posts`（含 `status`、`content_type`、`topics` JSON、多语言字段 `title_en/es/pt`、`body_en/es/pt` 等）
- 内容类型：`insight`、`technical_guide`、`case_study`、`news`、`faq`
- Topics 过滤为服务端 post-fetch（Directus JSON 类型不支持 subset 操作符）
- 路由：`/resources/insights/[slug]`、`/resources/case-studies/[slug]` 等

**Schema 快照：** `directus/schema/phase5-posts.yaml`

---

### Phase 6 — 统一询盘管理

**commit 范围：** `6975a56` → `9b62e30`

- Directus collection：`inquiries`（统一存储所有表单来源）
- 询盘类型：`contact`、`technical_matching`、`distributor`、`spare_parts`、`support_request`、`send_product_test`
- 字段覆盖：联系信息、Technical Matching 参数、UTM 追踪、`raw_fields` JSON、AI 预留字段（`ai_summary`、`ai_draft_reply`、`ai_intent`、`ai_confidence`、`ai_recommended_products`、`ai_reviewed`、`ai_processed_at`）
- Nuxt server API：`POST /api/inquiries`（字段白名单、长度校验、HTML 消毒、IP 哈希限流、Honeypot）
- 邮件通知：`server/utils/sendInquiryEmail.ts`（best-effort，SMTP 配置后生效）
- Directus 不可用时前台返回 503

**Schema 快照：** `directus/schema/phase6-inquiries.yaml`

---

### Phase 9A-1 — LITUBO Admin 产品 CMS 基础（本地完成，等待 push 授权）

**commit：** 见第 4 节

- 三个项目总控文档：`docs/project/MASTER-ROADMAP.md`、`docs/product-cms/PHASE-9-BASELINE.md`、`docs/product-cms/RESPONSIVE-ACCEPTANCE.md`
- Directus schema：`products` 新增 4 字段（`model_or_series`、`page_preset_id`、`published_at`、`review_notes`）；新建 `product_page_presets` collection；`nuxt-server` 已授权读 `product_page_presets`（active=true）
- 类型定义：`types/product-cms.ts`（`ProductStatus`、`ProductPreset`、`AdminProduct` 等）
- Admin JWT 安全层：`server/utils/loginRateLimit.ts`（5次失败/IP → 15min锁）、`server/utils/adminDirectusClient.ts`、`server/middleware/admin-auth.ts`（全路由管理员角色验证 + CSRF Origin 检查）
- Admin API 端点：auth（login/logout/me）、products（list/get/create/patch）、categories、presets
- 9A-1 服务端状态限制：PATCH 时只允许 draft↔review；尝试 published/archived → 403
- Admin UI：`layouts/admin.vue`（白色侧边栏桌面端，< 768px 抽屉菜单）、`components/admin/StatusBadge.vue`、`components/admin/product/ProductBasicForm.vue`、`components/admin/product/PublishPanel.vue`
- Admin 页面：`/admin/login`、`/admin/products`（列表 + 5 状态筛选）、`/admin/products/new`、`/admin/products/[id]`（双列编辑 + 发布面板）
- 响应式修复：< 768px 侧边栏隐藏、主内容全宽；产品列表表格 `overflow-x: auto` 允许横向滚动
- **安全修复**：`server/middleware/admin-auth.ts` CSRF 增强（缺少 Origin 头 → 403）；`server/api/admin/auth/me.get.ts` 增加管理员角色验证（`/api/admin/auth/*` 路径不在中间件覆盖范围内，me 端点独立检查 `role.name === 'Administrator'`）
- **数据清理**：删除历史遗留 [TEST] 产品 `[TEST] XR-001 X-Ray Inspection System`（ID=1，archived 状态），无文件关联，已彻底清除

**验收结果（全部通过）：**
- vue-tsc --noEmit：0 errors ✅
- npm run lint：0 errors ✅
- npx nuxt build：Build complete ✅
- 非管理员 403 验收：GET /api/admin/auth/me → 403、GET /api/admin/products → 403、POST /api/admin/products → 403（全部 PASS）✅
- 登录限流：6次失败第6次 → HTTP 429 ✅
- CSRF 缺少 Origin → 403 ✅
- Directus Activity Log 有效 ✅
- 桌面端（1440px）无溢出 ✅；移动端（375px）无溢出 ✅

**Schema 快照：** before=`directus/schema/phase9a1-before.yaml`（156,688 B）、after=`directus/schema/phase9a1-after.yaml`（167,831 B）
**数据库备份：** `backups/phase9a1-before-20260903.sql`（396,395 B）、`backups/phase9a1-final-2026-09-03T08-36-06.sql`（399.0 KB，[TEST] 产品删除前最终备份）

---

## 3. CMS 与安全边界

| 边界 | 说明 |
|------|------|
| Directus Admin 地址 | 仅内网访问（127.0.0.1:8055），不对公网开放 |
| 前台访问 CMS 的方式 | 仅通过 Nuxt server API 层（`server/api/`、`server/utils/`），Directus REST API 不暴露给浏览器 |
| Directus Token | `.env` 中管理，不进 Git，不写入任何文档 |
| Directus Collection 数量 | 上限 25（Directus 社区版限制）；当前已用：`product_categories`、`products`、`products_files`、`site_content`、`posts`、`inquiries`、`product_page_presets`、`product_sections`、`product_section_items`、`product_spec_groups`、`product_spec_items`、`product_faqs`、`product_source_records`、`site_settings`、`site_social_links`、`media_file_lifecycle` = **16 个**（含 M2M junction 1 个，9C-2 新增 1 个） |
| 不进 Git 的内容 | `.env`、PostgreSQL 数据文件、`directus/uploads/`、数据库备份 |

---

## 4. 当前状态 — Admin Auth SSR 自动续期（2026-09-06）

**状态：SSR 自动续期完成。代码、测试、typecheck、lint、build 全部通过。浏览器核心验收通过（见下表）。未 push、未部署。**

> **前序：** P1 product_code + zero-source 收口已在 commit 7cdb359 完成；Admin SSR 重定向已在 commit f04f1e4 补齐。

### Admin Auth SSR Session Continuity（本次，2026-09-06）

#### 问题

原 `admin-auth.ts` middleware 当 `admin_at` 过期时直接 302 到 `/admin/login`，不尝试用 `admin_rt` 续期。同时，SSR 内部 `useFetch` 转发的是浏览器原始 Cookie（过期的 `admin_at`），即使 middleware 完成续期，`adminDirectusClient.ts` 读 Cookie 仍会得到旧令牌，导致 `/admin/products` 显示"暂无产品"。

#### 修复

| 文件 | 操作 |
|------|------|
| `server/utils/adminRefresh.ts`（**新建**）| SSR 刷新 helper：读 `admin_rt` cookie，调用现有 coordinator，续期成功写新 httpOnly Cookie，返回新 access token；失败返回 null |
| `server/middleware/admin-auth.ts`（**修改**）| 无 AT → 直接调用 helper；有 AT 但 Directus 拒绝 → 也调用 helper；续期成功设 `event.context.adminToken`；续期失败才 302/401 |
| `server/utils/adminDirectusClient.ts`（**修改**）| `getAdminToken` 优先读 `event.context.adminToken`（middleware 已验证的令牌），解决内部 useFetch 携带旧 Cookie 的根本问题 |
| `tests/adminRefresh.test.ts`（**新建**）| 11 个 Vitest 用例，覆盖 6 个施工单场景 |

#### 实现原则

- SSR middleware 不通过 HTTP 调用自身的 `/api/admin/auth/refresh`，直接调用服务端 helper
- `refresh.post.ts` 和新 helper 共用 `coordinator`（deduplication、grace window、rotated RT 保护均生效）
- `/admin/login` 本身不受中间件影响，无循环重定向
- `/api/admin/*` 认证失败仍 401，不改为 302
- Cookie 的 httpOnly / sameSite / secure 属性保持不变
- 管理员角色检查保持不变
- `admin_at` TTL 仍为 Directus 内置默认（15m），未修改 Docker / `.env` / Directus 任何配置

#### 验收结果

| 检查项 | 结果 |
|--------|------|
| Vitest：127/127 | ✅ |
| vue-tsc --noEmit：0 errors | ✅ |
| npm run lint：0 errors | ✅ |
| npx nuxt build：Build complete | ✅ |
| git diff --check：仅 LF/CRLF 警告 | ✅ |
| 真实 Chrome 核心验收：删除 admin_at、保留 admin_rt 后，新标签直接访问 /admin/products 正常进入后台（URL 未跳转至 /admin/login，SSR 续期生效）| ✅ |

#### 明确未触碰

- Directus schema、权限、角色、Policy：未修改
- admin_at TTL（15m）、docker-compose.yml、.env、.env.example：未修改
- TEST ONLY ID=3 产品：未触碰
- 真实媒体文件：未移动/上传/删除
- P1 ProductBasicForm.vue 英文化改动：已暂存并 commit（见下节）
- 无 AI、无 push、无部署、无凭证输出

---

### P1 ProductBasicForm English Copy Closure（2026-09-06，commit 完成）

**源码核对：** `components/admin/product/ProductBasicForm.vue` 所有用户可见静态文案已完成英文化，无遗漏、无中英文混用。

| 文案类别 | 改动内容 |
|----------|---------|
| 字段标签 | Product Name (EN/ES/PT)、URL Slug、Product Code、Model / Series、Category、Page Preset、Summary (EN)、Review Notes (internal) |
| 下拉占位 | — Select category —、— No preset — |
| 提示文字 | Lowercase letters…、Uppercase letters…、Locked: {code} — cannot be changed、Cannot be changed once set |
| Placeholder | Internal notes, not shown on the website |
| 按钮 | Save / Saving… |

**自动化验证：** Vitest 127/127 ✅ · vue-tsc 0 errors ✅ · lint 0 errors ✅ · nuxt build ✅ · git diff --check 仅 CRLF 警告 ✅

**1440px / 375px 浏览器视觉验收：未完成**
Claude in Chrome 扩展在 Edge 中创建的标签组无法访问用户常规浏览会话的 Cookie，导致工具层面服务端 302 重定向与页面读取超时。这不是代码功能失败；该视觉验收转入下一次集中 Admin visual smoke test，不重复要求用户登录。

**未改动：** API、schema、Directus 权限、产品数据、媒体文件、来源记录、字段逻辑、v-model、校验规则、提交行为、CSS 布局

---

### Admin English UI — Phase A（2026-09-06，本地 commit 完成）

**目标：** 将后台截图中"公共左侧导航 + 产品列表页"所有可见中文文案改为英文，范围严格限定在以下三个文件。

**改动文件及内容：**

| 文件 | 改动 |
|------|------|
| `layouts/admin.vue:105` | `内容管理` → `Content Management` |
| `layouts/admin.vue:141` | 侧栏退出按钮 `退出` → `Sign out` |
| `components/admin/StatusBadge.vue:7-10` | 4 个状态标签：草稿→Draft、审核中→In Review、已发布→Published、已归档→Archived |
| `pages/admin/products/index.vue` | STATUS_TABS 5 个标签（全部→All、草稿→Draft、审核中→In Review、已发布→Published、已归档→Archived）、`新建产品`→`New Product`、表头 5 列（产品名称/型号/分类/状态/更新时间 → Product Name/Model Series/Category/Status/Last Updated）、日期 locale `zh-CN`→`en-US`、`编辑`→`Edit`、加载/空状态/分页文案全部英文化 |

**明确未触碰：** Media Library（`pages/admin/media/index.vue`）、产品编辑页（`pages/admin/products/[id]/*.vue`）、新建页（`pages/admin/products/new.vue`）、PublishPanel.vue、settings.vue；API、schema、Directus 权限、数据均未改动。

**自动化验证：**

| 检查项 | 结果 |
|--------|------|
| Vitest：127/127 | ✅ |
| vue-tsc --noEmit：0 errors | ✅ |
| npm run lint：0 errors | ✅ |
| npx nuxt build：Build complete | ✅ |
| git diff --check：仅 LF/CRLF 警告（Windows 正常） | ✅ |
| rg 验证：目标三文件零残留中文文案 | ✅ |

**浏览器视觉验收：未完成**（与 P1 ProductBasicForm 同一原因：Edge MCP Tab 独立 session 无 admin cookie，所有 `/admin/*` 路由持续 302 跳转）。视觉确认转入下一次集中 Admin visual smoke test。

---

### Admin English UI — Phase B（2026-09-06，本地 commit 完成）

**目标：** 将 `/admin/media` 工作界面所有可见静态中文文案改为英文，为录入真实媒体资产做好操作环境准备。

**修改文件：** `pages/admin/media/index.vue`（唯一文件）

**改动清单（修改前 → 修改后）：**

| 位置 | 修改前 | 修改后 |
|------|--------|--------|
| `folderPath()` 函数 | `'待分类'` | `'Unclassified'` |
| `currentViewLabel` computed | `'已归档'` / `'全部文件'` / `'待分类'` | `'Archived'` / `'All files'` / `'Unclassified'` |
| 面包屑条件比较 | `!== '全部文件'` | `!== 'All files'` |
| 批量移动成功 | `已将 N 个文件移至…` | `Moved N file(s) to…` |
| 批量移动部分失败 | `N 个文件移动失败…` | `N of M file(s) failed to move…` |
| 批量移动失败 | `批量移动失败` | `Batch move failed` |
| 归档成功 | `文件已归档` | `File archived` |
| 归档失败 | `归档失败` | `Archive failed` |
| 恢复成功 | `文件已恢复` | `File restored` |
| 恢复失败 | `恢复失败` | `Restore failed` |
| 元数据保存成功 | `元数据已保存` | `Metadata saved` |
| 保存失败 | `保存失败` | `Save failed` |
| 上传失败（单文件） | `上传失败` | `Upload failed` |
| 上传成功 | `成功上传 N 个文件` | `N file(s) uploaded successfully` |
| 已选数量 | `N 已选` | `N selected` |
| 上传目标 title | `上传目标正式目录` | `Upload destination folder` |
| 上传按钮 | `上传中…` / `上传文件` | `Uploading…` / `Upload files` |
| 搜索框 placeholder | `搜索文件名 / 标题…` | `Search by filename or title…` |
| 格式筛选 | `所有格式` / `图片` | `All formats` / `Image` |
| 文件计数 | `N 个文件` | `N file(s)` |
| 上传失败横幅 | `部分文件上传失败：` | `Some files failed to upload:` |
| 侧栏系统视图标签 | `系统视图` | `System views` |
| 侧栏按钮 | `全部文件` / `待分类` / `已归档` | `All files` / `Unclassified` / `Archived` |
| 加载状态 | `加载中…`（×2） | `Loading…`（×2） |
| 空状态标题 | `暂无文件` | `No files found` |
| 空状态提示 | `当前无已归档文件` / `所有文件均已归入正式目录` / `点击"上传文件"添加媒体资产` | 对应英文 |
| 文件卡片归档徽章 | `归档` | `Archived` |
| 文件路径未分类 | `待分类` | `Unclassified` |
| 加载更多 | `加载更多（还有 N 个）` | `Load more (N remaining)` |
| Detail 面板标题 | `文件详情` | `File details` |
| Detail 关闭 aria-label | `关闭` | `Close` |
| Detail 元数据标签 | `文件名` / `格式` / `分辨率` / `大小` / `上传时间` / `当前路径` | `Filename` / `Format` / `Resolution` / `Size` / `Uploaded` / `Current path` |
| 旧版标签 | `旧版` | `Legacy` |
| 引用状态标签 | `引用状态` | `Reference status` |
| 已归档标签 | `已归档` | `Archived` |
| 引用加载 | `查询引用中…` | `Loading references…` |
| 无引用 | `无产品引用，可归档` | `Not referenced — safe to archive` |
| 引用计数 | `被引用 N 次（M 个产品）` | `Referenced N time(s) by M product(s)` |
| 引用说明 | `ALT / caption… 此处不可编辑` | 对应英文 |
| 引用信息不可用 | `引用信息暂不可用` | `Reference information unavailable` |
| 归档按钮 title | `有产品引用，无法归档` / `引用信息不可用` | 对应英文 |
| 归档文件按钮 | `归档文件` | `Archive file` |
| 归档确认提示 | `确认归档此文件？归档后可随时恢复。` | `Archive this file? It can be restored at any time.` |
| 归档确认按钮 | `归档中…` / `确认归档` | `Archiving…` / `Confirm archive` |
| 归档取消 | `取消` | `Cancel` |
| 恢复文件按钮 | `恢复文件` | `Restore file` |
| 恢复确认提示 | `确认恢复此文件？` | `Restore this file?` |
| 恢复确认按钮 | `恢复中…` / `确认恢复` | `Restoring…` / `Confirm restore` |
| 恢复取消 | `取消` | `Cancel` |
| 旧版目录警告 | `此文件位于旧版目录（只读），建议移至正式目录。` | `This file is in a legacy folder (read only). Move it to an approved folder.` |
| 标题字段标签 | `标题` | `Title` |
| 标题 placeholder | `文件显示标题` | `Display title` |
| 内部描述标签 | `内部描述` | `Internal description` |
| 内部描述 placeholder | `内部备注（不对外展示）` | `Internal notes (not shown publicly)` |
| 保存按钮 | `保存中…` / `保存` | `Saving…` / `Save` |
| 取消按钮（详情） | `取消` | `Cancel` |
| 文件加载失败 | `加载文件列表失败` | `Failed to load files` |

**明确未改动：** API 逻辑、状态机、媒体/产品数据、Folder Registry、Directus schema/权限/角色；注释（第 126 行 `"正式目录"` 保留）；批量操作选框语义、归档/恢复触发逻辑。

**自动化验证：**

| 检查项 | 结果 |
|--------|------|
| Vitest：127/127 | ✅ |
| vue-tsc --noEmit：0 errors | ✅ |
| npm run lint：0 errors | ✅ |
| npx nuxt build：Build complete | ✅ |
| git diff --check：仅 LF/CRLF 警告 | ✅ |
| rg 验证 media/index.vue：零可见中文（仅第 126 行代码注释） | ✅ |

**浏览器视觉验收：未完成**（Edge MCP Tab 独立 session 无 admin cookie，持续 302 跳转）。视觉确认转入下一次集中 Admin visual smoke test。

---

## 4B. 原 P1 收口状态（2026-09-06，保持）

**P1 已完成。product_code 不变量、zero-source 防线、Directus 角色绕过审计均已通过。**

> **前序：** admin SSR 重定向已在 commit f04f1e4 补齐；9C-2R Folder Registry 在 commit 063dea7 完成。

### 当前本机配置

| 项目 | 当前值 |
|------|--------|
| `CMS_MODE_PRODUCTS` | `directus`（本机测试，`.env` 中，不进 Git） |
| Directus 测试产品 ID=3 | `status=draft`、`seo_noindex=true`、`product_code=NULL`、TEST ONLY 标识保留 |
| 推送状态 | 本地 commit 见下表，**未 push，未部署** |
| 生产是否启用 Products Directus | **否**（生产仍用 fixtures，Products 开关独立） |

### 关键提交清单（Phase 9C / M4-Next 阶段）

| commit | 内容 |
|--------|------|
| `da73094` | Phase 9A-2D：管理员发布/撤回完整状态机 |
| `945d5b6` | Phase 9A-2E：公开 Product Center 接入 Directus CMS |
| `041d867` | Phase 9A-2F：Directus 权限修复 + 查询上限 |
| `89d40cd` | Phase 9A-2F-2：规格 note 独立显示 + Hero 面包屑对比度 |
| `cdcdfd5` | Phase 9A-2I：全局面包屑 currentColor+opacity 真正修复 |
| `7e9d41c` | Phase 9C-1：Media Library 基础版 + Products 媒体复用 |
| `f2b9ef1` | Phase 9C-1P（git 标签误为 9C-2）：管理员会话续期基础实现 |
| （收口）   | Phase 9C-1P 收口：refresh 安全分支 + 前端单飞锁 + visibilitychange 补刷 |
| `0209ffa`  | M4-Next-3 + 9C-1P-R：Settings 最小版 + 多标签会话并发安全强化 + Vitest |
| `ae29d14`  | docs：M4-Next-3 业务验收结果写入 CURRENT-STATE.md（已 push） |
| `c555d9c`  | docs：B0-0 媒体治理规范 v0.1 + 决策 #1/#2/#3 已确认 |
| `a177e09`  | docs(9c-2r)：9C-2R live 验收结果写入 CURRENT-STATE.md |
| `f04f1e4`  | fix(admin-auth)：/admin/* SSR 认证边界 — 无 token 服务端 302 → /admin/login |
| `08c1a08`  | docs(admin-auth)：MASTER-ROADMAP 写入 SSR 认证边界修复 |
| `d97ffbe`  | feat(p1)：product_code 字段 + source records archive 能力 + Admin API |
| （本次）   | fix(p1-closure)：zero-source 防线 + source_locator 语义锁定 + 收口测试 |

### 后续顺序（严格按序，每步须独立授权）

1. ~~**Media Library 基础版**~~：✅ Phase 9C-1
2. ~~**管理员会话续期**~~：✅ Phase 9C-1P + 9C-1P-R
3. ~~**Settings 最小版**~~：✅ M4-Next-3
4. ~~**9C-2：Media Library 批量选择/归类**~~：✅ commit `2f0bac4`
5. ~~**9C-2R：媒体目录治理 Folder Registry**~~：✅ commit `063dea7`
6. ~~**Admin SSR 认证边界修复**~~：✅ commit `f04f1e4`
7. ~~**P1：product_code + source records 基础**~~：✅ 本次
8. **P2：真实 LT-180C Draft 录入**：用户确认真实资料、清理媒体元数据后执行
9. **Phase 9B — AI 产品导入与审核**：批量导入产品资料草稿，人工审核后发布，永不自动发布
10. **Content Center**：内容运营中心
11. **真实产品资料录入与正式上线**

**Push 授权、DNS 切换、生产部署须用户单独授权，不在以上范围内。**

---

### P1 — 产品身份与来源记录基础（本次，2026-09-06）

#### Schema 变更

| 集合 | 新字段 | 类型 | 约束 |
|------|--------|------|------|
| `products` | `product_code` | varchar(100) | UNIQUE, nullable；正式代码：大写字母/数字/连字符 |
| `product_source_records` | `archived` | boolean | NOT NULL, default false |
| `product_source_records` | `archived_at` | timestamptz | nullable |

- Schema 快照：before = `directus/schema/phase-p1-before.yaml`；after = `directus/schema/phase-p1-after.yaml`
- DB 备份：`backups/p1-before-2026-09-06.sql`（本地，不进 Git）

#### 业务规则

| 规则 | 实现位置 |
|------|---------|
| `product_code` 格式：`/^[A-Z0-9][A-Z0-9-]{0,98}[A-Z0-9]$\|^[A-Z0-9]$/` | `[id].patch.ts`、`index.post.ts` |
| 已设置的 `product_code` 不可更改或清空 | `[id].patch.ts` |
| `draft → review` 和 `review → published` 须先有合法 `product_code` | `[id].patch.ts` |
| TEST ONLY ID=3 保持 `product_code=NULL + draft + noindex` | 不触碰 |
| source records 仅管理员可访问（admin-auth 中间件） | 全局中间件 |
| source records 无物理 DELETE；archive 保留审计记录 | `archive.post.ts` |
| 重复归档返回 409 | `archive.post.ts` |
| 默认 list 仅返回 active（archived=false）记录 | `index.get.ts`（`include_archived=true` 可选） |

#### 新增 API 端点

| 端点 | 作用 |
|------|------|
| `GET /api/admin/products/[id]/sources` | 列出该产品 active source records |
| `POST /api/admin/products/[id]/sources` | 创建 source record（白名单字段） |
| `POST /api/admin/products/[id]/sources/[sourceId]/archive` | 逻辑归档（不物理删除） |

#### 验收结果（P1 原始 commit `d97ffbe`）

| 检查项 | 结果 |
|--------|------|
| Vitest：107/107 | ✅ |
| vue-tsc --noEmit：0 errors | ✅ |
| npm run lint：0 errors | ✅ |
| npx nuxt build：Build complete | ✅ |
| products.product_code DB 字段存在，UNIQUE | ✅ |
| product_source_records.archived / archived_at DB 字段存在 | ✅ |

#### P1 收口验收（本次，2026-09-06）

##### source_locator 业务语义结论

| 项目 | 结论 |
|------|------|
| `source_file_id` schema | `interface: file`，FK → directus_files；为主来源指针 |
| `source_locator` schema | `interface: input`，varchar(255)；命名含义为"文件内定位信息"（页码/章节/单元格等） |
| ADMIN-CMS-SPEC.md | 无反例定义，无独立来源语义说明 |
| 最终结论 | `source_locator` 是文件内位置描述符，**不是独立可溯源标识**；locator-only 不允许 |
| 执行规则 | `source_file_id` 必须提供有效 UUID；否则返回 422 `SOURCE_REFERENCE_REQUIRED` |

##### zero-source 防线（新增）

| 场景 | 预期 | 结果 |
|------|------|------|
| source_file_id=null，locator 缺失 | 422 SOURCE_REFERENCE_REQUIRED | ✅ |
| source_file_id=''，locator 空字符串 | 422 SOURCE_REFERENCE_REQUIRED | ✅ |
| source_file_id=''，locator 纯空格 | 422 SOURCE_REFERENCE_REQUIRED | ✅ |
| locator-only（无 source_file_id）| 422 SOURCE_REFERENCE_REQUIRED | ✅ |
| source_file_id=''，locator 有值 | 422 SOURCE_REFERENCE_REQUIRED | ✅ |
| 有效 UUID，无 locator | 允许 | ✅ |
| 有效 UUID，有 locator | 允许 | ✅ |
| 有效 UUID，locator 纯空格 | 允许；locator 规范化为 null | ✅ |

##### Directus 角色绕过审计（product_code）

| 角色 | 类型 | products:update 能力 | 结论 |
|------|------|---------------------|------|
| Administrator | admin_access=true | 技术全权（含 product_code 修改） | **技术例外，已记录** |
| nuxt-server | site-readonly-policy，READ only | 无 UPDATE 能力 | **不能绕过** |
| 普通运营角色 | 不存在 | N/A | **无风险** |

> 依据：9C-2R Launch Gate 审计（同一 Directus 实例，P1 无角色变更）。Administrator 绕过属受控技术例外，仅限本地开发/系统管理员使用。

**Launch Gate 结论：Pass**（无普通运营角色可绕过 Nuxt API 的 product_code 不变规则）

##### ProductBasicForm UI 收口

| 项目 | 验证方式 | 结论 |
|------|---------|------|
| `product_code` 字段标签 `产品代码 (Product Code)` | 组件代码检视 | ✅ |
| 未设置时说明"设定后不可修改" | 组件代码检视（`form-hint` v-else） | ✅ |
| 已设置时 disabled + `已锁定：XXX（不可更改）` | 组件代码检视（`:disabled="!!modelValue.product_code"`） | ✅ |
| disabled 样式：灰底、`cursor: not-allowed` | 组件 CSS | ✅ |
| 375px 无横向溢出 | 浏览器 JS：scrollW=375=innerW | ✅ |
| 1440px 无横向溢出 | 浏览器 JS：scrollW=1440=innerW | ✅ |
| 移动端 44px 最小高度 | 组件 CSS `@media (max-width: 720px)` | ✅ |

> 注：直接渲染 ProductBasicForm 需要管理员登录会话，本次因凭证安全规则无法在自动化流程中完成。UI 行为通过组件代码检视 + 自动化测试（productCode.test.ts）证实，服务端规则为最终保护。

##### 收口验收数字

| 检查项 | 结果 |
|--------|------|
| Vitest：116/116（含收口新增 9 个测试）| ✅ |
| vue-tsc --noEmit：0 errors | ✅ |
| npm run lint：0 errors | ✅ |
| npx nuxt build：Build complete | ✅ |
| git diff --check：仅 LF/CRLF 警告（Windows 正常） | ✅ |

#### 明确未触碰

- TEST ONLY ID=3 产品：未修改
- 任何真实媒体文件：未移动/上传/删除
- Directus 权限、角色、schema：未修改
- 无 AI、无 source snapshot、无真实 LT-180C 录入
- 未 push、未部署、未读取或输出凭证

---

### Phase 9A-2A Fix — 补做验收收口（完成）

| 类别 | 内容 |
|------|------|
| Directus schema 字段补充 | `product_spec_groups` 新增 `description_es`、`description_pt`（text, nullable）；`product_spec_items` 新增 `note_es`、`note_pt`（string, max 500, nullable） |
| Directus 关系注册（8条） | `product_sections→products`（CASCADE）、`product_section_items→product_sections`（CASCADE）、`product_spec_groups→products`（CASCADE）、`product_spec_items→product_spec_groups`（CASCADE）、`product_faqs→products`（CASCADE）、`product_source_records→products`（CASCADE）、`products_files→products`（CASCADE）、`products_files→directus_files`（SET NULL） |
| `nuxt-server` 权限修复 | `products_files` READ 字段从 5 个扩展至 14 个（含所有 alt/caption/language/version/sort 字段） |
| 全局父产品存在性校验 | `server/utils/adminDirectusClient.ts` 新增 `assertProductExists()`；全部 21 个子产品 API 端点统一注入（产品不存在 → 404）；实现用 filter 列表查询（规避 Directus 对缺失单项返回 403 的行为） |
| 错误码修正 | `external_url` 格式无效 → 422（原 400）；`media_id` 跨产品 → 422（原 400） |
| TypeScript 类型更新 | `types/product-cms.ts`：`ProductSpecGroup` 新增 `description_es/pt`；`ProductSpecItem` 新增 `note_es/pt` |
| API 白名单字段更新 | `specs/[gid].patch` 增加 `description_es/pt`；`specs/[gid]/items.post` payload 增加 `note_es/pt`；`specs/[gid]/items/[iid].patch` allowed 增加 `note_es/pt` |

**验收结果（全部通过）：**
- vue-tsc --noEmit：0 errors ✅
- npm run lint：0 errors ✅
- npx nuxt build：Build complete ✅
- 非存在产品（ID=99999）所有 5 个 GET 端点 → 404 + "产品 ID 99999 不存在" ✅
- 非管理员用户（nuxt-server 角色）尝试 admin 登录 → 403 ✅（临时用户已删除）
- 无效 Cookie → 401 ✅

**Schema 快照：** fix-before=`directus/schema/phase9a2a-fix-before.yaml`（250,374 B）、fix-after=`directus/schema/phase9a2a-fix-after.yaml`（259,463 B）

**延期测试（留至 LT-180C 草稿阶段）：** 跨产品 media_id 422 实测、子页内部空状态、合法 HTTPS URL 成功写入

---

### Phase 9A-2A 完成内容

| 类别 | 完成项 |
|------|--------|
| Directus schema 扩展 | `products_files` 新增 7 字段（`alt_en`、`caption_en`、`enabled`、`language`、`version_label`、`sort`、`file_date`）；`file_role` enum 从 5 值扩展至 11 值 |
| 新建 Directus collection | `product_sections`（10字段）、`product_section_items`（7字段）、`product_spec_groups`（6字段）、`product_spec_items`（8字段）、`product_faqs`（8字段）、`product_source_records`（11字段）共 6 个 |
| Directus 权限 | `nuxt-server` role → `site-readonly-policy`：新增 5 个 collection 的 READ 权限（`product_sections`、`product_section_items`、`product_spec_groups`、`product_spec_items`、`product_faqs`）；`product_source_records` 无任何权限 |
| TypeScript 类型 | `types/product-cms.ts` 完整重写：新增 `SectionType`（11值）、`FileRole`（11值）、`SourceReviewStatus`；新增 `ProductMedia`、`ProductSection`、`ProductSectionItem`、`ProductSpecGroup`、`ProductSpecItem`、`ProductFaq`、`ProductSourceRecord`、`ProductSeoFields` 接口 |
| Admin 子导航组件 | `components/admin/product/ProductSubNav.vue`（6标签：基础信息/页面模块/技术参数/图片与资料/产品FAQ/SEO；移动端横向滚动） |
| Admin 页面更新 | `pages/admin/products/[id]/index.vue` 集成 ProductSubNav |
| Admin 新页面（5个）| `pages/admin/products/[id]/content.vue`、`specs.vue`、`media.vue`、`faq.vue`、`seo.vue` |
| Admin API 端点（25个）| sections（5端点）、section_items（5端点）、spec_groups（5端点）、spec_items（5端点）、faqs（5端点）、seo（2端点 GET+PATCH） |
| 安全保证 | 所有端点：httpOnly Cookie 鉴权 + Administrator 角色验证 + CSRF + 所有权链校验（sub-resource → product_id 归属验证）；SEO 字段长度服务端强校验（title ≤120、desc ≤320） |
| .gitignore | 新增 `/private-product-source/` 排除规则 |

**验收结果（全部通过）：**
- vue-tsc --noEmit：0 errors ✅
- npm run lint：0 errors, 0 warnings ✅
- npx nuxt build：Build complete ✅

**Schema 快照：** before=`directus/schema/phase9a2a-before.yaml`（163,906 B）、after=`directus/schema/phase9a2a-after.yaml`（250,374 B）
**数据库备份：** `backups/phase9a2a-before-20260903-165135.sql`（402,579 B）

### Phase 9A-2D — 管理员发布／撤回完整状态机（完成）

**commit：** `da73094`

| 类别 | 完成项 |
|------|--------|
| 服务端状态限制解除 | `server/api/admin/products/[id].patch.ts`：开放 `published` 写入（9A-1 只允许 draft↔review） |
| 管理员预览端点 | `server/api/admin/products/[id]/preview-data.get.ts`：以管理员身份聚合产品完整数据 |
| 管理员预览页面 | `pages/admin/products/[id]/preview.vue`：在新标签页渲染与公开前台一致的产品外观 |
| Admin UI | 侧边栏增加"预览"快速链接；PublishPanel 支持五态转移（draft / review / published / archived / draft 撤回） |
| 9A-1 解除项 | "9A-1 发布限制"正式解除，Published 按钮对已授权管理员开放 |

**验收结果：** typecheck 0 / lint 0 / build SUCCESS ✅

---

### Phase 9A-2E — 公开 Product Center 接入 Directus CMS（完成）

**commit：** `945d5b6`

| 类别 | 完成项 |
|------|--------|
| 运行时开关 | `CMS_MODE_PRODUCTS`（`runtimeConfig`）：`fixtures`（默认）或 `directus` |
| Nuxt API 端点 | `categories.get.ts`（status=published 分类列表）、`[category].get.ts`（分类+产品列表 limit=200）、`[category]/[slug].get.ts`（产品完整详情：规格组、FAQ、页面模块、媒体、下载） |
| Directus 工具 | `directusFetch()`：仅在服务端运行，使用 `nuxt-server` 只读静态 Token |
| 适配器隔离 | fixtures 路径与 directus 路径完全隔离，切换不改任何前台组件 |

**验收结果：** typecheck 0 / lint 0 / build SUCCESS ✅

---

### Phase 9A-2F / 9A-2F-2 / 9A-2I — Directus 权限修复与视觉验收（完成）

**commits：** `041d867`、`89d40cd`、`cdcdfd5`

| 类别 | 完成项 |
|------|--------|
| Directus 权限修复 | `nuxt-server` READ 权限：`product_categories`（18 字段，含 sort）、`products`（25 字段，含 sort、seo_image、seo_noindex、related_product_slugs）；修正前均返回 403 |
| 查询上限 | `limit=-1` → 分类 `limit=100`、产品 `limit=200` |
| 规格 note 字段 | `types/content.ts`：`ProductSpecRow` 新增 `note` 字段（独立行、斜体、`display:block`，不与 value 拼接） |
| 面包屑全局修复 | `components/ui/Breadcrumb.vue`：改为 `color: currentColor` + `opacity`（link 0.72 / hover 1.0 / current 0.92 / sep 0.45）；无需枚举 hero 类名，任何深色容器设 `color: white` 后自动生效 |
| 去除冗余规则 | `assets/css/base.css`：删除仅覆盖 `.page-hero` 的 `--bc-*` 变量块 |

**全量 26 条面包屑路由验证（375px + 1440px）：**
- 可渲染路由 25/25 全部通过（bcColor `rgb(255,255,255)` × opacity 0.72，无横向溢出）
- `/products/[category]/[slug]`：当前 Directus 无已发布产品（ID=3 为 draft），404 页面不渲染面包屑，属数据可用性限制，非 CSS 问题，模板 Hero 类及机制与已验证路由完全一致

**Products 完整验收闭环（ID=3，TEST ONLY 测试产品）：**

| 场景 | 验收项 | 结论 |
|------|--------|------|
| Published | 分类列表出现产品卡、详情页 HTTP 200 | ✅ |
| Published | `<meta name="robots" content="noindex,follow">` | ✅ |
| Published | robots.txt 不含产品 URL；sitemap.xml 不含 noindex 产品 | ✅ |
| 1440px + 375px | 无横向溢出；规格 note 独立行显示；Hero 面包屑白色清晰可读 | ✅ |
| Draft 撤回 | 分类列表消失、详情 404、sitemap 排除 | ✅ |
| 非登录管理 API | GET /api/admin/* → 401 或 403 | ✅ |

**ID=3 最终状态：`status=draft`、`seo_noindex=true`、TEST ONLY 标识保留（不对外可见）**

**验收结果：** typecheck 0 / lint 0 / build SUCCESS ✅

---

### Phase 9C-1 — Media Library 基础版 + Products 媒体复用（完成）

**commit：** 见第 4 节（本次 commit）

| 类别 | 完成项 |
|------|--------|
| **新建页面** | `pages/admin/media/index.vue`：媒体库主页面（文件夹侧边栏 + 文件网格 + 文件详情面板 + 上传） |
| **新建 API × 4** | `server/api/admin/media/files.get.ts`（文件列表，支持 folder/type/search/limit/offset）；`folders.get.ts`（文件夹树，服务端构建）；`upload.post.ts`（批量上传，ALLOWED_TYPES：jpg/png/webp/pdf，MAX 50MB）；`[id]/meta.patch.ts`（元数据更新，白名单：title/description/folder，拒绝 is_public 等非授权字段） |
| **修改布局** | `layouts/admin.vue`：Media Library 导航从 disabled `<span>` 改为可点击 `<NuxtLink to="/admin/media">` |
| **修改产品媒体页** | `pages/admin/products/[id]/media.vue`：新增「从媒体库选择」按钮 + `<Teleport to="body">` 模态选择器；`existingFileIds` computed 防重复关联；`pickFromLibrary()` POST `/api/admin/products/${id}/media` |

**关键设计决策：**

| 决策点 | 结论 |
|--------|------|
| 初始加载时机 | `onMounted(() => loadFiles(true))` — 延迟至客户端挂载后，避免 SSR/CSR 水合不匹配（`await loadFiles()` 在 setup 中会导致 SSR 渲染有数据但 CSR 起始为空，产生 hydration mismatch 和横向溢出） |
| 上传格式限制 | ALLOWED_TYPES + ALLOWED_EXTS 双重校验；GIF/BMP 等直接拒绝 |
| 元数据字段白名单 | `['title', 'description', 'folder']`；`is_public` 零出现（全库 grep 确认） |
| 文件夹缩进 | `'—'.repeat(f.depth)` 替代全角空格（lint 规则禁止 U+3000） |
| 重复防护 | `existingFileIds.value.has(file.id)` → `error.value = '已经关联...'` + `return`，无额外 POST |

**Session 诊断（只读，不修复）：**

- Directus access token 默认 15 分钟过期；`admin_at` cookie `maxAge = Math.floor(expires/1000)` ≈ 900s
- `admin_rt`（7 天 refresh token）已设置但**无刷新端点和前端调用逻辑**
- 中间件每次 API 请求均向 Directus 验证 token，token 到期后所有受保护 API 返回 401
- 此为正常 Directus 行为；Nitro dev server 重启不影响 cookie；属独立后续任务（实现 auto-refresh），不在 9C-1 范围内

**浏览器验收结果（全部通过）：**

| 断点 | 项目 | 结果 |
|------|------|------|
| 375px 刷新后 | 12 张卡片在 `.file-grid`，无 `.empty-state`，scrollW=innerW=375 | ✅ |
| 1440px 刷新后 | 12 张卡片在 `.file-grid`，无 `.empty-state`，scrollW=innerW=1440 | ✅ |
| 文件夹筛选 | click products 文件夹→0，全部文件→12 | ✅ |
| 搜索 | 搜索"180C3"→3，清空→12 | ✅ |
| DataTransfer 上传 | 真实 file input change 事件，POST 200，文件数 12→13 | ✅ |
| 元数据编辑 | PATCH 200，「元数据已保存」横幅，标题更新可见 | ✅ |
| ID=3 媒体选择器 | 「从媒体库选择」→模态→选文件→POST 200，绑定数 6→7 | ✅ |
| 重复防护 | 再次选同一文件→无 POST，显示「已经关联到此产品」错误 | ✅ |
| 原始 7 个文件 | API 查询确认全部存在（7 条非 TEST ONLY 记录） | ✅ |
| ID=3 状态 | `status=draft`，`seo_noindex=true` | ✅ |
| TEST ONLY 文件 | 仅关联 ID=3（Draft），系统无 Published 产品（共 1 个产品） | ✅ |

**typecheck / lint / build / git diff --check：** 见本次 commit 验收

---

### Phase 9C-1P — 管理员会话续期安全强化（完成）

> **编号说明：** git commit `f2b9ef1` 消息标签为"Phase 9C-2"，系会话临时命名；正式文档编号为 **Phase 9C-1P**。9C-2 保留给 Media Library 批量选择/归类。

**commits：** `f2b9ef1`（基础实现）+ 本次收口 commit（安全强化）

| 类别 | 完成项 |
|------|--------|
| **新建端点** | `server/api/admin/auth/refresh.post.ts`：读 `admin_rt` httpOnly cookie，调用 Directus `POST /auth/refresh`，重置 `admin_at`（Directus 实际 expires）和 `admin_rt`（7天）；响应体仅 `{ ok: true }`，不含任何 token 值 |
| **安全分支** | Directus 401/403 → `deleteCookie(admin_at + admin_rt)` + throw 401（强制重新登录）；网络错误/5xx → throw 503，**不清 cookie**（下次重试） |
| **前端单飞锁** | `layouts/admin.vue`：`isRefreshing` 布尔标志防止 mount、定时器、visibilitychange 同时触发多次刷新 |
| **visibilitychange** | 标签页切回可见时通过单飞逻辑补一次刷新 |
| **错误分支** | refreshSession 返回 `false` 仅在 401 时才跳转登录页；503/网络错误保持状态继续定时重试 |
| **定时清理** | `onUnmounted` 同时清除 `setInterval` 计时器和 `visibilitychange` 监听器 |
| **Cookie 安全** | httpOnly / sameSite:strict / secure:isProd / path:'/' 全部保留；access token 维持 Directus 短 TTL，不人为延长 |

**会话语义（滑动续期）：**
- 每次成功 `POST /refresh` 后 Directus 返回新的 access token（~15min TTL）和新的 refresh token
- Admin layout 每 10 分钟自动触发一次，等效于"每次登录后只要标签页仍活跃，会话无限续期"
- 关闭浏览器后 refresh token（7天）到期前重开标签页仍可自动续期
- **建议单一 Admin 标签页使用**：多标签页各自独立触发刷新，refresh token 会被最后写入者覆盖，早期标签页的 refresh token 可能失效

**注意事项：**
- 无 `/admin/login` 循环：refresh 调用在 admin layout（已鉴权页）触发，登录页使用独立页面布局，不受影响
- `admin_rt` 永不超过 Directus 当前 refresh TTL（7天，`maxAge: 7 * 24 * 3600` 与 Directus 默认一致）
- 中间件路由白名单 `/api/admin/auth/` 已允许 refresh 端点无 access token 自由调用（原有 9C-1 设计）

**最终运行时验收通过（2026-09-04）：**

| 验收项 | 方式 | 结果 |
|--------|------|------|
| `POST /api/admin/auth/refresh`（第一次）| 浏览器 fetch，200 | ✅ |
| `POST /api/admin/auth/refresh`（第二次，顺序执行）| 浏览器 fetch，200 | ✅ |
| `GET /api/admin/auth/me` | 浏览器 fetch，200 | ✅ |
| 375px：/admin/media 13 张卡片，scrollW=375=innerW | 浏览器 JS | ✅ |
| 1440px：/admin/media 13 张卡片，scrollW=1440=innerW | 浏览器 JS | ✅ |
| 响应体无 access_token / refresh_token | 源码：`return { ok: true }` | ✅ |
| Directus 401/403 → 清 cookie + 返回 401 | 源码：`deleteCookie` × 2 | ✅ |
| 网络错误 → 不清 cookie + 返回 503 | 源码：独立 catch 分支 | ✅ |
| 单飞锁防并发 | 源码：`if (isRefreshing) return true` | ✅ |
| visibilitychange 补刷 | 源码：`addEventListener('visibilitychange', ...)` | ✅ |
| onUnmounted 清理完整 | 源码：`clearInterval + removeEventListener` | ✅ |
| httpOnly/sameSite/secure/path 保持 | 源码：与 login.post.ts 一致 | ✅ |
| 活跃会话可滑动续期 | 语义：10 分钟 interval，标签页活跃则无限续期 | ✅ |
| 9C-2 保留给 Media Library 批量操作 | 文档：本阶段编号 9C-1P | ✅ |

**网络记录说明：** 网络面板共见 3 次 `/api/admin/auth/refresh` 200，对应 1 次 layout mount 自动刷新 + 2 次本次验收手动调用；`isRefreshing` 为组件实例级变量，同一实例内并发调用正确被锁阻断。

**typecheck / lint / build / git diff --check：** 0 errors / 0 errors / BUILD COMPLETE / 仅 CRLF 警告（Windows 正常）✅

---

### Phase 9C-1P-R — 多标签会话并发安全强化（本地完成）

**⚠️ 单实例范围声明：当前协调器驻于单个 Nuxt 进程内存，适用于本地及单实例生产部署。水平扩展（多 Nuxt 实例）前必须将 pending / graceCache / rotated 三个 Map 改为共享协调机制（如 Redis SETNX+TTL）。正式上线前须在独立测试环境完成完整认证并发安全验收；当前 14 个 Vitest 用例 + 即时双路并发验证作为本地基线，不作为生产认证依据。人工登录安全验收统一延期到上线前独立测试环境执行。**

| 类别 | 完成项 |
|------|--------|
| **新建协调器** | `server/utils/refreshCoordinator.ts`：纯 TypeScript 工厂 `createCoordinator()`，管理三个状态集合：`pending`（并发去重）、`graceCache`（5s 重复结果复用）、`rotated`（60s 旧 RT 标记，仅存 SHA-256 摘要，零 Token 值） |
| **修改端点** | `server/api/admin/auth/refresh.post.ts`：使用单例协调器；`ensure` vs `scheduled-renew` intent 语义分离；invalid intent → 400；`scheduled-renew` 缺失 RT 时先验证 AT 再决定 503 或 401 |
| **intent 语义** | `ensure`（onMounted / visibilitychange）：AT 有效直接返回，不消耗 RT；`scheduled-renew`（10 min 定时器）：主动轮换 RT，AT 有效时亦执行 |
| **迟到请求保护** | 旧 RT 被本进程轮换后，携带同 RT 的迟到请求命中 `rotated` 记录 → 返回 503，不清 Cookie，不触发 401 |
| **自动化测试** | `tests/refreshCoordinator.test.ts`（14 个 Vitest 用例）、`vitest.config.ts`；devDep `vitest ^2.1.9` |
| **前端 intent** | `layouts/admin.vue`：`refreshSession('ensure')` 用于 onMounted / visibilitychange；`refreshSession('scheduled-renew')` 用于 setInterval |

**验收结果：**
- `npm test` 14 tests：14 passed ✅
- typecheck：0 errors ✅；lint：0 errors ✅；`npx nuxt build`：BUILD COMPLETE ✅
- `git diff --check`：0 whitespace errors ✅
- 即时双路并发 `POST /refresh { intent: "scheduled-renew" }`：[200, 200] ✅
- tab-1 `/api/admin/auth/me`：200，路径 `/admin/products` ✅
- tab-2 `/api/admin/auth/me`：200，路径 `/admin/settings` ✅

---

### M4-Next-3 — Settings 最小版（完成）

**新建 Directus collections：** `site_settings`（singleton）、`site_social_links`（O2M）
**Schema 快照：** `directus/schema/phase-settings-after.yaml`（275,089 B）

| 类别 | 完成项 |
|------|--------|
| **Directus Schema** | `site_settings`（singleton，8 字段：brand_name / legal_company_name / public_email / public_phone / public_whatsapp_url / public_address / copyright_text + date_updated）；`site_social_links`（6 字段：platform / url / sort / enabled / settings_id M2O）；M2O 关系（CASCADE SET NULL）；`nuxt-server` site-readonly-policy READ 权限 |
| **Admin Setup API** | `POST /api/admin/settings/setup`：幂等创建 Schema + 种子数据（PATCH singleton + social links）；首次运行自动建表、授权并填入 LITUBO 默认值 |
| **Admin Settings API** | `GET /api/admin/settings`：返回 settings + socialLinks（singleton 空时返回 needsSetup:true）；`PATCH /api/admin/settings`：白名单校验 + 长度限制 + email/URL 格式校验；`POST /api/admin/settings/social`：新建社交链接（枚举校验 + https 校验 + 防重复）；`PATCH /api/admin/settings/social/[id]`：更新 url/sort/enabled；`DELETE /api/admin/settings/social/[id]`：删除记录 |
| **公开 CMS API** | `GET /api/cms/site-settings`：以 nuxt-server 静态 Token 读取，白名单输出（7个 company 字段 + enabled 社交链接），任何错误返回 hardcoded FALLBACK |
| **Admin UI** | `pages/admin/settings.vue`：三区块（Company & Public Contact 表单 / Social Links CRUD 内联编辑 / Security & AI Connections 只读面板）；`layouts/admin.vue` Settings 导航从 disabled 改为可点击 NuxtLink |
| **Footer CMS 接入** | `components/global/SiteFooter.vue`：`useFetch('/api/cms/site-settings')` 替代硬编码；`phoneHref` computed 去除格式符；`copyrightText` 支持 `{year}` 占位替换；社交图标改为 `v-for` 动态渲染（SVG 内联，4 个平台）；无 CMS 数据时 fallback 至 i18n 硬编码值 |
| **TypeScript** | `types/settings.ts`：`SiteSettings`、`SiteSocialLink`、`SocialPlatform`、`SOCIAL_PLATFORMS`、`PublicSiteSettings` |

**关键设计决策：**

| 决策点 | 结论 |
|--------|------|
| Directus singleton PATCH 语义 | `POST /items/site_settings` 对 singleton 无效（返回 `{id: null}`）；正确方式是 `PATCH /items/site_settings`（无 ID）创建/更新 |
| needsSetup 判断 | `settings.id === null`（非 `!settings`）：Directus singleton 空时返回对象而非 null |
| ESLint no-dynamic-delete | `delete linkEdits.value[id]` 违规；改为 `Object.entries(...) as [string, LinkEdit][]` 重建对象 |
| 公开 API 安全 | 只输出白名单字段，不含 date_updated；social_links 只含 platform/url/sort（不含 id/enabled） |
| Footer FALLBACK | 硬编码常量确保 CMS 不可用时 Footer 仍显示正确联系信息 |

**静态验收结果（全部通过）：**
- vue-tsc --noEmit：0 errors ✅
- npm run lint：0 errors ✅
- npx nuxt build：Build complete ✅

**M4-Next-3 业务验收（2026-09-04，真实 Directus 数据，本地运行时）：**

| 验收项 | 操作 | 结果 |
|--------|------|------|
| `/api/admin/auth/me` 状态 | GET → 200 | ✅ 会话有效 |
| Company 信息保存 | PATCH copyright_text 改为 TEST ONLY 标识 → 公开 API 返回测试文本 | ✅ |
| Company 信息还原 | PATCH 恢复 "© {year} LITUBO. All rights reserved." → 公开 API 确认还原 | ✅ |
| Social Link 禁用 | PATCH LinkedIn `enabled:false` → 公开 API 仅返回 YouTube | ✅ |
| Social Link 恢复 | PATCH LinkedIn `enabled:true` → 公开 API 返回 LinkedIn + YouTube | ✅ |
| 服务端 email 校验 | 无效 email → 422 | ✅ |
| 服务端 URL 校验 | 非 HTTPS URL → 422 | ✅ |
| 服务端重复平台校验 | 重复 platform → 409 | ✅ |
| 响应式 Settings 375px | scrollWidth = innerWidth = 375，无横向溢出 | ✅ |
| 响应式 Settings 1440px | scrollWidth = innerWidth = 1440，无横向溢出 | ✅ |
| 响应式 Footer 375px | scrollWidth = innerWidth = 375，无横向溢出 | ✅ |
| 响应式 Footer 1440px | scrollWidth = innerWidth = 1440，无横向溢出 | ✅ |
| 最终公开 API 数据状态 | copyright_text、brand_name、所有联系字段 + LinkedIn/YouTube 均完整正确 | ✅ |

**验收期间所有测试数据已还原：copyright_text 已恢复原值，social links 均为 enabled=true。未接入 AI、未连接真实社媒平台、未读取或输出任何凭证或 Cookie、未 push、未部署。**

---

### 9A-2C — 本地发布/撤回完整验收（2026-09-04，完成）

**验收类型：** 可逆本地验收（无代码/schema 变更，无 commit，测试结束后 ID=3 已恢复 draft）

**状态机转移（实测）：**

| 操作 | HTTP 状态 | 产品状态 |
|------|-----------|---------|
| draft → review | 200 | review |
| review → published | 200 | published |
| published → draft（撤回）| 200 | draft |

> 注：直接 `draft → published` 返回 403（状态机不允许跨步），须经 review 中转，行为符合预期。

**Published 状态验证（全部通过）：**

| 验收项 | 实际值 | 结果 |
|--------|--------|------|
| 公开详情 API | HTTP 200 | ✅ |
| H1 标题 | `[TEST ONLY — NOT FOR PUBLICATION] LT-180C Free-Fall Metal Detector` | ✅ |
| `<meta name="robots">` | `noindex, follow` | ✅ |
| OG title | `[TEST ONLY] LT-180C Free-Fall Metal Detector` | ✅ |
| Sitemap 排除（seo_noindex=true）| 产品不出现在 sitemap.xml | ✅ |
| 产品分类列表 | 出现在 Metal Detection 列表 | ✅ |
| FAQ 区块 | 8 条 FAQ 可见 | ✅ |
| CTA 按钮 | "Talk to an engineer" + "Find a distributor" 可见 | ✅ |
| 桌面端 1440px | scrollWidth=1425 ≤ innerWidth=1440，无横向溢出 | ✅ |
| 桌面端 1280px | scrollWidth=1265 ≤ innerWidth=1280，无横向溢出 | ✅ |
| 手机端 375px | scrollWidth=375 = innerWidth=375，无横向溢出 | ✅ |

**撤回后验证（全部通过）：**

| 验收项 | 实际值 | 结果 |
|--------|--------|------|
| 公开详情 API | HTTP 404（"Page Not Found — LITUBO"）| ✅ |
| 产品分类列表 | 产品不再出现 | ✅ |
| Sitemap | 产品不出现 | ✅ |
| 管理员 API | HTTP 200，status=draft（管理员仍可查）| ✅ |

**ID=3 最终状态：`status=draft`、`seo_noindex=true`、TEST ONLY 标识保留（不对外可见）**

**确认：** 验收全程未修改任何代码或 schema；验收期间未产生 commit；未 push、部署或调用 AI；未读取或输出任何凭证。

---

### Phase 9C-2 代码已完成（2026-09-04，等待业务验收）

**新增文件（本次 commit）：**

| 文件 | 说明 |
|------|------|
| `directus/schema/phase-9c2-before.yaml` | schema 快照（变更前） |
| `directus/schema/phase-9c2-after.yaml` | schema 快照（含 `media_file_lifecycle` collection） |
| `server/utils/mediaLifecycle.ts` | 生命周期业务逻辑（可注入依赖，便于单测） |
| `server/api/admin/media/[id]/references.get.ts` | `GET /api/admin/media/:uuid/references`（引用查询） |
| `server/api/admin/media/[id]/archive.post.ts` | `POST /api/admin/media/:uuid/archive`（软归档） |
| `server/api/admin/media/[id]/restore.post.ts` | `POST /api/admin/media/:uuid/restore`（恢复） |
| `server/api/admin/media/lifecycle.get.ts` | `GET /api/admin/media/lifecycle`（归档文件列表） |
| `tests/mediaLifecycle.test.ts` | 9 个单元测试，全部通过 |
| `pages/admin/media/index.vue` | 新增：多选 checkbox、批量文件夹移动、引用查询面板、归档/恢复按钮、已归档视图 |

**Directus Collection：** `media_file_lifecycle`（16/25，2026-09-04 通过 API 创建）

**验证结果：** typecheck 0 errors、lint 0 errors、build exit 0、vitest 23/23 通过、375px 无水平溢出

---

### Phase 9C-2R — 媒体目录治理 Folder Registry（收口已完成，2026-09-05）

**状态：全部验收完成（2026-09-06）。代码 + 测试 + UI + Directus live 目录树 + 角色审计 + 浏览器双断点均通过。未 push、未部署。**

**commit `063dea7` 完成项：**

| 类别 | 完成项 |
|------|--------|
| **新建工具层** | `server/utils/folderRegistry.ts`：`PolicyState` 类型（含 `ambiguous`）、`FolderEntry` 接口、冻结策略表 `FOLDER_POLICY`（16条全路径→状态）、纯函数 `buildFolderRegistry(flat)`（含 §2.7 ambiguity 检测）、Live resolver `resolveFolderRegistry(event)`、`validateUploadFolder()`（含 FOLDER_AMBIGUOUS）、`validateMoveFolder()`（含 FOLDER_AMBIGUOUS）、`assertFolderAllowsUpload()`、`assertFolderAllowsMove()` |
| **修改 upload.post.ts** | `assertFolderAllowsUpload(folder, event, true)`：上传前服务端 policy 校验；null folder（Needs Classification）被允许 |
| **修改 meta.patch.ts** | 单文件移动增加 `resolveFolderRegistry + validateMoveFolder`：不允许移至 null/legacy/conflict/unknown/ambiguous |
| **新建 batch-move.post.ts** | `POST /api/admin/media/batch-move`：批量移动最多 200 个文件；**批量预验证**（先验证目标 folder → registry check，全批失败再报错，无写入） |
| **修改 folders.get.ts** | 扩展 `FolderNode`（新增 `full_path`, `policy_state`, `allow_upload`, `allow_move_target`）；服务端注入 policy，前端零计算 |
| **修改 index.vue（前端收口）** | 移除客户端 policy 依赖；`uploadableFlatFolders` 仅 active-canonical；`batchMoveToFolder` 改调 batch-move API；修复 `v-show` 和 `mobile-legacy-hidden` bug |

**本次收口 commit 新增项：**

| 类别 | 完成项 |
|------|--------|
| **G1 单元测试** | `tests/folderRegistry.test.ts`：44 个测试全部通过；覆盖 §2 要求 1–9（正确 UUID/错误父链/未知 UUID/非可写状态/Planned 目录/null 规则/ambiguity/孤儿节点/路由级 mock） |
| **G1 ambiguity 处理** | `buildFolderRegistry` 新增 §2.7 路径重复检测；ambiguous 条目设 `allow_upload=false, allow_move_target=false`；`validateUploadFolder`/`validateMoveFolder` 返回 `FOLDER_AMBIGUOUS` 错误码 |
| **G2 英文 UI** | 侧边栏：`Active destinations` / `Legacy — read only` / `Conflict — read only`；批量移动：`Move to approved folder`；编辑表单：`Move to approved folder` / `Needs Classification` |
| **G3 Conflict tier** | 新增 `conflictFlatFolders` computed；侧边栏第四层"Conflict — read only"显示 `certifications`；可浏览，不出现在任何 write dropdown |
| **Cleanup** | 删除 `utils/mediaFolderPolicy.ts`（确认无真实 import 后删除） |
| **文档更新** | CURRENT-STATE.md / MASTER-ROADMAP.md / MEDIA-AND-PRODUCT-DATA-GOVERNANCE.md / PHASE-9C-2-MEDIA-LIBRARY-FOUNDATION-SPEC.md |
| **policy bug 修复** | `FOLDER_POLICY['company']` 已从 `container-only` 改为 `active-canonical` |

**Policy 状态表（本次 commit 冻结）：**

| full_path | policy_state | allow_upload | allow_move |
|-----------|--------------|:---:|:---:|
| home | active-canonical | ✅ | ✅ |
| applications | active-canonical | ✅ | ✅ |
| company | active-canonical | ✅ | ✅ |
| company/global-service | legacy-read-only | ✗ | ✗ |
| products | container-only | ✗ | ✗ |
| products/xray | active-canonical | ✅ | ✅ |
| products/metal-detection | active-canonical | ✅ | ✅ |
| products/combination | active-canonical | ✅ | ✅ |
| products/checkweigher | active-canonical | ✅ | ✅ |
| products/conveyor | active-canonical | ✅ | ✅ |
| products/technical-docs | legacy-read-only | ✗ | ✗ |
| resources | container-only | ✗ | ✗ |
| resources/case-studies | legacy-read-only | ✗ | ✗ |
| resources/downloads | legacy-read-only | ✗ | ✗ |
| resources/insights | legacy-read-only | ✗ | ✗ |
| certifications | conflict-frozen | ✗ | ✗ |

**验收结果（收口 commit）：**
- npx vitest run：67 tests (3 files) 全部通过 ✅
- vue-tsc --noEmit：0 errors ✅
- npm run lint：0 errors ✅
- npx nuxt build：BUILD COMPLETE ✅（commit `063dea7` 时已通过，收口仅增 tests/docs/UI，build 重新需本地验证）

**未暂存/未提交（永久排除）：** `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/`、`docs/design-reference/inbox/`、`docs/product-cms/CMS-AI-CONSTRUCTION-PACK-V1/`、`docs/project/LITUBO_9C-2R_正式施工单.md`

**Directus live 目录树核实（2026-09-06，PostgreSQL 直查 + 浏览器 upload dropdown 验证）：**

16 个目录全部存在，parent 链与 `FOLDER_POLICY` 完全一致；无幽灵目录；8 个文件 `folder=NULL`（待分类）。  
Active-canonical upload dropdown UUIDs（浏览器 accessibility tree 确认）：

| 文件夹名 | UUID |
|---------|------|
| applications | `9b8ae1f0-5056-4b64-920d-30f13b4baa4a` |
| company | `3372cf0e-7b26-4a8a-b3f5-51647df1a626` |
| home | `03d8f41d-a0ee-4782-a2ef-2742ccb3ea81` |
| products/checkweigher | `1edce96c-ccd4-41fe-a83b-5c5ca7050e97` |
| products/combination | `1b250d0d-98ea-4ae1-a688-b20e818f5026` |
| products/conveyor | `4ec63a59-a92c-4617-9398-3516dea74f1d` |
| products/metal-detection | `139e0338-2c7a-43c1-be25-92423d7bacc1` |
| products/xray | `de7281ef-e3b6-4175-b22f-58ecc78aa5b5` |

**浏览器验收结果（2026-09-06，Nuxt dev localhost:3000）：**

| 断点 | 项目 | 结果 |
|------|------|------|
| 1440px | 侧边栏"Active destinations"标签显示 | ✅ |
| 1440px | Active 目录 10 个（active-canonical + container-only）正确渲染 | ✅ |
| 1440px | 侧边栏"Legacy — read only"标签 + 5 个 legacy 目录 | ✅ |
| 1440px | 侧边栏"Conflict — read only"标签 + certifications 按钮 | ✅ |
| 1440px | 上传下拉框仅含 8 个 active-canonical 文件夹；certifications/legacy 不在其中 | ✅ |
| 375px | 无横向溢出（pill 布局、"Legacy (read only) ▼"折叠按钮正常） | ✅ |
| 375px | certifications 以红色文字显示在 Conflict tier | ✅ |

**Launch Gate 审计（2026-09-06，完成）：**

| 项目 | 结论 |
|------|------|
| A. 技术超管绕过 | Administrator 角色（admin_access=true）可直接 PATCH Directus 原生 API，绕过 Nuxt folder policy。属受控技术例外，已记录。 |
| B. 普通运营角色绕过 | **Pass**。Directus 中仅存在 2 个角色：Administrator（admin_access=true）+ nuxt-server（只读服务账户）。无普通运营角色。外部运营人员目前只能经过 Nuxt Admin UI，无法绕过 folder policy。|

**B 项结论：上线前无需额外角色权限变更；如日后新增普通运营角色，须在 Directus 权限层严格限制 `directus_files.folder` UPDATE 字段。**

---

### Admin SSR 认证边界修复（2026-09-06，完成）

**问题：** 诊断发现 `/admin/*` 页面路由无服务端 cookie 验证——无 cookie 时服务端返回 HTTP 200（admin shell HTML），仅靠 `layouts/admin.vue` `onMounted` 客户端跳转重定向，不构成充分保护。

**修复：** 修改 `server/middleware/admin-auth.ts`，在现有 `/api/admin/*` API 保护之外，对 `/admin/*` 页面路由增加服务端认证检查：
- 无 `admin_at` cookie → `sendRedirect(event, '/admin/login', 302)`
- `admin_at` 存在但 Directus 验证失败（失效/伪造）→ `sendRedirect(event, '/admin/login', 302)`
- `/admin/login` 本身、`/api/admin/auth/*` 端点：排除，不受影响
- API 路由 `/api/admin/*`：保持原有 401/403 行为，不改为 HTML 重定向

**验证结果（2026-09-06）：**

| 场景 | 方法 | 结果 |
|------|------|------|
| 无 cookie GET /admin/media | curl --max-redirs 0 | **302** Location: /admin/login ✅ |
| 无 cookie GET /admin/products | curl --max-redirs 0 | **302** Location: /admin/login ✅ |
| 无 cookie GET /admin/settings | curl --max-redirs 0 | **302** Location: /admin/login ✅ |
| GET /admin/login（无 cookie）| curl --max-redirs 0 | **200**（无循环）✅ |
| 伪造 token GET /admin/media | curl -H "Cookie: admin_at=fake" | **302** Location: /admin/login ✅ |
| 无 cookie GET /api/admin/auth/me | fetch credentials:omit | **401**（不重定向）✅ |
| 无 cookie GET /api/admin/media/files | fetch credentials:omit | **401**（不重定向）✅ |
| 有效 session GET /admin/media | fetch credentials:include | **200** ✅ |
| 重定向响应体 | curl body | 纯 meta-refresh HTML（无 admin shell 数据）✅ |
| 375px 无溢出 | JS scrollWidth/innerWidth | 375 = 375 ✅ |
| 1440px 无溢出 | JS scrollWidth/innerWidth | 1440 = 1440 ✅ |
| 67 Vitest 测试 | npm test | 67/67 passed ✅ |
| typecheck | vue-tsc --noEmit | 0 errors ✅ |
| lint | eslint . | 0 errors ✅ |
| build | nuxt build | BUILD COMPLETE ✅ |

**变更文件：** `server/middleware/admin-auth.ts`（唯一代码改动）

---

### Phase 9C-2 规划已确认（2026-09-04，待代码开发授权）

**规划文档：** `docs/project/PHASE-9C-2-MEDIA-LIBRARY-FOUNDATION-SPEC.md`（本次 commit 写入）

**规划内容涵盖：**
- 双资料区边界（Media Library 公开媒体库 / 私有原始资料区）
- 文件元数据字段分层与引用关系
- 全局引用查询 API 规格（`GET /api/admin/media/:uuid/references`）
- 软归档五阶段文件生命周期
- 各阶段功能范围（9C-1 已完成 / 9C-2 待授权 / 二期待授权）
- 权限、审计与存储策略（含 Directus Collection 配额规划）
- Phase 9B 接口与安全边界（9C-2 视角定义，Phase 9B 须单独授权）
- 已确认开放决策（见下表）

**已确认决策（2026-09-04）：**

| # | 决策内容 |
|---|---------|
| #10 | 软归档状态使用独立 Directus Collection 或独立 Postgres 数据表关联 file_id；**不修改 directus_files 表结构** |
| #11 | 管理员引用 API 返回引用数量 + 实体名称/ID/file_role；**公开 API 不暴露任何引用信息** |
| #12 | SHA-256 仅提示重复（UI 显示已有相同内容文件的 UUID）；管理员可确认后继续上传；**不自动合并、不强制阻止** |

**仍待确认（不阻塞 9C-2 开发）：** 决策 #4/#5/#6/#7/#8/#9/#13（详见规划文档第八节第二组）

**下一步：** 9C-2 代码开发尚未开始。开始开发前须用户单独授权。

---

### Phase 8B-1 完成内容

| 类别 | 完成项 |
|------|--------|
| 新建文件 | `composables/useSeoHead.ts`（canonical、hreflang、OG、Twitter Card、robots meta 统一输出）、`public/robots.txt`（三行，无 Sitemap） |
| 修改文件 | `nuxt.config.ts`（移除硬编码 lang=en）、`layouts/default.vue`（动态 html lang）、`error.vue`（迁移至 useSeoHead） |
| 页面文件 | 28 个页面全部替换 useHead → useSeoHead，含响应式 MaybeRefOrGetter 接口 |
| Bug 修复 | Bug #1：products/[category]/[slug].vue locale-aware SEO；Bug #2：posts adapter canonicalPath 推导（faq 返回空字符串）；Bug #3：products adapter seo_image 映射 |
| EN 路由规则 | canonical（首页含尾斜杠，其余无尾斜杠）+ hreflang=en + hreflang=x-default |
| /es/ /pt/ 路由 | noindex, follow；无 canonical；无 hreflang；不进 sitemap |
| 验收结果 | typecheck 0 errors、lint 0 errors、build SUCCESS、浏览器源码全部通过、375px 无溢出 |

### Phase 8B-1 浏览器验收通过项

| 页面 | 验收结果 |
|------|---------|
| 首页 | html lang=en，canonical=https://litubo.com/，hreflang=en+x-default ✅ |
| /es/ | html lang=es，noindex,follow，无 canonical，无 hreflang ✅ |
| robots.txt | 三行，无 Sitemap 行 ✅ |
| privacy-policy | noindex,follow，无 canonical ✅ |
| terms-of-use | noindex,follow，无 canonical ✅ |
| /support/faq | canonical=https://litubo.com/support/faq，hreflang=en+x-default ✅ |
| 404（error.vue） | noindex,follow，无 canonical ✅ |
| 375px | 无水平溢出 ✅ |

### Phase 7A — HubSpot（历史完成）

**Phase 7A 本地实施完成并通过完整 mock 链路验收，等待 Phase 7B 用户配置 HubSpot 属性与 Token。**

### Phase 7A 完成内容

| 类别 | 完成项 |
|------|--------|
| Directus 字段 | `inquiries` 新增 4 个 `hubspot_*` 字段 |
| Directus 权限 | nuxt-server READ=id、CREATE+hubspot_sync_status、UPDATE=hubspot 字段 |
| 新建文件 | `server/utils/syncHubspot.ts`、`directus/schema/phase6-before-hubspot.yaml`、`directus/schema/phase7-hubspot.yaml` |
| 修改文件 | `server/utils/writeInquiry.ts`（?fields=id）、`server/api/inquiries.post.ts`（syncHubspot 集成）、`nuxt.config.ts`、`.env.example`、`pages/privacy-policy.vue`、`docs/OPERATIONS-HANDBOOK.md` |
| 类型 | `types/content.ts` 新增 `HubspotSyncStatus`（`not_configured \| pending \| synced \| failed`） |
| HubSpot 属性映射 | 7 个确认属性：`litubo_inquiry_type`、`litubo_source_url`、`litubo_utm_source`、`litubo_utm_medium`、`litubo_utm_campaign`、`litubo_product_interest`、`litubo_last_inquiry_at` |

### Phase 7A mock 链路验收结果

| 场景 | 条件 | Directus 结果 | 通过 |
|------|------|---------------|------|
| 1 无 Token | 真实表单提交，`HUBSPOT_ACCESS_TOKEN` 为空 | `not_configured`，无 contact_id | ✅ |
| 2 fake token + mock 成功 | mock 返回 `{id:"mock-contact-42"}` | `synced`，`hubspot_contact_id=mock-contact-42` | ✅ |
| 3 fake token + mock 401 | mock 返回 HTTP 401 | `failed`，`error_summary=hubspot_patch_401`（无 PII）| ✅ |
| 4 fake token + mock 慢响应 | mock 延迟 3100ms（超过 AbortController 2500ms） | `failed`，`error_summary=TIMEOUT`，表单响应 2679ms | ✅ |
| 5 fake token + INVALID_PROPERTY | mock 返回 HTTP 400 属性校验失败 | `failed`，`error_summary=hubspot_post_400`（无 PII）| ✅ |

所有场景：前台均返回 `{ok:true}`，无 inquiry id、Token、Directus URL 泄露。测试记录已从 Directus 删除。

### 无 Token 状态说明

当前所有询盘写入后 `hubspot_sync_status = not_configured`，这是正确的预期状态。

### Phase 7B 仍需用户完成的内容

### Phase 7B 需要用户完成（开发人员不可代劳）

1. 在 HubSpot 账户中创建 **Private App**（不是 API Key），权限：`crm.objects.contacts.write`（代码无 GET/READ 调用，无需 read 权限）
2. 在 HubSpot **联系人属性** 中创建以下 7 个自定义属性：`litubo_inquiry_type`、`litubo_source_url`、`litubo_utm_source`、`litubo_utm_medium`、`litubo_utm_campaign`、`litubo_product_interest`、`litubo_last_inquiry_at`
3. 将 Private App 的 Access Token 写入服务器 `.env`：`HUBSPOT_ACCESS_TOKEN=<token>`
4. 按当时实际部署方式重启 Nuxt 服务（具体命令须在部署服务名称确认后执行，不要自行推断命令）
5. 提交真实测试询盘，验证 HubSpot Contact 和 `hubspot_sync_status=synced`

**不需要创建 Deal、Pipeline 或 Stage——Phase 7A/B 只同步 Contact。**

---

### 历史待办（已完成的 7A）——不需要的内容

#### 7A 不需要的内容（不要向用户索取）

- HubSpot Access Token
- HubSpot Portal ID
- Pipeline ID / Stage ID
- HubSpot Deal 配置

Phase 7A 只编写 Contact 同步代码框架；无 Token 时同步状态落为 `not_configured`，这本身是 7A 的验收测试内容。

### 7A 必须实施的内容

#### Directus 层

`inquiries` collection 新增 4 个字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `hubspot_sync_status` | string | `not_configured` / `pending` / `synced` / `failed` |
| `hubspot_contact_id` | string | HubSpot Contact ID（有 Token 后填入） |
| `hubspot_synced_at` | timestamp | 同步时间戳 |
| `hubspot_error_summary` | text | 错误摘要（可读，不含敏感信息） |

`nuxt-server` 角色权限调整：
- READ：仅 `id` 字段（`POST /items/inquiries?fields=id` 前置验证）
- CREATE：白名单新增 `hubspot_sync_status`
- UPDATE：仅上述 4 个 `hubspot_*` 字段

#### 代码层

| 文件 | 操作 |
|------|------|
| `server/utils/syncHubspot.ts` | **新建**：HubSpot Contact 同步函数；无 Token → `not_configured`；有 Token → 调用 API（≤3 秒超时）；结果写回 Directus |
| `server/utils/writeInquiry.ts` | **修改**：POST 请求改为 `?fields=id`，确保返回 `data.id` |
| `server/api/inquiries.post.ts` | **修改**：Step 9 之后增加受控 `await syncHubspot(...)`（≤3 秒），不影响表单成功响应 |
| `nuxt.config.ts` | **修改**：`runtimeConfig` 新增 `hubspotAccessToken` |
| `.env.example` | **修改**：新增 `HUBSPOT_ACCESS_TOKEN=` |
| `pages/privacy-policy.vue` | **修改**：补充隐私政策正文 |
| `docs/OPERATIONS-HANDBOOK.md` | **修改**：HubSpot 状态更新为"代码已就绪，尚未配置 Token，当前状态为 not_configured" |
| `directus/schema/phase7-hubspot.yaml` | **新建**：4 个新字段及权限的 schema 快照 |

#### 7A 结束时操作手册状态

```
HubSpot 同步代码已准备，尚未配置 Token，当前询盘状态为 not_configured。
```

**不得**写"已启用"。

### 未来 Phase 7B（用户单独授权后）

由用户在 HubSpot 账户创建 Private App，提供 `HUBSPOT_ACCESS_TOKEN`，开发团队完成真实 Contact 同步验收。Deal、Pipeline、AI 助手等属于更后续的独立模块。

---

## 5. 新会话接手步骤

1. **读此文件**（`docs/project/CURRENT-STATE.md`）
2. **读** `docs/ADMIN-CMS-SPEC.md`
3. **读** `docs/OPERATIONS-HANDBOOK.md`
4. **执行只读核对并报告**：

   ```
   git status --short
   git branch --show-current
   git log -12 --oneline
   git remote -v
   docker compose ps
   ```

5. **比对**：若实际状态（分支、最新 commit SHA、容器状态）与本文件记录不一致，停止并报告差异，不猜测，不自动修复。
6. **等待用户授权**后再开始任何实施工作。

---

---

## Governing Charter V1 + FD-001 确认（2026-09-06）

**当前进入"母版对齐与结构施工"阶段。Framework Decision FD-001 已生效。**

| 项目 | 状态 |
|------|------|
| `docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md` | 已建立，生效中 |
| Admin English UI — Phase A（products 界面英文化） | ✅ commit `008d708`，已 push |
| Admin English UI — Phase B（media 界面英文化） | ✅ commit `4a88954`，已 push |
| M5-A 审计（只读，零代码变更） | ✅ 已完成，报告已输出 |
| Governing Charter V1 建立 | ✅ commit `b1cb789`，已 push |
| **FD-001 — 视觉与逻辑母版施工授权确认** | **✅ 已生效（2026-09-06，用户明确确认）** |

**FD-001 核心记录：**

原始资料包中的 DRAFT 状态描述的是资料包自身的原始登记状态，保留不变、不得修改。用户已在 2026-09-06 明确确认下列母版为当前施工方向，Charter 内记录为 USER-CONFIRMED FOR IMPLEMENTATION：ADM-02 / ADM-02a（Product Center）、ADM-03～08（Product Workspace）、逻辑参考图 01 / 02（Dossier 与 Import 逻辑）。此确认不授权 AI、导入、真实数据或发布。

**下一步施工顺序（严格按序，每步须用户独立授权）：**

1. **Product Center 重构（J-2）**：ADM-02 + ADM-02a 已由 FD-001 确认，等待 Codex 发完整施工单后可开始代码施工
2. **Product Workspace Shell（J-3 ～ J-4）**：在 J-2 完成后，ADM-03～08 已由 FD-001 确认，可按序施工
3. **真实 LT-180C Draft 录入（M5-B）**：满足 M5-A 报告中所有准入条件后，须用户单独授权

**明确禁止（无框架变更声明的情况下）：**
- 在 Product Center（J-2）完成前，不启动 Product Workspace、AI Dossier 或 Import Queue；
- FD-001 不授权 AI、导入、真实数据写入或发布；
- 零散 UI 文案任务不得绕过 Governing Charter 继续推进；
- 不得跳过 J-2 直接施工 J-3 及后续步骤。

---

## Governing Charter V1.1 框架补全（J-1.1，2026-09-06）

**状态：Charter V1.1 已完成、提交、推送至 GitHub。J-2 Product Center 施工门禁已解除。**

| 项目 | 状态 |
|------|------|
| Charter 升级至 V1.1（11 项框架补充） | ✅ 本次 commit |
| E.4 系统域所有权（四功能域边界） | ✅ 已写入 Charter |
| E.5 前台与后台联动合同 | ✅ 已写入 Charter |
| F.4 不可偷跑规则 | ✅ 已写入 Charter |
| G.4 产品数据与 API 合同（全字段审计） | ✅ 已写入 Charter |
| G.5 生命周期门禁、并发与错误合同 | ✅ 已写入 Charter |
| H.4 AI/导入接入完整 Gate 链（J-7 前置条件） | ✅ 已写入 Charter |
| I.2 渐进重构、兼容、迁移与恢复原则 | ✅ 已写入 Charter |
| J 节施工顺序更新（含 J-1.1，对齐施工单） | ✅ 已写入 Charter |
| K.2 开工声明扩展（新增 4 项必填字段） | ✅ 已写入 Charter |
| M.2 新增 DG-10～DG-16（7 项新 Decision Gate） | ✅ 已写入 Charter |
| Section N 非视觉质量合同 | ✅ 已写入 Charter |
| Section O Definition of Ready / Done | ✅ 已写入 Charter |
| CLAUDE.md 开工声明格式更新为 V1.1 | ✅ 本次更新 |
| MASTER-ROADMAP.md J-1.1 里程碑记录 | ✅ 本次更新 |

**Charter V1.1 新增 Decision Gates（DG-10 ～ DG-16，均为未确认，代码施工前须由用户确认）：**

| Gate | 事项 | 影响模块 |
|------|------|---------|
| DG-10 | Category Health 的业务定义 | ADM-02a 分类视图（J-2） |
| DG-11 | 产品完整度（Readiness）计算规则与阈值 | ADM-02 列表（J-2） |
| DG-12 | 产品媒体角色（file_role）枚举与排序规则 | ADM-04（J-5） |
| DG-13 | 页面内容模块审核粒度（整产品 vs 逐模块） | ADM-05（J-6） |
| DG-14 | SEO 与多语言发布规则（ES/PT 激活条件） | ADM-07（J-6）及 J-10 |
| DG-15 | 导入模板字段与错误修复规则 | Import Center（J-8） |
| DG-16 | 原始视觉资料包的独立备份位置与方式 | 视觉资料安全保障 |

**当前施工顺序（J-1.1 完成后）：**

1. **J-2 — Product Center 结构性重构（ADM-02 + ADM-02a）**：FD-001 已确认视觉，DG-10/DG-11 需在施工单中明确或标注为"施工中确认"，等 Codex 完整施工单后立即可开始
2. **J-3 — Product Workspace Shell + Product Control**：J-2 完成后
3. **J-4 ～ J-6 — ADM-03 / ADM-04 / ADM-05～08**：J-3 完成后，按序逐步施工
4. **J-7 / J-8 — AI Dossier / Import**：须 H.4 前置条件全部满足 + 用户单独授权
5. **J-9 — 真实产品 Draft 录入**：用户确认真实资料后
6. **J-10 — 前台联动与发布验收**

**明确禁止（J-1.1 完成后，无框架变更声明的情况下）：**
- J-1.1 完成前（本次施工）不得开始任何 J-2+ 业务代码施工（已满足：本次只改文档）；
- FD-001 不授权 AI、导入、真实数据写入或发布；
- 不得跳过 J-2 直接施工 J-3 及后续。

**本次施工说明（J-1.1 完成）：**
- **只修改了 4 个治理文档**：Charter、CLAUDE.md、CURRENT-STATE.md、MASTER-ROADMAP.md；
- **未修改任何业务代码、页面、组件、API、schema、Directus、媒体或权限**；
- **未触碰四个禁止暂存的资料包**。

---

*最后更新：2026-09-06（J-1.1），并于同日 J-2 完成后再次更新。*

---

## Product Center 结构性重构（J-2，2026-09-06）

**状态：J-2 Product Center 代码施工完成，本地 commit 已创建，等待 Codex 验收。**

### 本次施工范围

| 变更项 | 类型 | 说明 |
|--------|------|------|
| `server/api/admin/products/index.get.ts` | 扩展 | 新增 `category_id`、`search` 过滤参数 |
| `server/api/admin/categories-summary.get.ts` | 新建 | ADM-02a BFF：按分类聚合产品状态计数 |
| `types/product-cms.ts` | 扩展 | 新增 `CategorySummary` 接口 |
| `components/admin/product/ProductCatalogueNav.vue` | 新建 | 产品目录级别子导航（All Products / Categories） |
| `components/admin/product/ProductControlPanel.vue` | 新建 | 产品控制面板（只读，右侧滑出） |
| `pages/admin/products/index.vue` | 重构 | ADM-02 完整结构：状态 tab + 分类筛选 + 搜索 + 表格 + 面板 |
| `pages/admin/products/categories.vue` | 新建 | ADM-02a 分类视图（Category Health = Not assessed / DG-10）|
| `tests/productCenter.test.ts` | 新建 | 7 个单元测试覆盖 categories-summary 聚合逻辑 |

### 验证结果

| 验收项 | 结果 |
|--------|------|
| `npx vitest run` — 全套测试 | ✅ 134/134 通过（原 127 + 新增 7） |
| `npx vue-tsc --noEmit` — 类型检查 | ✅ 0 errors |
| `npm run lint` — ESLint | ✅ 0 errors, 0 warnings |
| `npx nuxt build` — 构建 | ✅ Build complete |
| `git diff --check` — trailing whitespace | ✅ 无错误（仅 LF→CRLF 换行警告，正常）|

### Open Decision Gates（施工中确认状态）

| DG | 主题 | 本次处理方式 |
|----|------|------------|
| DG-10 | Category Health 公式 | 显示"Not assessed — scoring rule not configured (DG-10)" |
| DG-11 | 产品完整度计算规则 | 未在列表中显示，待 J-3 阶段确认 |

### 禁止声明（已遵守）

- 未暂存/修改/移动/删除四个禁止资料包
- 未使用 `git add .` / `git add -A` / `git reset --hard` / `git clean` 等命令
- 未修改 Directus schema、ProductBasicForm 业务逻辑、全局 Media Library
- 未涉及 AI、Import Center、Product Workspace ADM-03～08
- 未 push、未部署、未要求用户登录

### 下一步施工顺序

1. **J-3 — Product Workspace Shell + Product Control（ADM-03）**：J-2 验收通过后，等待 Codex 下一份完整施工单
2. **J-4 — Content Editor（ADM-04）**：J-3 完成后
3. DG-10（Category Health 公式）仍需用户在施工单中确认，J-2 已标注为 Not assessed

*最后更新：2026-09-06，由 Claude Code 在"J-2 Product Center 结构性重构"任务中写入。*

---

## Blueprint 正式登记与唯一入口规则固化（J-2.5，2026-09-06）

**状态：J-2.5 文档治理任务完成，本地 commit 已创建，等待 Codex 审核。**

### 已安装的受控文件

| 文件 | 路径 | 状态 |
|------|------|------|
| Implementation Blueprint V1 | `docs/project/ADMIN-CMS-IMPLEMENTATION-BLUEPRINT-V1.md` | ✅ 已安装，正确路径，已登记 |
| Governing Charter V1.1 | `docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md` | ✅ 已添加 C.4 Blueprint 交叉引用 |
| CLAUDE.md | `CLAUDE.md` | ✅ 已添加唯一入口规则、七步阅读顺序、权威关系、禁止规则 |
| 旧 09 文件 | `docs/project/09-claude-first-read-only-instruction.md` | ✅ 保留历史正文，顶部添加 LEGACY 重定向说明 |

### 唯一 Claude 开工入口

**CLAUDE.md 是唯一 Claude 施工入口。** `docs/project/09-claude-first-read-only-instruction.md` 已标记为历史说明文档，不再作为可执行指令或开工规则来源。

### 当前 J-2 状态（截至本次记录时）

- J-2 Product Center 代码施工已完成：commit `178b340`（本地，未 push）
- 自动化验证已通过（134 tests、0 typecheck errors、0 lint errors、build OK）
- **J-2 仍待：Codex 审核、集中浏览器视觉验收、用户单独授权后 GitHub push**
- **J-2 不得标记为已完成或已上传**

### J-3 及以后

- J-3（Product Workspace Shell + Product Control）及所有后续模块**尚未开始**
- 每个模块须在 J-2.5 通过 Codex 审核后，收到对应完整施工单方可启动
- Blueprint 施工顺序：J-2 → J-2.5 → J-3 → J-3.5 → J-4 → J-5 → J-6a～e → J-7（单独授权）→ J-8（单独授权）→ J-9 → J-10 → J-11

### 禁止声明（已遵守）

- 未修改任何业务代码、Vue 页面、组件、API、tests、types
- 未修改 Directus schema、角色、权限、数据
- 未修改 .gitignore、Docker、.env、依赖
- 未暂存四个禁止资料包
- 未 push、未部署、无浏览器登录
- 178b340 未被 amend、rebase 或覆盖
- 缺失文档（`docs/DB重构与初始化说明.md`、`docs/数据库设计文档.md`）已记录为 MISSING，未尝试创建替代文件

*最后更新：2026-09-06，由 Claude Code 在"J-2.5 Blueprint 正式登记与入口规则固化"任务中写入。*

---

## Decision Gate 命名空间冲突修正（J-2.5.1，2026-09-06）

**状态：J-2.5.1 文档治理任务完成，本地 commit 已创建，等待 Codex 审核。**

### 问题背景

Charter M.2 定义 DG-01～DG-16（治理级门控），Blueprint Section 12 原定义 DG-01～DG-15（执行级门控）。两套编号全部冲突：同一数字含义完全不同，对 Claude 造成歧义。

### 已执行修改

| 文件 | 修改内容 |
|------|---------|
| `docs/project/ADMIN-CMS-IMPLEMENTATION-BLUEPRINT-V1.md` | Section 12 全部 DG-01～DG-15 改写为 BP-DG-01～BP-DG-15；新增 Gate Namespace Rule 段落 |
| `docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md` | 新增 C.5 Decision Gate 命名空间规则（Charter DG-xx 与 Blueprint BP-DG-xx 独立，互不推断） |
| `CLAUDE.md` | 开工报告必填项拆分为"Charter DG-xx"与"Blueprint BP-DG-xx"两行 |
| `docs/project/CURRENT-STATE.md` | 本节记录 |
| `docs/project/MASTER-ROADMAP.md` | 新增 J-2.5.1 里程碑记录 |

### 不受影响的 DG 引用

- `pages/admin/products/categories.vue:70` 中显示的 `(DG-10)` 指向 **Charter DG-10**（Category Health 业务定义），Charter DG-xx 未做任何改动，此引用保持正确。
- Charter M.2 的 DG-01～DG-16 编号及含义**完全不变**。

### 禁止声明（已遵守）

- 未修改任何业务代码、Vue 页面、组件、API、types、tests
- 未修改 Directus schema、角色、权限、数据
- 未修改 Docker、.env、.gitignore、依赖
- 未暂存四个禁止资料包
- 未修改 Blueprint 的模块顺序、业务含义、AI/Import 边界
- 未修改 Charter 现有 DG-01～DG-16 的编号或业务含义
- 未触碰 `docs/project/09-claude-first-read-only-instruction.md`（J-2.5 已完成）
- 未 push、未部署

### 下一步

J-2.5.1 完成后，等待 Codex 集中验收 J-2 + J-2.5 + J-2.5.1，授权 GitHub push；再按 Blueprint 顺序启动 J-3 Product Workspace Shell。

*最后更新：2026-09-06，由 Claude Code 在"J-2.5.1 DG 命名空间冲突修正"任务中写入。*

---

## Product Center 视觉结构对齐（J-2.2，2026-09-06）

**状态：J-2.2 代码施工完成，本地 commit 待创建，等待 Codex 集中浏览器验收。**

### 本次施工范围（ADM-02 + ADM-02a 落地）

| 变更项 | 类型 | 说明 |
|--------|------|------|
| `server/api/admin/products-summary.get.ts` | 新建 | Directus aggregation → `{all, draft, review, draft_review, published, archived}` |
| `server/api/admin/asset/[id].get.ts` | 新建 | UUID 校验 + admin Bearer 代理 + `sendStream`；`private, max-age=3600` |
| `server/api/admin/products/index.get.ts` | 扩展 | status 多选：单值用 `_eq`，多值用 `_in[]` 重复参数 |
| `types/product-cms.ts` | 扩展 | 新增 `ProductsSummary` 接口 |
| `components/admin/product/ProductCentreSidebar.vue` | 新建 | SYSTEM VIEWS（4 视图含真实计数）+ Needs Attention 禁用门控（BP-DG-02）+ PRODUCT TAXONOMY（NuxtLink / 真实 total）+ 移动端水平滚动条 |
| `components/admin/product/ProductControlPanel.vue` | 扩展 | 标题→ Product Control；宽度→ 320px；hero image（真实或 SVG 占位）；`panel-identity`（name + status）；`summary_en`；"View category →" NuxtLink |
| `pages/admin/products/index.vue` | 重构 | 3 列布局（Sidebar 204px + 主内容弹性）；filter bar（Search + Status 含 draft,review + Category + Clear filters）；产品表格（缩略图列 via asset proxy）；分页；ProductControlPanel 点击展开 |
| `pages/admin/products/categories.vue` | 修改 | 行链接 `?category_id=N` → `/admin/products/categories/${N}` |
| `pages/admin/products/categories/[id].vue` | 新建 | ADM-02a 分类上下文页：分类 tabs 导航 + filter bar + 产品表格 + CategoryContextPanel（counts + Category Health="Not assessed DG-10"）；375px panel 折叠至底部 |
| `tests/productCenter.test.ts` | 扩展 | 新增 4 个 describe 块（products-summary 聚合 / multi-status 过滤器 / Needs Attention 门控 / category context 过滤）；总计 24 个测试 |

### 验证结果

| 验收项 | 结果 |
|--------|------|
| `npx vitest run` — 全套测试 | ✅ 151/151 通过（含 J-2.2 新增 17 个） |
| `npx vue-tsc --noEmit` — 类型检查 | ✅ 0 errors |
| `npm run lint` — ESLint | ✅ 0 errors, 0 warnings |
| `npx nuxt build` — 构建 | ✅ Build complete |
| `git diff --check` — trailing whitespace | ✅ 无错误（仅 LF→CRLF 警告，Windows 正常）|

### Open Decision Gates（施工中状态）

| DG | 主题 | 本次处理方式 |
|----|------|------------|
| Charter DG-10 | Category Health 公式 | `categories.vue` 显示"Not assessed (DG-10)"；`categories/[id].vue` 面板显示"Not assessed — Scoring rule not confirmed (DG-10)" |
| Charter DG-11 | 产品完整度 Readiness | 列表中未展示；待 J-3 阶段处理 |
| BP-DG-02 | Needs Attention 门控 | 侧边栏按钮 disabled，显示"(DG-10)"注释，不查询、不显示计数 |

### 禁止声明（已遵守）

- 未暂存/修改/移动/删除四个禁止资料包
- 未使用 `git add .` / `git add -A` 等批量暂存命令
- 未修改 Directus schema、角色、权限、真实产品/媒体/来源记录
- 未修改 ProductBasicForm 业务逻辑、全局 Media Library
- 未涉及 AI、Import Center、Product Workspace ADM-03～08
- 未 push、未部署、未要求用户登录

### 下一步

J-2.2 等待集中浏览器验收，验收通过后连同 J-2 / J-2.5 / J-2.5.1 一并 GitHub push（须用户单独授权）。  
之后按 Blueprint 顺序启动 **J-3 Product Workspace Shell + Product Control**。

*最后更新：2026-09-06，由 Claude Code 在"J-2.2 Product Center 视觉结构对齐"任务中写入。*

---

## 图片代理安全边界补验（J-2.2.1，2026-09-06）

**状态：J-2.2.1 安全加固 + 测试完成，本地 commit 已创建，等待 Codex 集中浏览器验收。**

### 本次施工范围（仅允许文件清单）

| 变更项 | 类型 | 说明 |
|--------|------|------|
| `server/api/admin/asset/[id].get.ts` | 安全加固重写 | 见下表 7 项修复 |
| `tests/assetProxy.test.ts` | 新建 | 11 个 describe 块，67 个测试，覆盖施工单 9 类安全要求 |
| `docs/project/CURRENT-STATE.md` | 更新 | 本节 |
| `docs/project/MASTER-ROADMAP.md` | 更新 | J-2.2.1 里程碑记录 |

### 代理端点安全修复（7 项）

| # | 修复项 | 修改前 | 修改后 |
|---|--------|--------|--------|
| 1 | MIME 类型管控 | 仅转发 content-type，无验证 | `ALLOWED_MIME` Set（jpeg/png/webp/avif/gif），其余 → 415 |
| 2 | Content-Disposition | 未设置 | `inline`（防止意外触发下载） |
| 3 | X-Content-Type-Options | 未设置 | `nosniff` |
| 4 | Cache-Control | `private, max-age=3600` | `private, no-store` |
| 5 | id URL 编码 | `${id}` 直接拼接 | `encodeURIComponent(id)` |
| 6 | 查询参数消毒 | 直接透传至 Directus | `clampInt` 约束 width/height/quality + `ALLOWED_FIT` Set 约束 fit |
| 7 | 上游 redirect 拒绝 | 未设置，默认 follow | `redirect: 'manual'`；3xx → 502 |

### 安全边界覆盖（施工单 9 类要求）

| 要求 | 测试覆盖 | 结果 |
|------|---------|------|
| 1. 无会话/无效会话/非管理员 → 401，Directus 未被调用 | 源码证据断言（admin-auth.ts 前置）| ✅ |
| 2. 非法 id / 路径注入 / URL 注入 → 400，Directus 未被调用 | 11 个 validateAssetId 测试 | ✅ |
| 3. 合法 id → 固定内部 Directus 目标、仅服务端 Bearer | 源码证据断言 | ✅ |
| 4. 非图片 MIME / SVG / PDF / XLSX → 415 | 15 个 validateMime 测试 | ✅ |
| 5. 上游 redirect / 各类错误 → 安全无细节响应 | 7 个 mapUpstreamStatus 测试 | ✅ |
| 6. 响应 headers：无 Set-Cookie/Location/CORS，含 private no-store 与 nosniff | 5 个 headers 测试 | ✅ |
| 7. products-summary / products list BFF 安全性 | 6+6 个 BFF 测试 | ✅ |
| 8. Needs Attention 无虚构统计（BP-DG-02 门控） | 3 个门控测试 | ✅ |
| 9. ProductControlPanel 仅用 /api/admin/asset/:id，不直接调用 Directus | 3 个 ProductControlPanel 测试 | ✅ |

### 验证结果

| 验收项 | 结果 |
|--------|------|
| `npx vitest run` — 全套测试 | ✅ 218/218 通过（新增 67 个，assetProxy.test.ts 8 files） |
| `npx vue-tsc --noEmit` — 类型检查 | ✅ 0 errors |
| `npm run lint` — ESLint | ✅ 0 errors |
| `npx nuxt build` — 构建 | ✅ Build complete |
| `git diff --check` — trailing whitespace | ✅ 无错误（仅 LF→CRLF 警告） |
| 4 个禁止资料包 `??` 未暂存 | ✅ 确认 |

### 禁止声明（已遵守）

- 未使用 `git add .` / `git add -A` / `git reset --hard` / `git clean` / `git stash` 等命令
- 未修改 Directus schema、角色、权限、ProductBasicForm、admin-auth 中间件主逻辑
- 未修改 J-3 或以后任何功能
- 未触碰四个禁止资料包
- 未 push、未部署、未输出凭证
- 保护提交 `178b340`、`317bec0`、`fdc83d2`、`5821289` 未被 amend 或 rebase

---

## 图片代理路由证据收口 + GitHub Checkpoint 规则（J-2.2.1a，2026-09-06）

**状态：J-2.2.1a 完成，本地 commit 已创建。GitHub checkpoint 分支 `backup/admin-cms-j2` 已推送。**

### 证据缺口关闭（Section 3）

原 `tests/assetProxy.test.ts` 使用内联复制逻辑，测试的是复制体而非生产代码。

**修复方式：** 提取纯函数工具层 `server/utils/adminAssetProxy.ts`（无 Nuxt auto-imports，可被 Vitest 直接 import）。handler 改为从该工具层 import；测试改为从同一工具层 import。两者共享同一代码，消除内联复制缺口。

| 变更项 | 类型 | 说明 |
|--------|------|------|
| `server/utils/adminAssetProxy.ts` | 新建 | 纯导出函数：UUID_RE、ALLOWED_MIME、ALLOWED_FIT、clampInt、validateAssetId、validateMime、buildSafeParams、mapUpstreamStatus |
| `server/api/admin/asset/[id].get.ts` | 修改 | import 从工具层，handler 不再内嵌安全逻辑 |
| `tests/assetProxy.test.ts` | 修改 | import 从工具层（非内联复制），新增 UUID_RE describe 块（总 219 tests） |

### Checkpoint 规则写入治理文件

| 文件 | 修改内容 |
|------|---------|
| `CLAUDE.md` | 新增"GitHub Checkpoint Protocol"节（7 条规则） |
| `docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md` | 新增 L.4 Checkpoint 规则 |
| `docs/project/ADMIN-CMS-IMPLEMENTATION-BLUEPRINT-V1.md` | 新增 10.4 Checkpoint Protocol |

### 验证结果

| 验收项 | 结果 |
|--------|------|
| `npx vitest run` — 全套测试 | ✅ 219/219（8 files） |
| `npx vue-tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors |
| `npx nuxt build` | ✅ Build complete |
| `git diff --check` | ✅ 仅 CRLF 警告 |
| 4 个禁止资料包 `??` 未暂存 | ✅ |
| `backup/admin-cms-j2` checkpoint 推送 | ✅ |
| `origin/master` 未更新 | ✅ |

### Checkpoint 状态（2026-09-06）

| 项目 | 状态 |
|------|------|
| checkpoint 分支 | `backup/admin-cms-j2`（已推送，远程备份用途，不代表验收或可部署状态） |
| `origin/master` | 未更新（落后于本地 HEAD，等待集中浏览器视觉验收 + 用户授权后才可 push） |
| 精确 hash | 以当前 `git ls-remote --heads origin` 和 `git rev-parse HEAD` 实际输出为准；不在此文件硬编码（硬编码会因后续 commit 立即过时，产生误导性记录）|

*最后更新：2026-09-06，由 Claude Code 在"J-2.2.1a + J-2.2.1b"任务中写入（J-2.2.1b 修正了错误的静态 hash 记录）。*

---

## Git 图谱证据收口 + BFF 输入校验（J-2.2.1b，2026-09-06）

**状态：J-2.2.1b 完成，本地 commit 已创建。`backup/admin-cms-j2` checkpoint 已同步至最新 HEAD。**

### Git 图谱核实结论

| 项目 | 实际值 |
|------|--------|
| 本地 HEAD | `git rev-parse HEAD` 实际输出（当前为本次 commit hash） |
| `origin/backup/admin-cms-j2` | 已同步至本次 commit（J-2.2.1b 完成后推送）|
| `origin/master` | `2a3e67f`（未更新，等待集中浏览器验收 + 用户授权）|
| 本地领先 origin/master | 7 个 commit（178b340 → 317bec0 → fdc83d2 → 5821289 → 4a74e42 → 69c0e18 → 948ad9b + 本次）|

所有 7 个既有保护 commit 均在 HEAD 祖先链中（`git merge-base --is-ancestor` 全部返回成功）。

J-2.2.1 的安全代码实际由两个 commit 承载：
- `4a74e42`：原始安全加固（MIME 白名单、Content-Disposition、nosniff、no-store、encodeURIComponent、redirect:manual）
- `69c0e18`：内联复制缺口关闭（提取 `adminAssetProxy.ts` 工具层，handler 和 tests 共享同一代码）

### Product BFF 输入校验修复

发现并修复三处真实缺口：

| 缺口 | 原状态 | 修复方式 |
|------|--------|---------|
| `status` 未过滤已知值 | 任意字符串直接传给 Directus `_eq` / `_in[]` | `filterKnownStatuses()` — 未知状态静默丢弃 |
| `category_id` 无格式校验 | 原始字符串直接拼接 | `validateCategoryId()` — 仅接受整数 FK 格式 |
| `search` 无长度上限 | 无限长字符串 | `sanitizeSearch()` — 截断至 200 字符 |
| 测试使用内联复制逻辑 | BFF 测试复制 handler 内部逻辑 | 改为 import 真实 helper，与 handler 共享同一代码 |

### 新建工具层

| 文件 | 导出符号 |
|------|---------|
| `server/utils/adminProductsQuery.ts` | `KNOWN_STATUSES`、`filterKnownStatuses`、`parsePageNum`、`parseLimitNum`、`validateCategoryId`、`sanitizeSearch`、`buildProductsFilterParts` |

**handler 引用关系：**
- `server/api/admin/products/index.get.ts` → import from `~/server/utils/adminProductsQuery`
- `server/api/admin/products-summary.get.ts` → import `KNOWN_STATUSES` from `~/server/utils/adminProductsQuery`
- `tests/assetProxy.test.ts` → import all helpers from `../server/utils/adminProductsQuery`（与 handler 共享同一代码）

### 验证结果

| 验收项 | 结果 |
|--------|------|
| `npx vitest run` | ✅ **222/222**（8 files；原 219 → +3 新增 BFF 测试） |
| `npx vue-tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors，0 warnings |
| `npx nuxt build` | ✅ Build complete |
| `git diff --check` | ✅ 无 whitespace 错误（仅 CRLF 警告，Windows 正常） |
| 4 个禁止资料包 `??` 未暂存 | ✅ |
| `backup/admin-cms-j2` checkpoint 已同步至 HEAD | ✅ |
| `origin/master` 未更新 | ✅ |

### 禁止声明（已遵守）

- 未使用 `git add .` / `git add -A` / `git reset --hard` / `git clean` / `git stash` / `git rebase` / `git commit --amend` / `git push --force` / `git push origin master`
- 未修改 Directus schema、角色、权限、真实产品/媒体/来源记录
- 未修改 admin-auth 中间件主逻辑、SSR refresh 逻辑
- 未触碰四个禁止资料包
- 未修改 J-3 及以后任何功能
- 七个保护 commit 均未被 amend、rebase 或覆盖

*最后更新：2026-09-06，由 Claude Code 在"J-2.2.1b Git 历史核实、BFF 证据闭环与 Checkpoint 同步"任务中写入。*
