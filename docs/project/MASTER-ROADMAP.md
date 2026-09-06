# LITUBO Website — Master Roadmap（M1–M9）

> 本文件是项目总控路线图。所有新会话必须在读完 `CURRENT-STATE.md` 后读此文件，以确认当前处于哪个里程碑、有哪些进入条件和禁止事项。

**当前位置：V-0.5.1 审计证据补正完成（2026-09-06）。Register 证据已达标：12 张母版逐张登记（V-0.5 遗漏 2 张 ADM-02 母版已补入）、发现两套资料包权威冲突、9 项 V-0.5 事实错误已更正、English-first 完整台账已建立（约 249 处可见中文分布在 9 个文件）。**

**J-2 移动端 375px 验收：FAILED（用户截图确认横向滚动条、标题被裁切、桌面表格右列不可见）。J-2 整体视觉验收：SUSPENDED。origin/master 提升：BLOCKED。运行来源：RUNTIME_NOT_PROVEN。**

**下一步：CF-1～CF-5 五项事实冲突（ADM 编号命名空间、P2 包权威、ADM-02a–08 缺 375px 母版、母版中文 UI 与 English-first、ADM-02 右栏契约）须由 Codex 裁定；裁定后方可发下一份单一、完整模块施工单。J-3 Workspace Shell 及后续均未开始。**

---

## 总览

| 里程碑 | 名称 | 状态 | 关联 Phase |
|--------|------|------|-----------|
| M1 | Nuxt 框架 + 全站 Shell | ✅ 已完成 | Phase 1 |
| M2 | Directus CMS 基础 + 产品数据模型 | ✅ 已完成 | Phase 2–3 |
| M3 | 内容管理 + 询盘 + HubSpot + SEO | ✅ 已完成 | Phase 4–8 |
| **M4** | **Product CMS Admin + 产品详情页（Phase 9A）** | **🔨 Charter V1.1 生效（J-1.1 完成），J-2 待施工** | **Phase 9A-1 / 9A-2 / Charter J 节** |
| M4.5 | Admin CMS 母版对齐与结构施工（Charter J-2～J-6） | ⏳ J-1.1 完成，J-2 FD-001 视觉已确认，等 Codex 施工单 | Charter J-2 to J-6 |
| M5 | AI 产品资料导入助手（Charter J-6/J-7，Phase 9B） | ⏳ 待单独授权 | Phase 9B |
| M6 | ES/PT 内容审校与发布 | ⏳ 待授权 | Phase 10 |
| M7 | HubSpot 生产激活（Phase 7B） | ⏳ 待用户操作 | Phase 7B |
| M8 | 生产部署 + Cloudflare DNS 切换 | ⏳ 待授权 | Phase 11 |
| M9 | 发布验证 + 监控 + 首次正式上线 | ⏳ 待授权 | Phase 12 |

---

## M1 — Nuxt 框架 + 全站 Shell

**状态：✅ 已完成（Phase 1）**

### 完成内容

- Nuxt 3 + Vue 3 + TypeScript strict 模式
- EN/ES/PT 三语言路由（`prefix_except_default`）
- Header（固定深绿色）、五个桌面端 Mega Menu、移动端 Accordion 导航
- Footer、全局 CSS Token、响应式基线（320–1440px）
- 所有公开路由骨架注册，CMS 适配器模式（fixtures / directus 切换）

### 验收结果

typecheck 0 errors、lint 0 errors、build SUCCESS、375px 无水平溢出

---

## M2 — Directus CMS 基础 + 产品数据模型

**状态：✅ 已完成（Phase 2–3）**

### 完成内容

- Directus 11 + PostgreSQL 16，Docker Compose 本地运行
- `product_categories`、`products`、`products_files`（M2M junction）
- `nuxt-server` 角色最小权限（READ only, published only）
- Nuxt server API `/api/cms/products`、`/api/cms/products/[category]/[slug]`
- 媒体库 `directus_files`（`is_public` 字段）

---

## M3 — 内容管理 + 询盘 + HubSpot + SEO

**状态：✅ 已完成（Phase 4–8）**

### 完成内容

