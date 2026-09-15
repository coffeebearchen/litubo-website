# LITUBO Website — Master Roadmap（M1–M9）

> 本文件是项目总控路线图。所有新会话必须在读完 `CURRENT-STATE.md` 后读此文件，以确认当前处于哪个里程碑、有哪些进入条件和禁止事项。

**当前位置：V-0.6 J-2 Recovery 结构性缺陷收口完成（2026-09-07）。组件别名错配（17 处 `Admin*` 标签）、分类路由父子嵌套缺陷（`categories.vue`→`categories/index.vue`）、3 条过期测试断言，三项均已修复并通过自动化验证（Vitest 280/280、typecheck 0、lint 0、build 成功）与登录态浏览器验收（1440px/375px 均无水平溢出，`/admin/products`、`/admin/products/categories`、`/admin/products/categories/:id` 三条路由均已用生成后的路由表与真实渲染核实）。**

**J-2 技术性结构缺陷（组件解析、375px 桌面表格残留、分类详情路由不挂载）已解决。J-2 整体视觉验收（对照 VM1-ADM02-D1440/M375 的像素级 Codex/用户签收）仍待进行，不因本次修复自动通过。origin/master 提升：仍 BLOCKED。**

**下一步：等待 Codex 安排 J-2 的像素级视觉签收，或发出下一份完整施工单。IMP-01（批量导入）未开始。**

**（2026-09-09 更新）** 上面这句关于 `AI-01` 的原始表述已不再成立：单产品 AI 工作流已经交付并在 TEST ONLY 产品上跑通——AI Source Intake、Proposal Review、Batch Review、Apply to Draft、重复/重放防护、多资料冲突人工裁决均已完成，详见 `CURRENT-STATE.md`。此处仅同步事实，不改变里程碑顺序与任何历史决策。

**PW-GOV-01（2026-09-07）补充：Product Workspace 治理基线已完成——11 张桌面视觉母版已冻结并登记（Register §4.5/§4.6），`PWS-00`～`PWS-08` + `PWS-AI-01`/`PWS-AI-02` 命名空间已确立，child blueprint 状态升级为 `Approved governance baseline — controlled implementation remains gated`。这是纯文档治理：`PWS-00` 代码仍未获授权、仍未开始；J-2 视觉签收与 `origin/master` 状态不受此次影响，维持不变。**

**PWS-DOR-02（2026-09-07）补充：`PWS-00`（Workspace Shell + Overview）的书面实施合同已冻结（只读首版：不可写、Readiness 显示 `Not assessed — rule not configured`、`CF-3` 375px 合同仅限 `PWS-00`）。纯文档治理，`PWS-00` 代码仍未开始，等待 Codex 单独发出 `PWS-00A` 代码施工单；J-2 视觉签收与 `origin/master` 状态不受影响。**

**PWS-07-FAST-01R（2026-09-07）补充：`PWS-07`（Sources & Evidence）只读展示版已交付并通过自动化与浏览器验收（详见 `CURRENT-STATE.md`），同步修复 Media Library 归档引用保护遗漏 `product_source_records` 的缺口。一期范围仅限已有 Media Library 来源、`product_spec_items` 证据目标，`SourceReviewStatus` 枚举未改；`BP-DG-06` 保持未解决，未被关闭；`PWS-08`、人工审核写入、AI 均未开始。J-2 视觉签收与 `origin/master` 状态不受影响。**

**PWS-01-FAST-01（2026-09-07）补充：`PWS-01`（Page Content）已在 Workspace 中交付为可编辑模块（详见 `CURRENT-STATE.md`），完全复用旧编辑器自 9A-2A 起已在使用的 `product_sections`/`product_faqs` API 与字段，仅将交互模型改为"本地暂存 + 显式 Save"，未新增字段、模块类型、审核流程或发布行为。`CH-DG-13`/`BP-DG-07` 均保持未解决，未被关闭；旧编辑器 `content.vue`/`faq.vue` 未改动，仍是并行可写入口。J-2 视觉签收与 `origin/master` 状态不受影响。**

**FD-004（2026-09-09）补充：** Governing Charter 新增 `FD-004 — Risk-Proportionate AI MVP Delivery`（用户确认，Effective，定义见 Charter §D.2）。当前 AI 主线重新聚焦为单产品 Draft 填表闭环；问题须先按 P0 / P1 / P2 分级再决定是否阻塞，非 P0 的 hardening 默认进入 backlog。**这是纯文档治理**：不降低任何 P0 安全边界，不授权 `PWS-AI-APPLY-DRAFT-01` 开工，Apply 仍为服务端 503 + UI disabled，`origin/master` 与部署状态不受影响。

