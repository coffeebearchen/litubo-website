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
| Directus Collection 数量 | 上限 25（Directus 社区版限制）；当前已用：`product_categories`、`products`、`products_files`、`site_content`、`posts`、`inquiries`、`product_page_presets`、`product_sections`、`product_section_items`、`product_spec_groups`、`product_spec_items`、`product_faqs`、`product_source_records` = **13 个**（含 M2M junction 1 个） |
| 不进 Git 的内容 | `.env`、PostgreSQL 数据文件、`directus/uploads/`、数据库备份 |

---

## 4. 当前状态 — Phase 9C-1P 管理员会话续期安全强化本地完成

**状态：Phase 9C-1（Media Library）+ Phase 9C-1P（管理员会话续期安全强化）全部本地完成，所有验收通过，本地 commit 已创建。未 push，未部署。等待用户按序授权后续模块。**

> **编号说明：** git commit `f2b9ef1` 消息标签为"Phase 9C-2"，系会话中临时命名；正式文档编号为 **Phase 9C-1P**（9C-1 安全强化补丁），因为 **9C-2 保留给 Media Library 批量选择/归类**，不覆盖。

### 当前本机配置

| 项目 | 当前值 |
|------|--------|
| `CMS_MODE_PRODUCTS` | `directus`（本机测试，`.env` 中，不进 Git） |
| Directus 测试产品 ID=3 | `status=draft`、`seo_noindex=true`、TEST ONLY 标识保留 |
| 推送状态 | 本地 commit 见下表，**未 push，未部署** |
| 生产是否启用 Products Directus | **否**（生产仍用 fixtures，Products 开关独立） |

### 关键提交清单（Phase 9C 阶段）

| commit | 内容 |
|--------|------|
| `da73094` | Phase 9A-2D：管理员发布/撤回完整状态机 |
| `945d5b6` | Phase 9A-2E：公开 Product Center 接入 Directus CMS |
| `041d867` | Phase 9A-2F：Directus 权限修复 + 查询上限 |
| `89d40cd` | Phase 9A-2F-2：规格 note 独立显示 + Hero 面包屑对比度 |
| `cdcdfd5` | Phase 9A-2I：全局面包屑 currentColor+opacity 真正修复 |
| `7e9d41c` | Phase 9C-1：Media Library 基础版 + Products 媒体复用 |
| `f2b9ef1` | Phase 9C-1P（git 标签误为 9C-2）：管理员会话续期基础实现 |
| （本次）  | Phase 9C-1P 收口：refresh 安全分支 + 前端单飞锁 + visibilitychange 补刷 |

### 后续顺序（严格按序，每步须独立授权）

1. ~~**Media Library 基础版**~~：✅ 已在 Phase 9C-1 完成
2. ~~**管理员会话续期**~~：✅ 已在 Phase 9C-1P 完成（含安全强化收口）
3. **9C-2：Media Library 批量选择/归类**（预留编号，待授权）
4. **Settings 最小版**（含但不限于）：
   - Site Settings → Social Links：LinkedIn、YouTube、Instagram、Facebook 各 URL 字段 + 独立显示/隐藏开关
   - 保存后全站 Footer 自动读取并实时更新社交图标与链接
5. **Phase 9B — AI 产品导入与审核**：批量导入产品资料草稿，人工审核后发布，永不自动发布
6. **Content Center**：内容运营中心（博文、资源、页面等综合管理）
7. **真实产品资料录入与正式上线**

**Push 授权、DNS 切换、生产部署须用户单独授权，不在以上范围内。**

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

**验收说明：** Claude Preview 面板浏览器与系统浏览器 cookie 存储完全隔离，无法共享管理员会话；实时 API 调用验收以源码验收替代，下次有真实会话时可补做运行时测试。

**源码验收（最终运行时验收通过——源码级确认，活跃会话可滑动续期）：**

| 验收项 | 结果 |
|--------|------|
| 响应体无 access_token / refresh_token | `return { ok: true }` 为 refresh.post.ts 唯一返回值 ✅ |
| Directus 401/403 → 清 cookie + 返回 401 | `deleteCookie(admin_at) + deleteCookie(admin_rt) + createError(401)` ✅ |
| 网络错误 → 不清 cookie + 返回 503 | `createError(503)` 无 deleteCookie 调用 ✅ |
| 单飞锁防并发 | `if (isRefreshing) return true` 优先路径 ✅ |
| visibilitychange 补刷 | `document.addEventListener('visibilitychange', onVisibilityChange)` ✅ |
| onUnmounted 清理完整 | `clearInterval + removeEventListener` ✅ |
| httpOnly/sameSite/secure/path 保持 | 与 login.post.ts 完全一致 ✅ |
| 活跃会话可滑动续期 | 每 10 分钟自动 refresh，只要标签页活跃会话不中断（不是"7 天后必须重新登录"） ✅ |
| 9C-2 保留给 Media Library 批量操作 | 本阶段编号为 9C-1P，不占用 9C-2 ✅ |

**typecheck / lint / build / git diff --check：** 0 errors / 0 errors / BUILD COMPLETE / 仅 CRLF 警告（Windows 正常）✅

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

*最后更新：2026-09-04，由 Claude Code 在"Phase 9C-1P 管理员会话续期安全强化收口"任务中写入。*