| Phase | 内容 |
|-------|------|
| 4 | `site_content` singleton CMS（首页 Hero） |
| 5 | `posts` collection（Insight、Case Study、FAQ、News、Technical Guide） |
| 6 | `inquiries` 统一询盘管理（contact/technical_matching/distributor/spare_parts/support_request/send_product_test） |
| 7A | HubSpot Contact 同步框架（代码已就绪，Token 待 Phase 7B 配置） |
| 8B-1 | SEO 基础：canonical、OG、Twitter Card、hreflang、html lang、robots.txt |

### 剩余待办（不影响 M4 施工）

- Phase 7B：用户在 HubSpot 创建 Private App，配置 `HUBSPOT_ACCESS_TOKEN`，完成真实 Contact 同步验收
- Phase 8B-2：XML Sitemap 自动生成（M4 完成后排期）

---

## M4 — Product CMS Admin + 新版产品详情页（Phase 9A）

**状态：✅ Phase 9A-1 + 9A-2 核心闭环已完成（本地验收通过，未 push）— 后续子项待授权**

### 已完成子里程碑

#### 9A-1 ✅（完成）

管理员登录 + Product Center 基础信息 + Draft/Review 流程 + JWT 安全层 + 全量 typecheck/lint/build 通过

#### 9A-2 ✅（完成）

内容模块 + 参数组 + 媒体 + FAQ + SEO + 管理员预览 + 公开 Directus 接入 + 完整 Published→Draft 验收闭环

**已完成项（9A-2 核心）：**
- Directus：`product_sections`、`product_section_items`、`product_spec_groups`、`product_spec_items`、`product_faqs`、`product_source_records`（6 collections）
- Admin 子页面：Content / Specs / Media / FAQ / SEO / Preview
- 公开前台：`CMS_MODE_PRODUCTS=directus` 开关、完整产品详情页渲染
- 状态机：Draft → Review → Published → Draft（管理员完整控制）
- 验收：Published 时前台可见 + noindex + sitemap 排除；Draft 撤回后列表消失 + 404
- `nuxt-server` 权限：`product_categories`（18字段）、`products`（25字段），均含 sort
- 面包屑 `currentColor+opacity`：26 条路由全量验证通过（375px + 1440px）
- 规格 note 独立行显示（斜体 `display:block`）

**当前 Directus 测试产品：** ID=3，status=draft，seo_noindex=true，TEST ONLY 标识保留

### M4 待授权后续子项

以下按严格顺序执行，每步须独立授权：

#### M4-Next-1：Media Library 基础版 ✅（Phase 9C-1，commit 7e9d41c）

- 上传、替换、管理媒体文件 ✅
- 整合至产品媒体编辑流程 ✅

#### M4-Next-1P：管理员会话续期安全强化 ✅（Phase 9C-1P，commits f2b9ef1 + 收口 commit）

- auto-refresh 端点：Directus 401/403 清 cookie；网络错误/5xx 不清 cookie ✅
- 前端单飞锁 + visibilitychange 补刷 + 错误分支分离 ✅
- **9C-2 保留给 Media Library 批量选择/归类**（勿覆盖此编号）

#### M4-Next-2：9C-2 Media Library 批量选择/归类（规划已确认，代码待授权）

- 批量选择文件、批量归类到文件夹
- 文件搜索增强、全局引用查询、软归档
- 治理规范：见 `docs/project/MEDIA-AND-PRODUCT-DATA-GOVERNANCE.md`（B0-0 写入）
- 规划文档：`docs/project/PHASE-9C-2-MEDIA-LIBRARY-FOUNDATION-SPEC.md`（2026-09-04 确认，决策 #10/#11/#12 已明确）

#### M4-Next-2R：9C-2R Media Folder Registry ✅（完成，commits 063dea7 / 3c227ee / a177e09）

- 服务端 `FOLDER_POLICY` 冻结表 + `buildFolderRegistry` 纯函数（含 §2.7 ambiguity 检测）
- `validateUploadFolder` / `validateMoveFolder`（FOLDER_AMBIGUOUS 错误码）
- batch-move API、文件夹 policy_state 服务端注入、upload dropdown 仅含 active-canonical
- 侧边栏英文标签（Active destinations / Legacy — read only / Conflict — read only）
- 44 单元测试，全部通过（合计 67/67）
- Directus live 目录树 16 个全确认；B 项审计 Pass（无普通运营角色）

#### M4-Next-P0：S0 只读审计（完成，无代码变更）