**CONTENT-CENTER-MODULE-FREEZE-01（2026-09-14）补充：** Content Center 视觉方向 ✅ APPROVED；Module Freeze ✅ COMPLETED（D-031，`docs/content-cms/CONTENT-CENTER-MODULE-FREEZE-V1.md`）；`CONTENT-CENTER-BLUEPRINT-01` 为 NEXT — NOT AUTHORIZED。纯文档治理：0 runtime、0 DB、0 Directus；`origin/master` 与部署状态不受影响。

**PROJECT-EXECUTION-PROTOCOL-01（2026-09-14）补充：** ✅ COMPLETED——全项目施工控制协议 `docs/project/PROJECT-EXECUTION-PROTOCOL.md` 生效（授权等级 A0–A5、模块内自动驾驶、模块间人工授权、local commit ≠ push ≠ merge ≠ deploy）。里程碑顺序不变；`CONTENT-CENTER-BLUEPRINT-01` 仍为 NEXT — NOT AUTHORIZED。

**CONTENT-CENTER-BLUEPRINT-01（2026-09-14）补充：** ✅ COMPLETED——Content Center 技术蓝图冻结（D-032；4 个新集合提案未创建）。NEXT：`CC-IMP-01` Content Foundation — NOT AUTHORIZED。0 runtime、0 DB、0 Directus。

**CC-IMP-01（2026-09-14）补充：** ✅ COMPLETED（LOCAL COMPLETE）——Content Center 数据地基：4 个集合（本地开发库）、数据库 `(locale, slug)` 唯一约束、代码注册表、Draft-only Admin BFF、自动化与真实 BFF 验收。无 UI / AI / Publish / 公开交付；未 push、未部署。NEXT：`CC-IMP-02` List, Workspace Shell & Overview — NOT AUTHORIZED。

**CC-IMP-02（2026-09-15）补充：** ✅ COMPLETED（LOCAL COMPLETE）——首个可见 Content Center UI：`/admin/content-center` 列表（搜索 / 过滤 / Create Draft）、Content Workspace Shell、`/admin/content-center/:id/overview`，Admin 导航入口启用。0 schema、0 AI、0 Publish、0 公开前台；未 push、未部署。NEXT：`CC-IMP-03` Content Editor — NOT AUTHORIZED。

**CC-IMP-03（2026-09-15）补充：** ✅ COMPLETED（LOCAL COMPLETE）——`/admin/content-center/:id/editor`：默认 locale 的 title / slug / summary 与 text / key points / FAQ / CTA 结构化 section 编辑，一次 Save 一个带 `expectedDraftRevision` 的 PATCH，409 冲突保留本地编辑，未保存离开保护。0 schema、0 media / relations、0 AI、0 Publish；未 push、未部署。NEXT：`CC-IMP-04` Media & Relations — NOT AUTHORIZED。

**CC-IMP-04（2026-09-15）补充：** ✅ COMPLETED（LOCAL COMPLETE）——`/admin/content-center/:id/media-relations`：hero / inline / download 经共享 Media Library 选择器引用（已归档文件在选择器与服务端双重拒绝），产品 / 内容关系只存 id，暂存 + 一次校验保存，`getFileReferences` 计入 Content Center 引用。0 schema、0 上传、0 SEO / AI / Publish；未 push、未部署。NEXT：`CC-IMP-05` SEO & Locales — NOT AUTHORIZED。

**CC-IMP-05（2026-09-15）补充：** ✅ COMPLETED（LOCAL COMPLETE）——`/admin/content-center/:id/seo-locales`：按语言编辑 slug / SEO title / meta description / canonical path / noindex（`expectedDraftRevision`），显式 Start locale 创建未翻译 Draft，Content Editor 支持 `?locale=`，首次发布后 slug 由服务端锁定，`og_image` 经共享 Media Library 选择器设置（hero 仅作预览回退），Draft-only 搜索 / 社交预览与无分数检查清单。0 schema、0 AI、0 翻译、0 Publish、0 公开前台；未 push、未部署。NEXT：`CC-IMP-06` Preview, Readiness & Publish — NOT AUTHORIZED。

**RELEASE-SAFETY-GATES-01（2026-09-15）补充：** ✅ COMPLETED——`docs/project/RELEASE-SAFETY-GATES.md` 生效：9 个 P0 Safety Gate（Draft 永不公开 · 单一公开资格合同 · 仅人工发布 · AI 只 Apply 到 Draft · 语言独立发布无回退 · 公开媒体须 is_public 且未归档 · 权限 fail closed · 本地 / Review / 生产分离 · local commit ≠ push ≠ merge ≠ deploy）、Safety Gate Matrix、Golden Path 与 Negative Path 合同；CLAUDE.md、执行协议 §12.1 与两个模板最小挂钩。CC-IMP-05 已由 Controller 签收（VISUALLY VERIFIED）。纯治理：0 runtime、0 DB、0 Directus；里程碑顺序不变。NEXT：`CC-IMP-06` Preview, Readiness & Publish — NOT AUTHORIZED（首个须按 Safety Gate 流程取证的模块）。

