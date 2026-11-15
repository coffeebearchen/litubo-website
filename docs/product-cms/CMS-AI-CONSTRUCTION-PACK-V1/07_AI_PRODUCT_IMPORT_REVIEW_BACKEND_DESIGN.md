# LITUBO AI 产品导入与逐个审核 — 后端设计说明

**状态：** 已确认的产品与后端设计原则，待实施  
**用途：** 作为后续 Claude Code 实施前的设计依据；本文件不授权改代码、接入模型或产生 API 费用。

## 1. 已确认的核心决定

1. **单型号 Product Dossier 是 AI 真正工作的地方。** AI 基于一个指定型号的明确资料包，协助填写产品固定表单、检查资料、生成页面模块建议与来源证据。
2. **多型号 XLSX/CSV 不是“批量 AI 生成详情页”。** 它只负责按确定性字段映射建立多个产品 Draft、关联来源数据、形成待处理队列。
3. **多型号导入后，AI 可以协助逐个审核。** 管理员可以按队列进入下一个型号；但每次 AI 运行仍只处理一个 `product_draft_id`，绝不把多个型号的资料混入同一上下文。
4. **AI 输出永远是版本化建议。** 人工必须对每项建议选择“接受 / 编辑后接受 / 退回或拒绝”。已人工确认或编辑的字段默认锁定，重新生成不得覆盖。
5. **导入、AI、审核和发布四个动作必须分离。** 导入最多创建 Draft；AI 不可发布；发布只能走独立的人工 Review 与权限校验。

## 2. 业务工作流

```text
多 Sheet XLSX / CSV 工作簿
        ↓
字段映射、规则校验、预览（只写 staging，不写产品）
        ↓
创建 N 个 Product Draft + 每个 Draft 的明确来源关联
        ↓
多型号逐个 AI 审核队列
        ↓（每次只选一个 product_code）
单型号 Product Dossier：AI 填表、检查、提出建议
        ↓
人工接受 / 编辑 / 退回，并锁定已确认字段
        ↓
单个 Draft 提交 Review
        ↓
独立人工发布动作
```

### 两个页面的明确分工

| 页面 | 做什么 | 不做什么 |
|---|---|---|
| **单型号产品工作台 / Product Dossier** | AI 读取当前 Draft 的资料快照，填写固定表单、检查参数、建议页面模块、FAQ、SEO 与图片角色；人工逐项确认。 | 不读取其他型号，不批量发布，不覆盖已确认字段。 |
| **多型号导入与逐个 AI 审核队列** | 导入多 Sheet 工作簿，创建多个 Draft，展示完成度与异常；按队列打开一个型号的 AI 工作台。 | 不把所有型号交给一个 AI 任务，不批量接受 AI 建议，不批量生成或发布详情页。 |

## 3. 后端硬性不变式

以下规则必须同时由 API、服务层和数据库约束保护，不能只依赖前端提示。

1. 每个 AI 任务必须且只能绑定一个 `product_draft_id`。
2. 每个 AI 任务必须绑定一个不可变的 `source_snapshot_id`。
3. 快照只能包含当前 Draft 明确关联的来源记录、媒体 UUID 与资料范围。
4. AI 只能写入“建议、证据、冲突、完整度结果”；不能直接写入已确认字段、Published 内容或正式媒体。
5. `product_code` 是产品身份主键；不得由名称、图片文件名、相似度或 AI 猜测替代。
6. AI、导入或队列不得直接使内容进入公开 API、sitemap、搜索引擎或 Published 状态。

## 4. 资料范围与来源快照

一个 AI 任务应读取的不是“整个媒体库”或“整个导入批次”，而是一份可追溯、可冻结的资料快照。

```text
Product Draft #001
├─ PDF：明确关联的页码范围，例如 p.12–15
├─ Excel：明确关联的 Sheet / 行列范围，例如 Specifications!A5:H18
├─ 图片：明确关联的媒体 UUID 列表
├─ 证书 / 图纸：明确关联的媒体 UUID 与可用范围
└─ 来源版本 / 文件 hash / 建立时间
```

- 同一 PDF 或 Excel 含多个型号时，必须先定位页码或行列范围；范围不明时标为“待人工归属”，不得进入 AI 资料包。
- 私有报价、内部图纸、客户专属文件即使允许 AI 阅读，也不能自动成为网站公开资料。
- AI 完成前若 Draft 内容或资料快照发生变化，运行结果标记为 `stale`，必须重新生成建议。

## 5. 目标逻辑实体

> 实施前必须先对照仓库实际 Directus schema、`CLAUDE.md`、`CURRENT-STATE.md` 与既有命名；下表是目标逻辑，不得未经核对直接创建迁移。