- 确认 Directus 内无正式 LT-180C 产品（ID=3 为 TEST ONLY draft）
- 确认 product_source_records 表存在但 0 行，无 Admin API
- 确认 products 表无 product_code 字段
- 确认 13 个媒体文件中无可正式引用的 LT-180C 产品图（元数据/分类未完成）

#### M4-Next-P1：产品身份与来源记录基础 ✅（完成，本次）

**背景：** S0 审计确认 `product_code` 字段缺失（AI pipeline 身份主键），`product_source_records` 缺 archive 能力，无 Admin API 端点。

**实现：**
- Directus schema：`products.product_code`（varchar(100), UNIQUE, nullable）；`product_source_records.archived`（boolean, NOT NULL, default false）+ `archived_at`（timestamptz）
- 业务规则：`product_code` 格式验证（大写/数字/连字符）；已设值后不可更改；`draft→review` 和 `review→published` 须先有合法 `product_code`
- Admin API：`GET/POST /api/admin/products/[id]/sources`、`POST /api/admin/products/[id]/sources/[sourceId]/archive`
- 表单：`ProductBasicForm.vue` 新增 `product_code` 输入（设定后锁定显示）
- 测试：新增 `productCode.test.ts`（18 项）+ `sourceRecords.test.ts`（21 项）
- Schema 快照：`phase-p1-before.yaml` / `phase-p1-after.yaml`

**验证：** 107/107 tests、typecheck 0、lint 0、build OK

**本次未触碰：** TEST ONLY ID=3 产品、真实媒体文件、Directus 权限、AI、部署、凭证

#### M4-Next-2S：Admin SSR 认证边界修复 ✅（完成，commit f04f1e4）

**背景：** 原实现仅在 `server/middleware/admin-auth.ts` 中保护 `/api/admin/*` API 路由；`/admin/*` 页面路由无 cookie 时服务端返回 HTTP 200（admin shell），仅靠 `layouts/admin.vue` onMounted 客户端跳转——不构成充分保护。

**修复：** 同一中间件扩展覆盖 `/admin/*` 页面路由：
- 无 `admin_at` cookie → `sendRedirect 302 /admin/login`
- Directus 验证失败（失效/伪造 token）→ `sendRedirect 302 /admin/login`
- `/admin/login` 本身 + `/api/admin/auth/*` → 排除，不受影响
- `/api/admin/*` → 维持 401/403，不改为 HTML 重定向

**验证（curl，无 cookie）：**
- `/admin/media` / `/admin/products` / `/admin/settings` → 302 Location: /admin/login ✅
- `/admin/login` → 200，无循环 ✅
- 伪造 token → 302 ✅；有效 session → 200 ✅
- `/api/admin/*` → 401（不重定向）✅
- 67/67 tests、typecheck 0、lint 0、build OK、375px/1440px 无溢出 ✅

**本次未触碰：** Directus、媒体、AI、权限、部署、凭证。

#### M4-Next-3：Settings 最小版 ✅（完成，本地验收通过）

**已完成：**
- `site_settings`（singleton）+ `site_social_links`（O2M）Directus collections
- Admin `/admin/settings` 页面：公司联系信息 / Social Links CRUD / Security 只读面板
- 公开 API `GET /api/cms/site-settings` 输出白名单字段 + enabled 社交链接
- Footer 从 CMS 读取，hardcoded fallback 保底
- LinkedIn / YouTube / Instagram / Facebook 四平台动态社交图标
- Schema 快照：`directus/schema/phase-settings-after.yaml`

#### M4-Next-4（= M5）：Phase 9B AI 产品导入与审核

见 M5 节；AI 仅生成 Draft，人工审核后发布，永不自动发布

#### M4-Next-5：Content Center

内容运营中心（博文、资源、页面等综合管理）

#### M4-Next-6：真实产品资料录入与正式上线

**push 授权、DNS 切换、生产部署须用户单独授权**

---

## M5 — AI 产品资料导入助手（Phase 9B）

**状态：⏳ M4 完成 + 用户单独授权后执行**

### 范围（概要）

- `product_import_jobs`（新建）、`product_source_records.import_job_id`（与 M4 中的 `source_file_id` 配合）
- Provider Adapter 模式：OpenAI / DeepSeek / Mock
- 环境变量：`OPENAI_API_KEY`、`DEEPSEEK_API_KEY`、`AI_DEFAULT_PROVIDER`、`AI_DEFAULT_MODEL`、`AI_MONTHLY_BUDGET_USD`
- Settings 页面：只显示连接状态、模型、测试、预算、审计；**绝不显示完整密钥**
- AI 只生成 Draft，人工审核后发布；永不自动发布