**CC-IMP-06（2026-09-15）补充：** ✅ COMPLETED（LOCAL COMPLETE）——`/admin/content-center/:id/preview-publish`：仅管理员可见的 Draft 预览（纯文本 block 渲染、noindex、无 canonical）、服务端确定性 hard / soft readiness（无分数 / 百分比）、按语言的人工 Publish / Unpublish（`expectedDraftRevision`、服务端重算 readiness、服务端 allowlist 快照、幂等与部分失败可重试）。所有内容类型仍 `publicEnabled=false`，正常 runtime 下 Publish 被阻止；正向生命周期由隔离 TEST ONLY 测试（含真实 PostgreSQL）证明。0 公开路由 / API / sitemap / AI / schema；未 push、未部署。NEXT：`CC-IMP-07` Archive, Restore & Change History — NOT AUTHORIZED。

**CC-IMP-07（2026-09-15）补充：** ✅ COMPLETED（LOCAL COMPLETE）——CC-IMP-06 已由 Controller 签收（VISUALLY VERIFIED）。`/admin/content-center/:id/history`：只读 Change History（Directus revisions + `last_change_kind`，无回滚）；同页人工、确认后的 Archive / Restore（服务端 lifecycle fingerprint；Archive 保留快照但不可读，Restore 回到 Draft 并清空全部语言快照、不发布、保留 `first_published_at`）；归档记录全部写入路径 fail closed；默认列表隐藏已归档条目（Blueprint §24）。0 删除 / 回滚 / AI / 公开交付 / schema；未 push、未部署。NEXT：`CC-IMP-08` Content AI Target & Source Intake — NOT AUTHORIZED。

**CC-IMP-08（2026-09-15）补充：** ✅ COMPLETED（LOCAL COMPLETE）——CC-IMP-07（含 Review Fix 02 / 03）已由 Controller 签收（VISUALLY VERIFIED）；前置窄修复 CC-IMP-04-R3 已完成。`/admin/content-center/:id/ai-source-intake`：只列出当前条目在 CC-03 已关联的 source_document / download / inline 文件（enabled、文件存在、未归档、共享格式合同可读；hero / og_image / 关联产品文件永不作为来源），选择仅在浏览器本地；一次显式 Analyze → 单一 Proposal Engine（通用 subject `content:<id>:<locale>`、`content-draft` Target、Content Attribution Guard、prompt contract v3）→ 一个内存 Proposal（绑定条目 / 语言 / draft revision / 来源指纹）。0 关联 / Draft / 关系 / 发布写入；无 Apply、无 Proposal Review；Product AI 回归兼容；真实 Provider 调用 0；未 push、未部署。NEXT：`CC-IMP-09` AI Proposal Review & Apply — NOT AUTHORIZED。

**CC-IMP-09（2026-09-15）补充：** ✅ COMPLETED（LOCAL COMPLETE）——CC-IMP-08 已由 Controller 签收（VISUALLY VERIFIED）。`/admin/content-center/:id/ai-proposal-review`：当前管理员对单一内容条目 + 精确语言的服务端 Proposal 逐项人工 Accept / Edit（仅值）/ Reject；冲突只能人工选择候选、编辑或拒绝，"Accept all safe" 不触碰冲突；Apply 只提交按 `proposalItemId` 的决定，target / operation / block 类型与顺序全部取自服务端 Proposal 与绑定（subject / locale / draft revision / lifecycle 标记）；一次 PATCH 写该语言 working copy（`draft_revision + 1`、`last_change_kind = ai_apply`、服务端生成新 block id），不写 status / 发布字段、不调用发布或生命周期处理器。过期 / 重启 / 已应用 / 跨条目 / 跨语言 / 跨管理员 / 过期 revision / 归档 / Restore 后全部 409 且 0 写入。真实 Provider 调用 0；未 push、未部署。NEXT：`CC-IMP-10` Public Delivery & Sitemap — NOT AUTHORIZED。

**CC-IMP-10（2026-09-15）补充：** ✅ COMPLETED（LOCAL COMPLETE）——前置 DIRECTUS-PERMISSIONS-PROVISIONING-01（D-034）已完成。D-035：Technical Article → `/resources/insights/[slug]`、Case Study → `/resources/case-studies/[slug]`，只读 Content Center 英文 `published_snapshot`，经单一资格合同与显式 allowlist DTO；News 详情 404、hub 无 News；Application / Resource / News 不公开；旧 posts 仅保留 Technical Guide / FAQ；noindex 仍可访问但不进 sitemap；sitemap 产品查询去除 `date_updated`、上游失败 503；媒体代理检查公开 + 未归档；related 只显示合格目标。真实人工 Publish → noindex → Archive → Restore → Unpublish Golden Path 已走通，TEST ONLY 夹具已恢复为 Draft。权限未扩大；未 push、未部署。NEXT：NONE — 等待 Controller。

---

## 总览

