# LITUBO Admin/CMS 施工总纲 V1
# Governing Architecture Charter V1

**建立日期：** 2026-09-06  
**状态：** 生效中（Active）  
**负责人：** 用户（业务决策）/ Codex/GPT（架构与施工单）/ Claude Code（唯一执行者）

---

## A. 宪法级定位与生效规则

### A.1 本文件的性质

本文件是 LITUBO Admin/CMS 当前有效的架构与施工总纲。

**它不授权任何代码、数据、schema、AI、发布或部署操作；它只定义后续施工的方向、边界、优先级、验收和变更规则。**

本文件一旦生效，成为所有 Admin/CMS 施工的上位约束。除非用户明确宣布以下任意一句话：

```text
"框架变更"
"替换原框架"
"修订 Governing Charter"
```

否则，任何普通需求、代码任务、文案任务、视觉任务，都不得改变本总纲定义的方向、优先级、架构边界或母版来源。

### A.2 三方职责

| 角色 | 职责 | 不可自行决定或执行 |
|------|------|------------------|
| **用户** | 业务方向、真实资料确认、视觉母版确认、发布决定、框架变更决策 | 不需判断代码实现细节 |
| **Codex/GPT** | 总体架构、施工单撰写、风险审查、验收与里程碑管理 | 不直接改代码、数据库、生产环境；不代替用户确认业务事实 |
| **Claude Code** | 唯一代码/文档执行者，只在明确施工单范围内修改 `D:\LITUBO-website` | 不改业务规则、不扩展范围、不处理凭证、不 push 或部署 |

### A.3 单执行者规则

Codex/GPT 与 Claude 不得同时修改同一工作树。**Claude Code 是当前唯一实际修改 `D:\LITUBO-website` 的执行者。**

---

## B. 框架锁定与变更协议

### B.1 普通施工不得改变框架方向

若用户没有明确宣布"框架变更 / 替换框架 / 修订 Governing Charter"，不得以普通任务、局部截图、单个页面、文案优化或临时技术便利为理由改变架构方向。

### B.2 变更协议（五步流程）

如需框架变更，必须严格按以下顺序执行：

```text
1. 先做只读影响审计（不改任何代码）；
2. 写出新版本或修订版 Charter；
3. 明确列出被替换的章节、迁移影响和保留内容；
4. 获得用户明确确认；
5. 才能开始改变施工方向。
```

---

## C. 证据与方向优先级

### C.1 事实真相优先级（从高到低）

```text
1. 实际仓库代码 / Git 状态 / Directus schema / 运行服务
2. docs/project/CURRENT-STATE.md
3. docs/project/MASTER-ROADMAP.md 与 CLAUDE.md
4. 系统蓝图、治理文档、施工包（CMS-AI-CONSTRUCTION-PACK-V1）
5. 已确认视觉母版（状态为 CONFIRMED 的图）
6. 历史聊天记录与旧报告
```

### C.2 施工方向优先级（从高到低）

```text
1. 用户明确的框架变更指令
2. 本 Governing Charter
3. 已确认 Construction Pack 与视觉/逻辑母版（CONFIRMED 状态）
4. 单次 Claude 施工单
5. 旧报告、临时推测
```

### C.3 冲突处理规则

出现以下任一情况，Claude 必须**停止施工并报告**，不得猜测、静默改方向、自行选一套资料：

- 资料之间出现相互矛盾；
- 视觉状态不是 `CONFIRMED`（仅 `DRAFT` / `REVIEW` / `SUPERSEDED`）；
- 代码与总纲定义不一致；
- 资料缺失导致无法确定施工边界；
- AI / Import 功能被错误描述为"已完成"。

**严格禁止：** 把文案翻译误报为视觉母版落地；把全局 Media Library 当作产品专属 Media & Resources；把尚未实现的 AI / Import 功能说成已完成。

---

## D. 母版登记与追溯表

> 不得复制图片；只引用原始路径。视觉状态不是 `CONFIRMED` 时，对应代码施工不得开始。