| 实体 | 核心作用 |
|---|---|
| `products` | 长期产品身份；`product_code` 唯一。 |
| `product_drafts` / `product_revisions` | 一个型号的可审核工作版本；Draft 与 Published 分离。 |
| `import_profiles` | 可复用的多 Sheet 模板、字段映射、单位转换与版本。 |
| `import_batches` | 一次导入任务、工作簿媒体 UUID、操作者、状态与配置版本。 |
| `import_staging_rows` | Sheet、行号、原始单元格、标准化结果、异常；预览期间不写入产品。 |
| `batch_draft_items` | 导入批次与每个 Draft 的关系、队列顺序、完成度与异常摘要。 |
| `product_draft_sources` | Draft 与资料 / 媒体的显式关联；包含角色与页码、Sheet、单元格范围。 |
| `source_snapshots` | AI 启动时冻结的资料清单、范围、文件 hash 与版本。 |
| `ai_dossier_runs` | 一个 Draft 的一次 AI 运行、模块范围、模型配置版本、状态。 |
| `ai_suggestions` | 字段或页面模块路径、建议值、状态、置信度与建议版本。 |
| `suggestion_evidence` | 每项建议对应的媒体 UUID、页码、Sheet、单元格范围或引用片段。 |
| `draft_field_states` | 字段当前值、锁定状态、人工确认人和版本，防止 AI 覆盖。 |
| `validation_issues` | 缺失、单位冲突、型号冲突、资料归属不明、证据缺失等问题。 |
| `audit_events` | 导入、关联、生成、接受、编辑、退回、提交 Review、发布等可审计记录。 |

产品详情页模块必须保持结构化，例如：`Hero`、`Overview`、`Capability Modules`、`Specifications`、`Gallery & Resources`、`Applications`、`FAQ`、`CTA`、`SEO`。AI 不生成任意 HTML 页面。

## 6. 状态机

### 6.1 导入批次

```text
uploaded
→ parsing
→ mapping_required
→ validation_ready
→ preview_confirmed
→ creating_drafts
→ review_queue_ready
→ closed

异常：failed / cancelled
```

`preview_confirmed` 之前只允许 staging 数据。`creating_drafts` 只能建立 Draft，不得建立 Published 产品。

### 6.2 单型号工作步骤（`workflow_step`，不是正式 Revision 状态）

> **消歧规则：** 本表只描述单型号工作台的处理进度。正式 Revision 的唯一长期状态机仍是 `draft → review → published → archived`，以 `02_SYSTEM_BLUEPRINT_FRONTEND_BACKEND_AI.md` 和 `08_IMPLEMENTATION_CONTRACTS_AND_DECISION_REGISTER.md` 为准。下列名称不得被实现成第二套 `status` 字段，也不得直接决定公开性。

```text
imported
→ source_binding_required
→ source_ready
→ ai_ready
→ ai_suggestions_ready
→ human_reviewing
→ review_ready
→ submitted_for_review

可回退：needs_correction / needs_source / blocked_by_conflict
```

`submitted_for_review` 对应正式状态从 `draft` 转为 `review`；审核通过是一条独立审计决定；仅 Publisher 的发布命令可使正式状态从 `review` 转为 `published`。绝不可从 `imported`、`ai_suggestions_ready` 或导入批次直接跳转。

### 6.3 单字段 / 模块建议

```text
empty → proposed → human_confirmed / human_edited
                 ↘ rejected / needs_resolution
```

`human_confirmed` 与 `human_edited` 默认锁定。管理员若要让 AI 再建议已确认字段，必须先显式解除锁定；新结果仍只能创建新建议版本，不能覆盖旧值。

## 7. 服务与 API 边界

浏览器不能直接拥有任意 Directus 写权限或直接调用模型。由 Nuxt 服务端承担权限校验、流程编排与 AI 任务调度；Directus 继续负责 CMS 数据与 Media Library。

| 服务边界 | 允许做什么 | 禁止做什么 |
|---|---|---|
| 工作簿导入服务 | 解析、映射、标准化、校验、建立 staging。 | 不调用 AI，不写 Published。 |
| Draft 创建服务 | 根据已确认预览创建多个 Draft 与队列项。 | 不自动填详情页、不自动发布。 |
| 来源范围服务 | 为一个 Draft 建立资料关联并冻结快照。 | 不允许从全媒体库或其他 Draft 任意检索。 |
| AI Dossier 服务 | 对一个 Draft 生成表单建议、证据、冲突与完整度结果。 | 不写正式字段、不发布、不处理其他产品。 |
| 人工确认服务 | 接受、编辑、拒绝、锁定建议。 | 不接受无证据或已过期的建议。 |
| 发布服务 | 在独立 Review 后发布。 | 不直接使用 AI 原始输出作为发布依据。 |

建议的接口形态：

```text
POST  /api/admin/import-batches
POST  /api/admin/import-batches/:id/parse
PATCH /api/admin/import-batches/:id/mapping
POST  /api/admin/import-batches/:id/validate
POST  /api/admin/import-batches/:id/create-drafts
GET   /api/admin/import-batches/:id/review-queue

POST  /api/admin/product-drafts/:id/sources
POST  /api/admin/product-drafts/:id/source-snapshots
POST  /api/admin/product-drafts/:id/ai-runs
GET   /api/admin/product-drafts/:id/ai-runs/:runId
POST  /api/admin/product-drafts/:id/suggestions/:suggestionId/accept
POST  /api/admin/product-drafts/:id/suggestions/:suggestionId/edit-and-accept
POST  /api/admin/product-drafts/:id/suggestions/:suggestionId/reject
POST  /api/admin/product-drafts/:id/fields/:fieldPath/unlock
POST  /api/admin/product-drafts/:id/submit-review
POST  /api/admin/product-drafts/:id/publish
```