| 里程碑 | 名称 | 状态 | 关联 Phase |
|--------|------|------|-----------|
| M1 | Nuxt 框架 + 全站 Shell | ✅ 已完成 | Phase 1 |
| M2 | Directus CMS 基础 + 产品数据模型 | ✅ 已完成 | Phase 2–3 |
| M3 | 内容管理 + 询盘 + HubSpot + SEO | ✅ 已完成 | Phase 4–8 |
| **M4** | **Product CMS Admin + 产品详情页（Phase 9A）** | **🔨 Charter V1.1 生效（J-1.1 完成），J-2 待施工** | **Phase 9A-1 / 9A-2 / Charter J 节** |
| M4.5 | Admin CMS 母版对齐与结构施工（Charter J-2～J-6） | ⏳ J-1.1 完成，J-2 FD-001 视觉已确认，等 Codex 施工单 | Charter J-2 to J-6 |
| M5 | AI 产品资料导入助手（Charter J-6/J-7，Phase 9B） | 🔨 单产品 AI 工作流已交付（详见 CURRENT-STATE）；批量导入仍待单独授权 | Phase 9B |
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

内容运营中心：一个统一 Content Center，V1 内容类型为 Technical Article、Application / Solution、Case Study、Resource / Download、News（D-031）。

准入按能力型 Gate：Approved Visual → Module Freeze → Blueprint → 明确实施授权 → Draft / Public 安全 Gate → 生产发布 Gate。不以 M4 / M5 字面或真实产品试点作为规划与 Draft-only 建设的前提；真实产品试点与生产发布 Gate 只约束生产发布与公开暴露。本节编号仅为历史位置，不代表必须等 M4-Next-4 或 M5 全部完成。

```text
Content Center Visual Direction      ✅ APPROVED（2026-09-14）
→ CONTENT-CENTER-MODULE-FREEZE-01    ✅ COMPLETED（2026-09-14，模块拓扑 / 路由意图 / 写入边界已冻结）
→ CONTENT-CENTER-BLUEPRINT-01        ✅ COMPLETED（2026-09-14，D-032，docs/content-cms/CONTENT-CENTER-BLUEPRINT-V1.md）
→ CC-IMP-01 Content Foundation       ✅ COMPLETED（2026-09-14，LOCAL COMPLETE；本地开发库 schema，未 push / 未部署）
→ CC-IMP-02 List, Shell & Overview   ✅ COMPLETED（2026-09-15，LOCAL COMPLETE；首个可见 Content Center UI，未 push / 未部署）
→ CC-IMP-03 Content Editor           ✅ COMPLETED（2026-09-15，LOCAL COMPLETE；结构化 Draft 编辑 + 原子保存 + 冲突安全，未 push / 未部署）
→ CC-IMP-04 Media & Relations        ✅ COMPLETED（2026-09-15，LOCAL COMPLETE；Media Library 引用 + 产品 / 内容关系，未 push / 未部署）
→ CC-IMP-05 SEO & Locales            ✅ COMPLETED（2026-09-15，LOCAL COMPLETE · VISUALLY VERIFIED；按语言 SEO + 语言 Draft + slug 锁 + OG 图片，未 push / 未部署）
→ RELEASE-SAFETY-GATES-01            ✅ COMPLETED（2026-09-15，治理；P0 Safety Gates + Golden / Negative Path 合同，docs/project/RELEASE-SAFETY-GATES.md）
→ CC-IMP-06 Preview, Readiness & Publish  ✅ COMPLETED（2026-09-15，LOCAL COMPLETE；Admin Draft 预览 + 确定性 readiness + 人工 Publish / Unpublish；首个按 Safety Gate 取证的模块；0 公开交付，未 push / 未部署）
→ CC-IMP-07 Archive, Restore & Change History  ✅ COMPLETED（2026-09-15，LOCAL COMPLETE；人工 Archive / Restore + 只读 Change History（Directus revisions），无删除 / 回滚，未 push / 未部署）
→ CC-IMP-04-R3 Source Document Association  ✅ COMPLETED（2026-09-15，LOCAL COMPLETE；CC-IMP-08 前置窄修复：source_document 关联归 CC-03 Media & Relations，未 push / 未部署）
→ CC-IMP-08 Content AI Target & Source Intake  ✅ COMPLETED（2026-09-15，LOCAL COMPLETE；只读已关联来源 + 浏览器本地选择 + 单一 Proposal Engine 的 content-draft Target，一次 Analyze 一个内存 Proposal；0 关联 / Draft / 发布写入，无 Apply，真实 Provider 调用 0，未 push / 未部署）
→ CC-IMP-09 AI Proposal Review & Apply  ✅ COMPLETED（2026-09-15，LOCAL COMPLETE；人工 Accept / Edit / Reject + 冲突人工决定 + 按服务端 Proposal 绑定一次 PATCH 写入该语言 working Draft；无发布、真实 Provider 调用 0，未 push / 未部署）
→ DIRECTUS-PERMISSIONS-PROVISIONING-01  ✅ COMPLETED（2026-09-15，CC-IMP-10 prerequisite：已跟踪、幂等、fail-closed 的 nuxt-server Content 最小读取权限工件，D-034；公开策略 Content 权限 0；未 push / 未部署）
→ CC-IMP-10 Public Delivery & Sitemap V2  ✅ COMPLETED（2026-09-15，LOCAL COMPLETE；D-035：Technical Article / Case Study 仅英文、仅快照公开，News 等其他类型不公开，sitemap 去除 `date_updated` 并纳入合格内容，媒体代理归档检查；未 push / 未部署）
→ NEXT：NONE — 等待 Controller 审查（未授权任何后续模块）
```

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