| 类型 | 精确路径 | 负责范围 | 当前状态 | 后续施工引用规则 |
|------|---------|---------|---------|----------------|
| Construction Pack | `docs/product-cms/CMS-AI-CONSTRUCTION-PACK-V1/` | 业务逻辑、数据治理、施工顺序、安全边界 | 已安装，仓库事实优先 | 每次施工前必读对应章节 |
| Visual Index | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/README_VISUAL_INDEX.md` | 所有 Admin 页面视觉的唯一登记入口 | 生效中 | 新图必须先在此登记 |
| ADM-02（Product Center 全部产品） | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-02__product-center__all-products__desktop-reference__v01.png` | Product Center 主列表页 | **DRAFT — 不可开始正式代码施工** | 用户确认为 CONFIRMED 后方可施工 |
| ADM-02a（Product Center 分类视图） | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-02a__product-center__category-list__desktop-reference__v01.png` | Product Center 分类过滤视图 | **DRAFT — 不可开始正式代码施工** | 同上 |
| ADM-03（规格工作台） | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-03__product-workspace__specifications__desktop-reference__v01.png` | Product Workspace — 规格 | **DRAFT** | 同上 |
| ADM-04（媒体与资源） | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-04__product-workspace__media-resources__desktop-reference__v01.png` | Product Workspace — 媒体 | **DRAFT** | 同上 |
| ADM-05（页面内容） | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-05__product-workspace__page-content__desktop-reference__v01.png` | Product Workspace — 内容 | **DRAFT** | 同上 |
| ADM-06（关联） | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-06__product-workspace__relations__desktop-reference__v01.png` | Product Workspace — 关联 | **DRAFT** | 同上 |
| ADM-07（SEO 与多语言） | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-07__product-workspace__seo-locales__desktop-reference__v01.png` | Product Workspace — SEO | **DRAFT** | 同上 |
| ADM-08（来源与历史） | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-08__product-workspace__sources-history__desktop-reference__v01.png` | Product Workspace — 来源与审计 | **DRAFT** | 同上 |
| 逻辑参考图 01 | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/logic-references/01_single_product_dossier_workbench.png` | 单品号 Dossier 工作台逻辑与层级 | **DRAFT（流程参考）** | 逻辑参考使用；正式施工仍须 CONFIRMED 桌面图 |
| 逻辑参考图 02 | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/logic-references/02_multi_model_import_ai_review_queue.png` | 多品号导入与逐项审核队列逻辑 | **DRAFT（流程参考）** | 同上 |
| CURRENT-STATE evidence | `docs/project/CURRENT-STATE.md` | 已实施事实的唯一记录 | 持续更新 | 每次施工前必读 |

---

## E. 目标系统架构与前后端联动

### E.1 技术栈（锁定）

```text
Nuxt 3 + Vue 3 + TypeScript + Vite + Nitro（SSR/hybrid）
  → Nuxt Server /api/admin/* — 受控 BFF / Adapter 层，唯一权限、状态机、AI 编排、导入门禁
  → Directus 11 + PostgreSQL 16 — CMS 数据、媒体、权限、Revision 底座
  → Nuxt Public Frontend — 仅通过受控 Server 层读取已发布内容
  → Docker Compose + Nginx — 本地与生产部署基础
  → Cloudflare Free — DNS、TLS、缓存、基础防护（不是第二个应用服务器）
```

### E.2 核心边界规则

- 公开前台不能直接自由写 CMS；
- 浏览器不能直接获得通用 Directus 写权限；
- Admin API 保持认证（httpOnly cookie）、角色、CSRF 与服务端校验；
- Directus 是媒体与结构化数据底座；
- 全局 Media Library 保存可复用资产（UUID 引用）；
- 产品只保存资产引用、角色、顺序、上下文 ALT/Caption，不复制正式文件；
- Sources（来源记录）、媒体、产品、审核、发布各有独立职责；
- 不因视觉重构而绕开既有认证、权限、发布边界。

### E.3 系统关系图（文字版）

```text
访客 → Nuxt 公开前台 → Nitro 服务层 → Directus CMS + Media Library → PostgreSQL
管理员 → Nuxt Admin 后台 → Nitro 服务层（/api/admin/*）
Nitro 服务层 → AI 编排与任务 Worker（待实现，须单独授权）
Nitro 服务层 → 表单 / HubSpot 适配层
```

---

## F. Admin 信息架构与页面合同

### F.1 当前已实现页面清单（如实记录，不夸大）

| 路由 | 页面文件 | 当前实现状态 | 是否符合 ADM 目标 |
|------|---------|------------|-----------------|
| `/admin/login` | `pages/admin/login.vue` | 认证登录，JWT cookie，SSR 302 保护 | 满足需求 |
| `/admin/` | `pages/admin/index.vue` | 跳转或简单 Dashboard | 基础，待扩展 |
| `/admin/products` | `pages/admin/products/index.vue` | 简单 Tab + 表格（All/Draft/In Review/Published/Archived）；无缩略图、无 Readiness、无分类侧栏、无 Product Control 面板 | **与 ADM-02 有显著差距** |
| `/admin/products/new` | `pages/admin/products/new.vue` | ProductBasicForm（产品创建表单） | 基础功能存在，非 Dossier 结构 |
| `/admin/products/[id]` | `pages/admin/products/[id]/index.vue` | 基础信息编辑（name/slug/category/product_code 等） | 部分功能，非完整 Dossier Shell |
| `/admin/products/[id]/specs` | `pages/admin/products/[id]/specs.vue` | 规格组与规格项 CRUD | 有基础实现；与 ADM-03 视觉有差距 |
| `/admin/products/[id]/content` | `pages/admin/products/[id]/content.vue` | 页面内容 Sections 编辑 | 有基础实现；与 ADM-05 视觉有差距 |
| `/admin/products/[id]/media` | `pages/admin/products/[id]/media.vue` | 产品媒体关联（从 Media Library 选择） | 有基础实现；与 ADM-04 视觉有差距 |
| `/admin/products/[id]/faq` | `pages/admin/products/[id]/faq.vue` | FAQ CRUD | 有基础实现 |
| `/admin/products/[id]/seo` | `pages/admin/products/[id]/seo.vue` | SEO 字段编辑 | 有基础实现；与 ADM-07 有差距 |
| `/admin/products/[id]/preview` | `pages/admin/products/[id]/preview.vue` | 产品预览 | 有基础实现 |
| `/admin/media` | `pages/admin/media/index.vue` | 全局 Media Library（上传/归档/恢复/引用检查/文件夹管理） | **Media Library 基础已实现**；与 ADM-12 视觉差距待审计 |
| `/admin/settings` | `pages/admin/settings.vue` | 网站设置（联系信息、社交链接、安全面板） | 基础已实现 |

### F.2 尚未实现的页面（均须按 ADM 目标施工）

| ADM ID | 页面 | 状态 |
|--------|------|------|
| ADM-02（重构） | Product Center — 全部产品（含缩略图、Readiness、Product Control 面板、分类侧栏） | 未按母版实现 |
| ADM-02a（新增） | Product Center — 分类视图 | 未实现 |
| Product Workspace Shell | 统一 Dossier Shell（顶部面包屑/状态/操作栏 + 标签导航） | 未实现；当前子页面是独立路由而非统一 Shell |
| ADM-08 | Sources & History（来源证据面板 + 审核历史） | 未实现 |
| ADM-09–11 | Import Center（多型号工作簿导入 + 映射 + 逐项队列） | 未实现 |
| ADM-12（视觉对齐） | 全局 Media Library 视觉优化（功能已实现，与 ADM-12 目标视觉待对比） | 功能存在，视觉未验收 |
| ADM-13 | 媒体详情与全局引用 | 未实现（目前在媒体列表侧面板处理） |
| ADM-14–15 | AI 指挥台 + AI 单次任务详情 | 未实现 |
| ADM-16–17 | 询盘列表 + 技术匹配详情 | 未实现 |
| ADM-18–19 | 设置 — Schema/词典/Profile + 角色/语言/AI Policy | 未实现 |

### F.3 每页合同（当前需施工的优先页面）

#### Global Admin Shell（`layouts/admin.vue`）

- **用户目标：** 统一导航、用户信息、移动端汉堡菜单
- **对应母版：** ADM-02 左侧栏结构（DRAFT，已作参考；最终须 CONFIRMED 图）
- **当前代码状态：** 已有固定左侧栏（Product Center、Content Center disabled、Media Library、Settings）；移动端抽屉已实现；`Sign out` 按钮已英文化
- **决策：** 保留并按 ADM-02 CONFIRMED 后对齐；不因重构破坏认证和 SSR 保护
- **不可触碰：** httpOnly cookie 认证机制、SSR 302 重定向、Admin Auth 中间件

#### Product Center — ADM-02（`pages/admin/products/index.vue`）

- **用户目标：** 全局产品列表；筛选分类/状态/完整度；快速查看产品摘要；Product Control 侧面板
- **对应母版：** `ADM-02` 参考图（**DRAFT，不可开始正式施工**）
- **当前代码状态：** 简单 Tab 过滤 + 表格；无缩略图、无 Readiness 进度条、无 Product Control 面板、无分类侧栏
- **决策：** 重构为按 ADM-02 CONFIRMED 目标实现；先不改，等视觉确认
- **后端 API：** `GET /api/admin/products`（已有）；需扩展以支持分类过滤、完整度字段
- **验收条件：** ADM-02 视觉母版获得用户 CONFIRMED 确认后，1440px + 375px 全通过

#### Product Category View — ADM-02a

- **用户目标：** 查看单一分类内所有产品；分类健康度摘要；分类层级导航
- **对应母版：** `ADM-02a` 参考图（**DRAFT，不可开始正式施工**）
- **当前代码状态：** 未实现
- **决策：** 新增；等 ADM-02a CONFIRMED 后施工

#### Product Workspace Shell / Product Control

- **用户目标：** 单一产品的统一工作台入口；顶部显示产品名、product_code、当前状态、发布操作；左侧或顶部标签导航至各子区域
- **对应母版：** 逻辑参考图 01（DRAFT 流程参考）；正式施工须 ADM-03～08 CONFIRMED 图
- **当前代码状态：** 各子页面独立存在（`/[id]/specs`、`/[id]/content` 等），无统一 Dossier Shell；`ProductBasicForm` 存在，作为 Basic Info 编辑器
- **决策：** 新增 Product Workspace Shell 作为共用框架；原各子页面内容迁入 Shell 标签页
- **不可触碰：** product_code 一旦设置不可修改的业务规则；发布状态机 `draft → review → published → archived`

#### Specifications — ADM-03

- **对应母版：** `ADM-03` 参考图（DRAFT）
- **当前代码状态：** `pages/admin/products/[id]/specs.vue` — 规格组/项 CRUD 已有基础实现
- **决策：** 保留数据层（API 和 schema 不变）；等 ADM-03 CONFIRMED 后重构 UI 进入 Workspace Shell

#### Product Media & Resources — ADM-04

- **对应母版：** `ADM-04` 参考图（DRAFT）
- **当前代码状态：** `pages/admin/products/[id]/media.vue` — 产品媒体关联已有基础实现；从全局 Media Library 选择文件
- **决策：** 保留数据层；等 ADM-04 CONFIRMED 后重构 UI；**全局 Media Library ≠ 产品专属 Media & Resources**，两者明确分离

#### Page Content — ADM-05

- **对应母版：** `ADM-05` 参考图（DRAFT）
- **当前代码状态：** `pages/admin/products/[id]/content.vue` — Section 编辑基础已有
- **决策：** 保留数据层；等 ADM-05 CONFIRMED 后重构 UI

#### Relations — ADM-06

- **对应母版：** `ADM-06` 参考图（DRAFT）
- **当前代码状态：** 未实现独立关联管理页面
- **决策：** 新增；等 ADM-06 CONFIRMED 后施工

#### SEO & Locales — ADM-07

- **对应母版：** `ADM-07` 参考图（DRAFT）
- **当前代码状态：** `pages/admin/products/[id]/seo.vue` — SEO 基础字段已有
- **决策：** 保留数据层；等 ADM-07 CONFIRMED 后重构 UI 并增加 Locale 管理

#### Sources & History — ADM-08

- **对应母版：** `ADM-08` 参考图（DRAFT）
- **当前代码状态：** `product_source_records` 表已存在，API 已有（GET/POST/archive）；无前端管理界面
- **决策：** 新增前端界面；等 ADM-08 CONFIRMED 后施工

#### Global Media Library（独立，不等同 ADM-04）

- **对应母版：** ADM-12（DRAFT）
- **当前代码状态：** `pages/admin/media/index.vue` — **已实现完整基础功能**（上传/归档/恢复/引用检查/Folder Registry/文件夹管理/批量移动）；UI 已英文化
- **决策：** 保留，等 ADM-12 CONFIRMED 后做视觉对齐优化

#### Content Center / Settings

- **Content Center：** 规划中，当前侧边栏禁用；等 M5 后排期
- **Settings：** `pages/admin/settings.vue` — 基础已实现；等 ADM-18/19 CONFIRMED 后扩展

---

## G. 数据、状态、发布与人工控制合同

### G.1 产品生命周期（固定，不可变更）

```text
draft → review → published → archived
```

- `published` 是唯一进入公开 API、前台详情页、sitemap 的状态；
- 发布 / 撤回必须经过管理员与服务端控制；
- Draft、AI 建议、私有来源资料绝不进入公开路由或搜索引擎；
- 已发布内容的实质修改必须创建新 Revision Draft，线上保留旧版本直至新版审核通过；
- 真实产品、媒体、来源资料不因测试或视觉开发被修改；
- **ID=3 TEST ONLY Draft 不得被当成真实产品或发布**。

### G.2 目标数据关系

```text
Product（product_code 唯一）
  ↔ Product Category
  ↔ Product Revision（draft/review/published/archived）
       ↔ Product Media / Resource References（products_files，UUID 引用）
       ↔ Product Source Records / Evidence（product_source_records）
       ↔ Product Page Modules（product_sections + items）
       ↔ Product Specifications（product_spec_groups + items）
       ↔ Product FAQ（product_faqs）
       ↔ Product SEO Fields
       ↔ Review / Audit History（待实现）
```

**待审计 / Decision Gate（以下关系尚未确认，施工前须先与用户确认）：**
- Product Family（系列分组）的具体 schema 字段与 CONFIRMED 状态
- Relations（关联产品 / 应用场景）的完整数据模型
- Source Snapshot 的冻结机制（目前 `product_source_records` 存在但无 snapshot 版本）
- Revision 版本历史（目前产品无 `revision_no` / `superseded_by` 字段）

### G.3 已有 API 范围（如实记录）

```text
POST   /api/admin/auth/login
POST   /api/admin/auth/refresh
POST   /api/admin/auth/logout
GET    /api/admin/auth/me
GET    /api/admin/products
POST   /api/admin/products
GET    /api/admin/products/[id]
PATCH  /api/admin/products/[id]
GET    /api/admin/products/[id]/sections
POST   /api/admin/products/[id]/sections
PATCH  /api/admin/products/[id]/sections/[sid]
DELETE /api/admin/products/[id]/sections/[sid]
GET    /api/admin/products/[id]/specs
POST   /api/admin/products/[id]/specs
...（完整清单见 server/api/admin/products/）
GET    /api/admin/products/[id]/sources
POST   /api/admin/products/[id]/sources
POST   /api/admin/products/[id]/sources/[sourceId]/archive
GET    /api/admin/media
POST   /api/admin/media/upload
PATCH  /api/admin/media/[fileId]
POST   /api/admin/media/[fileId]/archive
POST   /api/admin/media/[fileId]/restore
GET    /api/admin/media/[fileId]/references
POST   /api/admin/media/batch-move
GET    /api/admin/settings
PATCH  /api/admin/settings
```

---

## H. AI 与导入治理合同

### H.1 当前状态（如实记录）

**当前未接入任何 AI 功能。不得把任何 AI 流程表述为"已完成"。**

### H.2 未来单品号 Dossier AI 规则

以下规则在 AI 功能施工时必须严格遵守（当前均为待实现）：

```text
一项 AI 任务 = 一个 product_code + 一个 Product Draft + 一个冻结的 Source Snapshot；
AI 只能读取已关联的资料（来源 UUID、页码/Sheet 范围）；
AI 只生成带来源的建议版本（Candidate/Suggestion）；
已人工确认的字段不可被 AI 覆盖；
人工可选择：接受 / 编辑后接受 / 退回拒绝；
AI 不可自动发布、删除或移动正式媒体；
所有写入必须经服务端规则和人工确认。
```

### H.3 未来多品号导入规则

```text
工作簿上传 → 字段映射 → 校验预览 → 仅创建多个 Draft
  → 每个 product_code 独立 AI 任务与上下文（队列逐个处理）
  → 人工审核 → 进入单品号工作台。

禁止批量发布；
禁止不同型号混合 AI 上下文；
工作簿导入最多只能创建 Draft，不能创建 Published。
```

### H.4 AI 接入前置条件（Decision Gate）

以下所有条件满足前，不得开始 AI 相关代码施工：
1. Media Library 引用保护机制已完整验收；
2. 管理员权限与角色体系已完整定义并经用户确认；
3. Source Snapshot 冻结机制已实现；
4. 人工审核链路（接受/拒绝/锁定字段）已实现；
5. 模型供应商、费用预算、数据出境范围已由用户明确确认（须单独授权）。

---

## I. 保留 / 重构 / 新增决策表

| 分类 | 当前内容 | 决策 | 不可破坏的边界 |
|------|---------|------|--------------|
| **保留** | Nuxt 3 + Directus + PostgreSQL 技术栈 | 不因 UI 改造替换 | — |
| **保留** | Admin Auth（httpOnly cookie、SSR 302、auto-refresh） | 不因视觉重构绕开 | admin-auth 中间件覆盖范围不得缩小 |
| **保留** | 产品生命周期 `draft → review → published → archived` | 唯一状态机，不得添加平行状态 | — |
| **保留** | `product_code`（UNIQUE，设置后不可修改，状态门控） | 产品身份主键 | 不允许 AI 或导入猜测 product_code |
| **保留** | 媒体治理（Folder Registry、引用保护、archive/restore） | 作为后续底座 | 不物理删除有引用的媒体 |
| **保留** | 所有现有 server/api/admin/* 端点与测试 | 重构 UI 不改 API 签名 | — |
| **保留** | `product_source_records`（audit trail，无物理删除） | 来源证据基础 | nuxt-server 角色不得有此表权限 |
| **保留并重新定位** | `ProductBasicForm.vue` | 未来作为 Workspace Shell Overview 的一部分 | 不单独废弃，迁入 Shell |
| **重构** | `pages/admin/products/index.vue`（Product Center 主列表） | 按 ADM-02 CONFIRMED 后重构 | 等视觉确认；不改 API |
| **新增** | Product Workspace Shell（Dossier 共用框架） | ADM-03～08 的统一容器 | 等 ADM-03～08 CONFIRMED |
| **新增** | ADM-02a 分类视图 | 分类导航与分类健康摘要 | 等 ADM-02a CONFIRMED |
| **新增** | ADM-08 来源与历史前端界面 | `product_source_records` 已有后端 | 等 ADM-08 CONFIRMED |
| **新增** | Import Center（ADM-09～11） | 多品号工作簿导入 + 队列 | 须单独授权 |
| **新增** | AI 工作台（ADM-14～15） | AI 任务管理 | 须单独授权 + AI 接入前置条件满足 |
| **新增** | 产品专属媒体与资料引用视觉优化 | 与全局 Media Library 分开 | 等 ADM-04 CONFIRMED |
| **新增** | 单品号 Product Dossier（含 AI 功能） | 逻辑图 01 | 须单独授权 |
| **新增** | 多品号导入审核队列 | 逻辑图 02 | 须单独授权 |

---

## J. 锁定的施工顺序与依赖

除非用户明确改框架，后续施工必须按以下顺序执行，不得跳步：

```text
J-0  母版对齐审计（只读，已由本 Charter 建立基线）
J-1  本 Governing Charter 生效（当前步骤）
J-2  Product Center 视觉确认（ADM-02 + ADM-02a → CONFIRMED）+ 施工
J-3  Product Workspace Shell + Product Control 框架
J-4  ADM-03～08 按依赖分模块实施（须各自 CONFIRMED）
J-5  全局 Media Library 视觉对齐（ADM-12 → CONFIRMED 后）
J-6  单品号 Product Dossier（含 AI 功能，须单独授权）
J-7  多品号 Import + Review Queue（须单独授权）
J-8  真实产品资料审计与新 Draft 录入
J-9  前台 CMS 消费优化
J-10 上线前完整安全、视觉、数据验收
```

---

## K. 每次施工前的强制读取与 Framework Gate

### K.1 不可跳过的必读文件

每次 Claude 接到任何 Admin/CMS 代码任务，必须先读（按顺序）：

```text
1. CLAUDE.md
2. docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md（本文件）
3. docs/project/CURRENT-STATE.md
4. docs/project/MASTER-ROADMAP.md
5. 本任务相关 CMS-AI-CONSTRUCTION-PACK-V1 章节
6. 本页面对应的 CONFIRMED 视觉母版（无 CONFIRMED 图则停止）
7. 当前相关代码与测试
```

### K.2 每次开工报告必须包含的声明

```text
Framework version: Governing Charter V1（docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md）
Relevant Charter sections: [填写本次相关的 A/B/C/... 章节]
Relevant visual/logic master: [精确路径 + 当前状态 CONFIRMED/DRAFT]
Current milestone: [填写当前处于 J-? 阶段]
Scope is aligned / conflict found: [对齐 / 冲突（需报告）]
Files explicitly excluded: [施工单禁止暂存的文件列表]
```

**没有这段开工声明，不得修改代码。**

---

## L. 验收、Git 与备份规则

### L.1 模块施工闭环

```text
一份施工单
  → Claude 自动完成代码与自动化验证（typecheck / lint / build / tests）
  → 用户最多一次集中登录（仅确有浏览器验收必要时）
  → Claude 集中验收
  → 一份精确的 commit / GitHub push 施工单（须用户单独授权后 push）
```

### L.2 代码模块必须通过

```text
npm run typecheck — 0 errors
npm run lint — 0 errors
npx nuxt build — 成功
npx vitest run — 0 failures（如有测试）
git diff --check — 无 whitespace 错误
1440px + 375px 浏览器验收（无法使用 MCP 浏览器时，以 curl/typecheck/build 代替，如实记录限制）
CURRENT-STATE.md 更新以反映新状态
```

### L.3 Git 操作规则

```text
精确暂存（git add -- file1 file2，不使用 add-all）；
提交前 git diff --cached --name-only 核实暂存内容；
不使用 git add . / git add -A / git reset --hard / git clean / git stash / git restore / git checkout --;
不暂存既有四个 ?? 资料包：
  docs/design-reference/CMS-AI-VISUAL-MASTER-V1/
  docs/design-reference/inbox/
  docs/product-cms/CMS-AI-CONSTRUCTION-PACK-V1/
  docs/project/LITUBO_9C-2R_正式施工单.md
git push 须经用户单独授权；
push 前 git rev-list --left-right --count origin/master...HEAD 确认本地不超过预期 commit 数。
```

---

## M. 变更日志与可追溯附录

### M.1 Charter 变更日志

| 版本 | 日期 | 变更内容 | 授权者 |
|------|------|---------|--------|
| V1 | 2026-09-06 | 初始建立 | 用户 |

### M.2 Open Decision Gates（用户待确认事项）

| # | 事项 | 当前状态 | 影响 |
|---|------|---------|------|
| DG-01 | ADM-02 视觉母版 CONFIRMED 确认 | DRAFT，待用户确认 | Product Center 重构施工前置条件 |
| DG-02 | ADM-02a 视觉母版 CONFIRMED 确认 | DRAFT，待用户确认 | 分类视图施工前置条件 |
| DG-03 | ADM-03～08 视觉母版逐一 CONFIRMED 确认 | DRAFT，待用户确认 | Product Workspace Shell 施工前置条件 |
| DG-04 | Metal Detection 产品分类是否已在 Directus 建立 | 未确认 | 真实 LT-180C Draft 录入前置条件 |
| DG-05 | LT-180C 真实图片/文档资料上传 | 未上传 | M5-B 准入条件之一 |
| DG-06 | `product_code = LT-180C` 业务确认 | 待确认 | product_code 设置后不可修改 |
| DG-07 | AI 试点：模型供应商、费用预算、数据出境范围 | 未授权 | AI 功能施工前置条件 |
| DG-08 | Product Family / Revision 完整数据模型 | 当前 products 表无 revision_no | 完整 Dossier 工作流前置条件 |
| DG-09 | Publisher / Editor / Reviewer 角色边界正式定义 | 当前角色未细分 | 多人协作与权限模型前置条件 |

### M.3 路由 / 组件 / API / 测试追溯矩阵

| ADM ID | 路由 | 主要组件 | 关键 API | 测试文件 | 当前里程碑状态 |
|--------|------|---------|---------|---------|--------------|
| Shell | `layouts/admin.vue` | Admin Shell | `/api/admin/auth/*` | — | 已实现（保留） |
| ADM-02 | `/admin/products` | `pages/admin/products/index.vue` | `GET /api/admin/products` | — | 基础已有，待按母版重构（J-2）|
| ADM-02a | `/admin/products?category=` | 待新建 | `GET /api/admin/products` | — | 未实现（J-2）|
| WS Shell | `/admin/products/[id]` | 待新建 Workspace Shell | `GET /api/admin/products/[id]` | — | 未实现统一 Shell（J-3）|
| ADM-03 | `/admin/products/[id]/specs` | `pages/admin/products/[id]/specs.vue` | Specs API | — | 基础已有，待视觉重构（J-4）|
| ADM-04 | `/admin/products/[id]/media` | `pages/admin/products/[id]/media.vue` | Media API | — | 基础已有，待视觉重构（J-4）|
| ADM-05 | `/admin/products/[id]/content` | `pages/admin/products/[id]/content.vue` | Sections API | — | 基础已有，待视觉重构（J-4）|
| ADM-06 | `/admin/products/[id]/relations` | 待新建 | 待新建 | — | 未实现（J-4）|
| ADM-07 | `/admin/products/[id]/seo` | `pages/admin/products/[id]/seo.vue` | SEO 字段 | — | 基础已有，待视觉重构（J-4）|
| ADM-08 | `/admin/products/[id]/sources` | 待新建 | `GET/POST /api/admin/products/[id]/sources` | `sourceRecords.test.ts` | 后端已有，前端未实现（J-4）|
| ADM-12 | `/admin/media` | `pages/admin/media/index.vue` | Media API | FolderRegistry tests | 功能已实现，视觉待对比（J-5）|
| ADM-09–11 | `/admin/import/*` | 待新建 | 待新建 | — | 未实现（J-7）|
| ADM-14–15 | `/admin/ai/*` | 待新建 | 待新建 | — | 未实现（J-6）|