### 禁止（M5）

- 连接真实 OpenAI / DeepSeek Key，除非用户在 M5 开始时单独授权
- AI 生成内容绕过人工审核直接发布
- AI 相关 UI 在 M4 内出现

---

## M6 — ES/PT 内容审校与发布

**状态：⏳ M4 完成后排期**

### 进入条件

- 所有英文内容完整、经用户确认
- 西班牙语和葡语译文由真实翻译人员审核通过

### 禁止

- 用机器翻译直接填充并发布 ES/PT
- 未经用户授权启用 `/es/` 或 `/pt/` 语言路由的 indexed 状态

---

## M7 — HubSpot 生产激活（Phase 7B）

**状态：⏳ 用户操作，开发配合**

### 用户必须完成

1. 在 HubSpot 账户创建 **Private App**（权限：`crm.objects.contacts.write`）
2. 创建 7 个自定义联系人属性（见 `CURRENT-STATE.md` Phase 7B 节）
3. 将 Access Token 写入生产服务器 `.env`
4. 重启 Nuxt 服务后提交真实测试询盘

### 禁止

- 开发人员代为操作 HubSpot 账户
- 将 Access Token 写入代码或文档

---

## M8 — 生产部署 + Cloudflare DNS 切换

**状态：⏳ M4 + M7 完成后，用户单独授权**

### 进入条件

- 所有代码 push 到 GitHub，CI 通过
- 腾讯云服务器 Docker Compose 部署就绪
- Cloudflare 配置确认
- 旧 Wix 网站迁移计划确认
- **认证并发安全完整验收**：在独立测试环境（非本地开发）验证多标签 / 多实例场景；若部署多 Nuxt 实例，须先将 `refreshCoordinator` 的 pending / graceCache / rotated 改为共享协调机制（Redis SETNX+TTL）

### 禁止（未授权前绝对禁止）

- `git push` 到任何远程仓库
- 修改 DNS 记录
- 修改生产服务器 Docker 配置
- 修改 Cloudflare 设置
- 关闭或迁移旧 Wix 网站

---

## M9 — 发布验证 + 监控 + 正式上线

**状态：⏳ M8 完成后**

### 验收内容

- Google Search Console 收录验证
- Cloudflare Analytics 数据流正常
- 所有公开页面 canonical / hreflang / robots 正确
- 核心 Web Vitals（LCP/CLS/FCP）基线测量
- 移动端与桌面端完整验收

---

## 全局安全与操作守则

以下规则在 M1–M9 任何阶段均不可违反：

| 规则 | 说明 |
|------|------|
| `git push` | 未获用户单独授权，禁止 |
| 生产部署 | 未获用户单独授权，禁止 |
| 改服务器配置 | 未获用户单独授权，禁止 |
| 改 DNS / Cloudflare | 未获用户单独授权，禁止 |
| AI Key（真实）| 未获 M5 授权，禁止接入；Key 只存 `.env`，不进 Git |
| 假产品 / 假参数 | 任何阶段禁止创建 |
| AI 自动发布 | 禁止；AI 只生成 Draft |
| Token 泄露 | `.env` 不进 Git；Token 不出现在代码、日志、文档中 |
| `product_source_records` | 绝不向 `nuxt-server` 开放任何权限 |

---

#### M4-Next-DG-Namespace：Decision Gate 命名空间冲突修正 🔨（J-2.5.1，本地 commit，待 Codex 审核）

**完成内容：**
- Blueprint Section 12 全部 DG-01～DG-15 改写为 BP-DG-xx；新增 Gate Namespace Rule 段落
- Charter V1.1 新增 C.5：两套命名空间独立规则，不得互相推断
- CLAUDE.md 开工报告必填项：Charter DG-xx 与 Blueprint BP-DG-xx 分列
- CURRENT-STATE.md 更新：J-2.5.1 状态记录
- MASTER-ROADMAP.md 更新：本条里程碑记录
- **业务代码 `categories.vue:70` 的 `(DG-10)` 引用 Charter DG-10，未改动，保持正确**
- **只修改五个治理文档；未修改任何业务代码、schema、Directus**
- **未 push；178b340 / 317bec0 未被改写**