### 当前 AI 主线（FD-004 生效后，2026-09-09）

当前唯一的 AI 施工主线固定为：

```text
AI Source Intake                      ✅ 已交付
→ Proposal Review                     ✅ 已交付
→ Apply accepted changes to Draft     ✅ 已交付（PWS-AI-APPLY-DRAFT-01 + R1 真实性收尾，2026-09-09）
→ First single-product AI beta        NEXT — requires separate user authorization
```

前三步均已交付并通过自动化与浏览器验收（详见 `CURRENT-STATE.md`）。第一个单产品 AI 闭环自此跑通：人工 Accept 的 Specifications 可写入同一产品 Draft，Draft-only、accepted-only、跨产品拒绝、部分失败如实上报。

**第四步 First single-product AI beta 尚未授权**：需要 Codex 单独发出施工单，且真实 API Key 与真实收费 provider 仍未获用户授权。

**在当前阶段，以下事项不作为 Apply-to-Draft 的默认前置 Gate**（依据 Charter FD-004.4，除非仓库事实证明其已直接触发某一项 P0）：

- Redis；
- distributed rate limiting；
- multi-instance quota；
- full PDF isolation；
- broad dependency hardening；
- future-scale infrastructure；
- 其他不触发 FD-004 P0 的 hardening。

这些进入后续 backlog / pre-launch hardening，**不因其未完成而阻塞当前闭环**。

**以下始终保留为硬边界，任何阶段都不放松：**

- no cross-product mixing（不跨产品混料）；
- no fabricated facts（不猜测技术参数）；
- human approval before write（写入前必须人工确认）；
- Draft only（只写草稿）；
- no auto publish（不自动发布）；
- no credential leakage（不泄露凭证）；
- no uncontrolled AI cost loop（无失控 AI 费用循环）。

### AI Document Source V1（2026-09-13 起）

用户确认的 V1 来源格式范围为 TXT / CSV / TSV / PDF / DOCX / XLSX / Images，全部接入同一个 Proposal Engine（一次 Analyze → 一次 provider 调用 → 一份 proposal）。每一步须单独授权；PDF 与 Image OCR 另需基础设施授权。统一合同见 `08-decision-log.md` D-024，事实状态见 `CURRENT-STATE.md`。

```text
AI-DOCUMENT-SOURCE-V1-PREFLIGHT      ✅ PASS WITH ARCHITECTURE DECISIONS
→ AI-SOURCE-CONTRACT-01              ✅ COMPLETED（统一格式合同；AI 可读仍仅 TXT / CSV / TSV）
→ PRODUCT-MODEL-RELEVANCE-GUARD-01   ✅ COMPLETED（当前产品型号归属保护；AI 可读仍仅 TXT / CSV / TSV）
→ AI-PDF-SOURCE-01                   ✅ COMPLETED（text-layer PDF 经隔离 document-extractor 读取；AI 可读 TXT / CSV / TSV / PDF；未部署）
→ AI-XLSX-SOURCE-01                  ✅ COMPLETED（.xlsx 经有界进程内 OOXML 流式读取 + 精确 product_code 预筛；AI 可读 TXT / CSV / TSV / PDF / XLSX；未部署）
→ AI-DOCX-SOURCE-01                  ✅ COMPLETED（.docx 经同一有界 OOXML 读取器与共享 Office gate 读取正文可见文字；不做型号预筛，归属由 D-025 判断；AI 可读 TXT / CSV / TSV / PDF / XLSX / DOCX；未部署）
→ AI-IMAGE-OCR-SOURCE-01             ✅ COMPLETED（JPG / PNG / WebP 经现有隔离 document-extractor 本地 libvips + Tesseract OCR 读取可见文字；非 Vision；低置信度 [?]；每次 Analyze 最多 3 张；AI 可读 TXT / CSV / TSV / PDF / XLSX / DOCX / JPG / PNG / WebP；未部署）
→ AI-DOCUMENT-MIXED-SOURCE-BETA-01   ✅ COMPLETED（新建 TEST ONLY Draft 产品 LT-180C-MIXED-BETA-01 上 TXT / PDF / XLSX / DOCX / PNG 五来源一次真实 DeepSeek Analyze；无跨型号 / 隐藏表 / UNKNOWN 泄漏；Power supply 冲突人工选 220 V, 50 Hz；Apply 一次写入 4 条，仍为 Draft；未部署）
→ AI-DOCUMENT-SOURCE-V1-FINAL        ✅ FEATURE COMPLETE / SIGNED OFF（TXT / CSV / TSV / PDF text-layer / XLSX / DOCX / JPG / PNG / WebP OCR；一个 Proposal Engine；Human Review 必需；原始二进制不发往 Provider；Production release gates remain open — 生产发布未批准，不代表网站可上线）
→ 后续主线转入 Content Center（M4-Next-5）：Module Freeze ✅ · Blueprint ✅ · CC-IMP-01 ✅ · CC-IMP-02 ✅ · CC-IMP-03 ✅ · CC-IMP-04 ✅ · CC-IMP-05 ✅ · RELEASE-SAFETY-GATES-01 ✅ · CC-IMP-06 ✅ · CC-IMP-07 ✅ · CC-IMP-08 ✅ · CC-IMP-09 ✅；CC-IMP-10 ✅（LOCAL COMPLETE，等待 Controller 审查）
```

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