AI 请求路径中的单个 `:id` 是唯一对象。若请求体混入 `product_ids`、`all_drafts` 或全局筛选条件，服务端必须拒绝。

## 8. AI 队列与写入语义

### 8.1 单项队列任务

队列可同时排队多个型号，但每个 job 的最小载荷仅为：

```text
ai_run_id
product_draft_id
source_snapshot_id
draft_version
allowed_module_paths
```

Worker 只能使用上述 ID 读取资料，不能得到整个导入批次，也不能查询其他型号。

### 8.2 防串扰和重复写入

- 同一 Draft 同一时间只允许一个活动 AI run。
- 使用 `idempotency_key` 防止重复点击产生重复任务。
- 同一 Draft 或来源快照变化后，旧结果标记 `stale`。
- 所有接受建议的请求使用乐观锁版本号。
- 模型失败、重试、断网只能改变 run 状态，不得重复创建 Draft、建议或覆盖字段。
- AI 输出先经过 JSON schema、字段类型、单位词典、分类规则校验，再以“建议”存储。

### 8.3 AI 可做与不可做

AI 可在一个 Draft 中：

- 提取产品身份、参数并建议单位标准化；
- 检查缺失、冲突、重复与资料归属问题；
- 建议 Hero 图片角色、固定页面模块资料归位、FAQ、SEO、Overview 文案；
- 为每项建议写入来源证据、置信度、冲突提示与是否适合公开网站的判断。

AI 不可：

- 读取其他型号、未关联媒体或其他组织的资料；
- 自动覆盖已确认字段；
- 删除、归档、移动或公开正式媒体；
- 自动提交 Review、发布内容、更新 sitemap 或公开 API；
- 把来源不明的参数标为已确认。

## 9. 实施顺序

> 本节仅描述“多型号导入 + 逐项审核模块内部”的实现顺序；整个项目的先后依赖以 `04_CONSTRUCTION_ROADMAP_AND_TASKS.md` 为准。单型号 Product Dossier 与人工审核基础必须先于真实多型号 AI 扩展得到验证。

1. **多 Sheet 导入 staging + 字段映射 + 校验预览**：先确保预览不写产品数据。
2. **创建 Draft + 逐个审核队列**：只建立产品身份、基础 Draft 和来源关系。
3. **单型号来源范围与快照**：完成页码 / Sheet / 单元格范围、媒体引用、冻结机制。
4. **AI Suggestion + Evidence + 字段锁定**：先使用模拟结果与审核链路，不接真实 Key。
5. **人工接受 / 编辑 / 退回与 Review 边界**：完成审计、版本和权限校验。
6. **最后接入真实模型**：仅在 Media Library、权限、人工审核链路通过后，并经明确授权才接入 API Key 与费用控制。

## 10. 验收标准

1. 一个工作簿含 3 个 `product_code` 时，导入后只创建 3 个 Draft，不产生 Published 产品。
2. `Draft #001` 的 AI job 只能读取其 frozen `source_snapshot`；尝试夹带 `Draft #002` 媒体 UUID 必须被拒绝。
3. 多型号 PDF 仅允许授权页码范围给当前 Draft；Worker 无法读取同一 PDF 的其他页。
4. `product_code` 缺失、资料归属不明或来源范围未冻结时，AI run 无法启动。
5. AI 成功后，产品正式字段不变；只有人工接受建议才写入 Draft。
6. 已确认或人工编辑字段重新生成后不被覆盖。
7. Draft 或来源版本变化后，旧建议显示为过期且不能接受。
8. 已 Published 的同 `product_code` 被再次导入时，只能建立新 revision Draft 或要求人工选择冲突策略，不能覆盖线上页面。
9. 无页码 / Sheet / 单元格证据的参数进入 `needs_resolution`，不可进入 `review_ready`。
10. Worker 重试、模型失败或重复点击不会产生重复 Draft、重复建议或数据覆盖。
11. 未授权角色不能导入、关联私有资料、接受建议、提交 Review 或发布。
12. Draft、staging 与 AI 建议始终不出现在公开产品 API、前台详情页、sitemap 或搜索引擎。
13. 后台实施后必须验证 1440px 桌面端与 375px 手机端：队列、范围锁定、打开单型号工作台、异常报告均可用且无横向溢出。

## 11. 本模块的明确停止条件

- 本设计阶段不修改数据库 schema、不接入真实模型 Key、不产生 API 费用。
- 未完成 Media Library 引用保护、管理员权限、资料快照与人工审核链路前，不得开放 AI 自动任务。
- 实施前 Claude 必须先阅读 `CLAUDE.md`、`docs/project/CURRENT-STATE.md`、`docs/project/MASTER-ROADMAP.md`，检查 Git 状态与相关现有 schema；若与本设计冲突，停止并报告，不自行猜测或迁移。