**下一步：Codex 集中验收 J-2 + J-2.5 + J-2.5.1，授权 GitHub push，再发 J-3 完整施工单。**

---

#### M4-Next-J2.2：Product Center 视觉结构对齐 🔨（J-2.2，本地代码完成，待集中浏览器验收）

**完成内容：**

- 新建 `server/api/admin/products-summary.get.ts`：Directus aggregation → `{all, draft, review, draft_review, published, archived}`
- 新建 `server/api/admin/asset/[id].get.ts`：UUID 校验 + admin Bearer token 代理 + `sendStream` 资产代理
- 扩展 `server/api/admin/products/index.get.ts`：status 多选（`draft,review` → `_in[]` 重复参数）
- 扩展 `types/product-cms.ts`：新增 `ProductsSummary` 接口
- 新建 `components/admin/product/ProductCentreSidebar.vue`：SYSTEM VIEWS（4 视图含真实计数）+ Needs Attention 禁用门控（BP-DG-02，显示"DG-10"）+ PRODUCT TAXONOMY（NuxtLink + 真实 total）
- 扩展 `components/admin/product/ProductControlPanel.vue`：hero image + panel-identity + summary_en + "View category →"
- 重构 `pages/admin/products/index.vue`：3 列布局（Sidebar 204px + 主内容）+ filter bar + 缩略图列 + ProductControlPanel
- 修改 `pages/admin/products/categories.vue`：行链接改为 `/admin/products/categories/${N}`
- 新建 `pages/admin/products/categories/[id].vue`：ADM-02a 分类上下文页（tabs + 产品列表 + CategoryContextPanel）
- 扩展 `tests/productCenter.test.ts`：新增 4 describe 块 / 17 个测试（总 24 个）
- CURRENT-STATE.md + MASTER-ROADMAP.md 文档更新

**验证结果（2026-09-06）：**

- npx vitest run：151/151 ✅
- vue-tsc --noEmit：0 errors ✅
- npm run lint：0 errors ✅
- npx nuxt build：BUILD COMPLETE ✅
- git diff --check：仅 CRLF 警告 ✅

**下一步：集中浏览器验收（/admin/products 1440px + 375px；/admin/products/categories/[id] 1440px + 375px）；验收通过后连同 J-2/J-2.5/J-2.5.1 一并 GitHub push；然后发 J-3 完整施工单。**

---

#### M4-Next-J2.2.1：图片代理安全边界补验 ✅（J-2.2.1，本地 commit，待集中浏览器验收）

**完成内容：**

- 重写 `server/api/admin/asset/[id].get.ts`（7 项安全加固）：MIME 白名单（jpeg/png/webp/avif/gif）、Content-Disposition:inline、X-Content-Type-Options:nosniff、Cache-Control:private no-store、encodeURIComponent(id)、查询参数 clamp 消毒（width/height/quality 上下界 + fit 枚举）、redirect:'manual' 拒绝上游 redirect
- 新建 `tests/assetProxy.test.ts`（67 个测试，8 files 218/218 通过）：覆盖施工单 9 类安全要求（auth 边界、id 注入、MIME 验证、参数消毒、上游错误映射、响应头验证、BFF 输入校验、Needs Attention 门控、ProductControlPanel 代理路径）
- 文档更新：CURRENT-STATE.md + MASTER-ROADMAP.md

**验证结果（2026-09-06）：**

- npx vitest run：218/218（8 files）✅
- vue-tsc --noEmit：0 errors ✅
- npm run lint：0 errors ✅
- npx nuxt build：BUILD COMPLETE ✅
- git diff --check：仅 CRLF 警告 ✅
- 4 个禁止资料包 `??` 未暂存 ✅

**下一步：集中浏览器验收（J-2 + J-2.2 范围）；验收通过后连同所有本地 commit 一并 GitHub push（须用户授权）；然后发 J-3 完整施工单。**

---

#### M4-Next-Charter-Blueprint：Blueprint 正式登记与唯一入口规则固化 🔨（J-2.5，本地 commit，待 Codex 审核）