*最后更新：2026-09-06，V-0.5.2 FD-002 视觉母版权威裁定完成写入。*

---

#### M4-Next-V0.5.2：FD-002 视觉母版权威裁定与证据闭环（2026-09-06）

**状态：完成。这是 J-2 Product Center Recovery 的 Definition of Ready 前置条件。仅修改 6 个治理文档，无业务代码变更。**

**⚠️ 本条不代表 J-2、J-3 或 AI 任何一项完成。** J-2 移动端 375px 仍为 FAILED，整体视觉验收仍为 SUSPENDED，`origin/master` 仍 BLOCKED。

**FD-002 已生效**（`ADMIN-CMS-GOVERNING-CHARTER-V1.md`，紧接 FD-001）。授权者为用户，状态 Effective，细化 FD-001 而不撤销它。只解决五件事：视觉文件权威、English-first、右侧 Product Control、移动端适配、命名空间。**不授权 AI、批量导入、真实数据写入、发布或 master 推送。**

**CF-1 ～ CF-5 全部关闭：**

| # | 裁定 |
|---|------|
| CF-1 | 两套命名空间：工程模块 ID（`PC-01` `PC-02` `PW-00`～`PW-06` `AI-01` `IMP-01`）+ Source Asset ID（`VM1-*` / `P2-*`）。裸 `ADM-xx` 不得指挥代码。Gate 前缀固定为 `CH-DG-xx` / `BP-DG-xx`，无 Gate 被重新编号 |
| CF-2 | P2 保留为用户确认的视觉方向参考；其 README 的「非独立代码规格」规则继续有效，不得单独决定路由/数据/API/权限/交互/移动端 |
| CF-3 | `PC-01` + `PC-02` 采用 375px 卡片列表原则；`PW-01`～`PW-06` 移动端在各自适配合同获授权前一律阻塞 |
| CF-4 | English-first 高于母版中文；母版中文仅作信息层级与布局参考 |
| CF-5 | J-2 右侧采用 Product Control；AI 批处理入口延后至 `IMP-01`，现在不得实现、不得伪造可用状态、不得展示假数据 |

**Master Authority Matrix（12 项）：** `VM1-ADM02-D1440` 与 `VM1-ADM02-M375` 为 `PC-01` 的 **PRIMARY**（后者同时覆盖 `PC-02` 的 375px）；八张 P2 图为对应 `PC-02` / `PW-01`～`PW-06` 的 **SUPPLEMENTARY**；`VM1-LOGIC01` / `VM1-LOGIC02` 为 `AI-01` / `IMP-01` 的 **FUTURE-REFERENCE**，不构成任何开工授权。截图仅为验收证据，仓库/Directus 仅证明存在性，均非设计来源。

**English-first 台账重建：** 逐行登记并六类分类。硬编码用户可见中文 **246 处 / 11 个文件**（UI 207 + PLACEHOLDER 11 + OPTION 28），另有 ARIA 6、COMMENT 26，`DATA` 类 0，匹配源码行合计 **278**。V-0.5.1 的"约 249 / 9 个文件"估算作废。零可见中文的合规文件 10 个。**本次只登记，未翻译。**

**11 个工程模块完整事实表（每模块 18 字段；此前误写"十模块"，本次更正）：**

| 模块 | Implementation | DoR |
|---|---|---|
| `PC-01` | `AUTOMATED_CHECKED` | **MET** — 可发 J-2 recovery 施工单 |
| `PC-02` | `AUTOMATED_CHECKED` | PARTIAL — 布局可改，健康度值仍被 `CH-DG-10` 阻塞 |
| `PW-00` | `NOT_STARTED` | **NOT MET** — 门禁前提，无 PRIMARY 资源定义 |
| `PW-01` `PW-02` `PW-03` `PW-05` | `LEGACY` | NOT MET |
| `PW-04` | `NOT_STARTED` | NOT MET |
| `PW-06` | `IN_DISCOVERY` | NOT MET |
| `AI-01` `IMP-01` | `NOT_STARTED` | NOT MET |