**完成内容：**
- `docs/project/ADMIN-CMS-IMPLEMENTATION-BLUEPRINT-V1.md` 正式纳入版本控制（首次 staged + committed）
- `CLAUDE.md` 新增：唯一入口声明、七步阅读顺序、权威关系表、禁止跳阶段规则、开工报告必填项
- Charter V1.1 新增 C.4：Blueprint 交叉引用（Charter 优先、事实冲突先报告）
- `docs/project/09-claude-first-read-only-instruction.md` 顶部添加 LEGACY 历史重定向说明（历史正文保留）
- CURRENT-STATE.md 更新：J-2.5 状态记录、J-2 当前状态澄清、J-3 尚未开始声明
- MASTER-ROADMAP.md 更新：当前位置说明 + 本条里程碑记录
- **只修改治理文档；未修改任何业务代码、schema、Directus、数据、.gitignore**
- **未 push；178b340 未被改写**

**下一步：Codex 审核 J-2.5 + J-2，授权 GitHub push；然后发 J-3 完整施工单。**

---

#### M4-Next-Charter-V1.1：Governing Charter V1.1 框架补全 ✅（完成，J-1.1，本次）

**完成内容：**
- 11 项框架补充（E.4/E.5 域所有权与前台联动合同、F.4 不可偷跑规则、G.4 数据/API 合同、G.5 生命周期/并发/错误合同、H.4 AI 完整 Gate 链、I.2 渐进重构兼容、J 节施工顺序更新、K.2 开工声明扩展、M.2 新增 DG-10～DG-16、Section N 非视觉质量合同、Section O DoR/DoD）
- 唯一修改治理文档 4 个（Charter、CLAUDE.md、CURRENT-STATE.md、MASTER-ROADMAP.md）
- 未修改任何业务代码、schema、Directus、媒体、权限
- **J-1.1 完成后，J-2 Product Center 施工门禁解除（FD-001 视觉已确认），等 Codex 发完整施工单**

---

*最后更新：2026-09-06，V-0.5.1 审计证据补正完成写入。*

---

#### M4-Next-V0.5.1：视觉与数据对齐审计证据补正（2026-09-06）

**状态：完成。仅修改 3 个治理文档（Register / CURRENT-STATE / MASTER-ROADMAP），无业务代码变更。V-0.5 的注册 commit `9a9d306` 与 checkpoint 备份保留有效。**

**背景：** V-0.5 完成了 Register 的制度注册，但其"事实审计"部分证据不达标，不可作为下一轮代码施工依据。本次仅补正证据登记与报告质量。

**核心补正：**

1. **母版登记 10 → 12 个文件。** 发现视觉资料分属两个独立且不一致的资料包：
   - **P1** `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/` — 索引自称"视觉唯一入口"，ADM-02 标 `DRAFT`
   - **P2** `docs/design-reference/inbox/admin-cms-ai-v1/` — README 明确禁止"treated as approved visual masters"与"implemented directly from these pictures"
   - V-0.5 遗漏的 2 张：ADM-02 的 `admin/desktop-1440/…v01.png` 与 **`admin/mobile-375/…v01.png`**

2. **375px 母版的发现使 FAILED 有了契约对照。** 该母版规定 ADM-02 手机端为**堆叠卡片列表**（缩略图 + 名称 + 产品编号 + 完整度条 + 来源 + 更新时间 + 状态徽章 + 单卡操作，配吸顶头部、四格状态条、底部固定操作栏），**未**规定横向滚动的桌面表格。当前 375px 失败是契约偏离，非审美意见。

3. **运行来源改判 `RUNTIME_PROVEN` → `RUNTIME_NOT_PROVEN`。** V-0.5 所记 PID 33632 已不存在（当前为 PID 27024）；Nuxt dev 服务工作树而非 commit，且不输出任何 commit SHA；用户截图无时间戳/PID/构建标识。现有证据下任何路由都不得标记 `VISUALLY_VERIFIED`。

4. **9 项 V-0.5 事实错误更正**，其中最关键：**ADM-07 的 SEO 路由确实已在 `ProductSubNav.vue` 第 12 行链接，共 6 个 tab**——V-0.5 把 5 个中文标签误当成标签总数。另更正 Specs BFF 6→7 端点、Sections BFF 7→8 端点、HEAD `5ea32f9`→`9a9d306`。