**下一步：等待 Codex 的 J-2 Product Center Recovery 单一完整施工单。**

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

---

#### M4-Next-V0.5.2B：FD-003、Checkpoint 统一与 J-2 Recovery DoR 精度收口 ✅（完成，本次）

**状态：治理精度收口完成。仅修改 6 个治理文档；无业务代码、测试、schema、Directus、权限、数据、媒体改动。**

**完成内容：**

1. **FD-003 登记**：`ADMIN-CMS-GOVERNING-CHARTER-V1.md` 新增 Framework Decision FD-003 — Context-Efficient Execution，紧接 FD-002 后；设立 Tier A/B/C 三层阅读规则，只降低重复阅读成本，不降低任何 Gate/母版/数据合同/验收标准的适用范围。
2. **CLAUDE.md**：新增 FD-003 阅读层级章节；开工报告模板新增 `Reading tier (FD-003)` 必填首行。
3. **Blueprint**：§2 后新增一句交叉引用——FD-003 仅优化阅读效率，不得跳过模块依赖、母版、数据/API 合同、Gate 或验收，不改变模块顺序或 AI/Import 边界。
4. **Checkpoint 唯一性核实**：`origin/backup/admin-cms-j2 = ed952d2`（与 HEAD 相同）；`origin/backup/j2` 在远端不存在（MISSING，非删除）。确认唯一有效 checkpoint 为 `origin/backup/admin-cms-j2`。
5. **"十个工程模块" → "11 个工程模块" 修正**：Register §12.1i、CURRENT-STATE.md 第 6 节、本文件（当前位置段落 + 十模块表标题）三处更正，模块清单与既有事实内容不变。
6. **J-2 Recovery DoR 精度收口**：Register 新增「J-2 Recovery DoR — precise scope」小节 + PC-01/PC-02 证据表；CURRENT-STATE.md 第 9 节与本文件"下一步"段落同步改写为精确表述——`J-2 Recovery DoR` 仅代表 PC-01/PC-02 可开始受限修复，不代表 J-2 完成/验收通过/可推送 master。裸 `(DG-10)` 历史代码标记本次不改，新文档一律用 `CH-DG-10`。

**验证：** 本任务不涉及业务代码，故不运行 build/lint/typecheck/测试；仅 `git diff --check` 用于确认暂存内容无 whitespace 错误。

**明确未触碰：** 任何业务代码、Vue、TypeScript、CSS、server API、tests、types、Directus schema、角色、权限、数据、媒体、来源记录、Docker、`.env`；`ed952d2` 未被回滚/amend/rebase/squash/重写；四项保护资料全程 `??`。

**下一步：等待 Codex 的 J-2 Product Center Recovery 单一完整施工单。**

---

#### M4-Next-V0.6：J-2 Recovery 结构性缺陷收口 ✅（完成，本次，2026-09-07）

**背景：** J-2 Recovery 施工单落地后，浏览器验收发现三条彼此独立的技术性缺陷，经过三轮只读诊断（`ADM-COMP-AUD-01`、`J2-CATEGORY-ROUTE-DIAG-01`）逐一定位根因后，本次一次性修复并收口。

**完成内容：**

1. **组件别名修复**：`pages/admin/products/index.vue`、`pages/admin/products/categories/index.vue`、`pages/admin/products/categories/[id].vue`、`components/admin/product/ProductCardList.vue`、`components/admin/product/ProductControlPanel.vue` 共 17 处 `Admin*` 前缀标签改为 Nuxt 实际注册的裸组件名；未改 `nuxt.config.ts`。
2. **分类路由拓扑修复**：`pages/admin/products/categories.vue` 非暂存移动为 `pages/admin/products/categories/index.vue`，解除与 `categories/[id].vue` 的父子嵌套关系，两条路由改为独立平级路由；已用生成的 `virtual:nuxt:.nuxt/routes.mjs` 路由表核实修复前后差异；未新增 `<NuxtPage/>`，未改动 Product Center 布局。
3. **测试断言修正**：`tests/productCentreView.test.ts` 3 条断言更新为正确组件名与新文件路径。
4. **临时配置清理**：`.claude/launch.json` 中本次诊断期间新增的临时 `"LITUBO dev j2"`（3100 端口）配置块已移除，文件与 HEAD 逐字一致。

**验证结果（2026-09-07）：**