5. **English-first 完整台账建立。** 扫描 `layouts/admin.vue` + `pages/admin/` + `components/admin/`，`pages/admin/` 下 246 处 / 10 文件。**约 249 处可见 UI 中文分布在 9 个文件**；V-0.5 遗漏的 4 个文件已补入（`login.vue` 8 处、`[id]/index.vue` 9 处、`[id]/faq.vue` 22 处、`media/index.vue` 1 处注释合规）。逐行行号见 Register 12.1 节。

6. **额外发现无母版路由：** `/admin/products/:id/faq` 存在且被 SubNav 链接，配 4 个 BFF 端点，但两套资料包中均无 ADM 母版覆盖独立 FAQ 标签页。状态 `LEGACY` / 母版 `NONE`。

**记录在案、须由 Codex 裁定的 5 项事实冲突：**

| # | 冲突 |
|---|------|
| CF-1 | ADM 编号命名空间冲突：索引的 ADM-04–08 = 单型号 Dossier、ADM-09–11 = 导入队列；Register/Blueprint 的 ADM-04 = Media、ADM-05 = Content、ADM-06 = Relations、ADM-07 = SEO、ADM-08 = Sources |
| CF-2 | P2 包 README 禁止 V-0.5 对它的用法；FD-001 作为用户决定优先，但包自身限制须保持可见 |
| CF-3 | ADM-02a 至 ADM-08 **完全没有 375px 母版**，移动端契约未定义 |
| CF-4 | 两张 ADM-02 母版渲染中文后台界面，与 English-first 基线冲突 |
| CF-5 | 两张 ADM-02 母版右栏契约不同：P1 为"AI 批处理入口"，Register 5.2 节为常驻 Product Control |

**十张母版状态（三轴独立）：** ADM-02 `AUTOMATED_CHECKED` / 375px **FAILED** / 整体 **SUSPENDED**；ADM-02a `AUTOMATED_CHECKED` / `SUSPENDED`；ADM-03/04/05/07 `LEGACY` / `NOT_REVIEWED`；ADM-06 **`NOT_STARTED`**（无路由无 BFF）；ADM-08 **`IN_DISCOVERY`**（仅 3 个 BFF 端点，无页面）；LOGIC-01/02 `NOT_STARTED`。

**下一步：等待 Codex 裁定 CF-1～CF-5，再发下一份单一、完整模块施工单。**

---

#### M4-Next-V0.5：视觉与数据对齐登记册注册 + 只读 V-0 事实审计（2026-09-06）

**状态：完成。Register 已安装，V-0 审计已完成，6 个治理文件已更新，本地 commit 已创建。**

**Register 安装：**
- `docs/project/ADMIN-CMS-VISUAL-DATA-CONFORMANCE-REGISTER-V1.md`（用户放置，由 Claude 完成 V-0 填写）
- Section 4 母版路径 100% 确认（ADM-02～08：`inbox/admin-cms-ai-v1/reference-images/`；Logic-01/02：`CMS-AI-VISUAL-MASTER-V1/logic-references/`）
- Section 8 V-0 状态逐模块填写完成
- Section 12 证据台账完整（HEAD/origin SHA、进程证明、可见中文清单、路由/组件/API 映射表）

**V-0 关键缺口发现：**
- ADM-06：NOT_STARTED — 无 relations.vue，无 Relations BFF
- ADM-07：LEGACY，但 SEO tab 未出现在 ProductSubNav（5 个标签，缺 SEO）
- ADM-08：IN_DISCOVERY — BFF 存在，无 admin 页面
- ADM-03/04/05/07：可见中文文案需英文化（英文优先原则）

**J-2 验收状态：** SUSPENDED（Codex 前序宣告，本次不变）

**6 个治理文件修改：**
1. `CLAUDE.md`：Register 纳入阅读顺序（第 4 项）、权威关系表、开工报告模板
2. `docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md`：C.5a Register 交叉引用规则
3. `docs/project/ADMIN-CMS-IMPLEMENTATION-BLUEPRINT-V1.md`：10.3a Register Gate
4. `docs/project/ADMIN-CMS-VISUAL-DATA-CONFORMANCE-REGISTER-V1.md`：V-0 完整填写
5. `docs/project/CURRENT-STATE.md`：V-0.5 节记录
6. `docs/project/MASTER-ROADMAP.md`：本节记录

**下一步：等待 Codex 下一份单一、完整模块施工单。**