- `npx vitest run`：280/280 通过
- `npx vue-tsc --noEmit`：0 errors
- `npm run lint`：0 errors
- `npx nuxt build`：Build complete
- `git diff --check`：0 错误
- 登录态浏览器验收：`/admin/products`、`/admin/products/categories`、`/admin/products/categories/1`（无关联产品）、`/admin/products/categories/2`（1 个关联产品）在 1440px 与 375px 下均无水平溢出，组件渲染真实数据，路由拓扑已用生成路由表核实

**明确边界：** 不构成 Codex/用户对 `VM1-ADM02-D1440`/`VM1-ADM02-M375` 的像素级视觉签收；`origin/master` 提升仍 BLOCKED；未触碰 Product Workspace、AI-01、IMP-01；四项保护资料与 PW child blueprint 全程未触碰。

**下一步：等待 Codex 安排 J-2 像素级视觉签收，或发出下一份完整施工单。**

---

#### M4-Next-PW-GOV-01：Product Workspace 治理基线与视觉母版冻结登记 ✅（完成，本次，2026-09-07）

**完成内容：**

1. **11 张桌面视觉母版已冻结**：`docs/design-reference/approved/admin-cms-product-workspace-v1/LITUBO-Product-Workspace-Visual-Masters-V1/` 下全部 11 个文件（`PW-VIS-01`～`09`、`PW-AI-01`/`02`）逐一登记为 Register §4.5 的 `PRIMARY`（仅桌面 1440px）资源，映射至新的 `PWS-*` 工程模块 ID（Register §4.6）；无任何 375px 母版，每个未来 `PWS-*` 代码施工单须独立提供移动端合同。
2. **PWS 工程模块命名空间已确立**：`PWS-00`（Shell + Overview）～`PWS-08`（Change History）+ `PWS-AI-01`/`PWS-AI-02`，消除既有 Blueprint `PW-00`～`PW-06` 与 child blueprint 自身 `PW-00`～`PW-07`+`AI-01` 两套编号的碰撞；纯命名裁定，不代表任何模块已实施。
3. **child blueprint 状态升级**为 `Approved governance baseline — controlled implementation remains gated`，新增 §17 记录上位文档从属、新旧路由并存（新 Workspace 预留 `/admin/product-workspace/:id/...`，旧编辑器保留 `/admin/products/:id/...`，共用 `product_id`，只记录决策不建路由）、单产品 AI Draft 原则、Media Library 唯一物理来源原则、`PWS-00` 尚未获代码授权的书面边界。
4. **Implementation Blueprint 新增 §6.3**：PWS 命名空间与既有 Gate 对应关系交叉引用；未改动 §6.1/§11/§12 既有内容。
5. **只修改 5 个治理文档**（Blueprint、Register、child blueprint、CURRENT-STATE.md、本文件）；未写任何 Workspace 代码、路由、schema、API、产品/分类/媒体/AI 数据；未修改任何 PNG 或 README；未触碰 Charter、CLAUDE.md。

**明确边界：** `PWS-00` 完整度 Gate（`CH-DG-11`/`BP-DG-02`）与 375px 合同（CF-3）仍未解除，`PWS-00` 代码仍未授权、仍未开始；J-2 像素级视觉签收与 `origin/master` 锁定不受影响，维持原状；`AI-01`/`IMP-01` 均未开始。

**下一步：等待 Codex 就 `PWS-00`（Workspace shell + Overview）单独发出完整施工单，满足其 Definition of Ready 后方可开始设计/施工审查。**

---

#### M4-Next-PWS-DOR-02：PWS-00 Workspace Shell + Overview 合同冻结 ✅（完成，本次，2026-09-07）

**完成内容：**

1. `PWS-00` 只读 Shell + Overview 书面合同已冻结：登记于 Register `PW-00` 段落新增小节 + child blueprint 新增 §18。
2. 首版定位、路由并存、旧编辑器唯一写入口、真实数据范围、Media Library 原则、AI 不显示、Tasks/Assigned language 不显示、Readiness 空态与 Gate 区分、按钮状态、375px accordion 合同、未来 `PWS-00A` 候选/禁止文件范围，均已写入。
3. **只修改 4 个治理文档**（Register、child blueprint、CURRENT-STATE.md、本文件）；Implementation Blueprint 未改动（其 PWS 命名空间/路由/从属关系已在 PW-GOV-01 的 §6.3 完成登记）；未写任何 Workspace 代码、路由、schema、API、产品/分类/媒体/AI 数据；未打开或修改任何 PNG 或 README；未触碰 Charter、CLAUDE.md、旧编辑器代码。

**明确边界：** `CH-DG-11`、`BP-DG-02`、`BP-DG-10` 仍未解决；`CF-3` 只对 `PWS-00` 书面合同满足，`PWS-01`～`PWS-08`/AI 模块的 375px Gate 未解除；`PWS-00` 代码仍未授权、仍未开始；J-2 像素级视觉签收与 `origin/master` 锁定维持原状。

**下一步：等待 Codex 审查并单独发出 `PWS-00A` 代码施工单，满足 `PW-00` Definition of Ready 后方可开始。**
